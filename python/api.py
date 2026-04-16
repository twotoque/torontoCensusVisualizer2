# api.py
import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from census_registry import available_years, get_paths
from data_loader import load_census, load_geo, load_population_series
from figures import build_bar, build_map, build_stack, export_pdf, search_rows
from rag import semantic_search, find_row_in_year
from ask import answer as ask_answer
import math
from pathlib import Path
from functools import lru_cache

from prediction import forecast, compare_neighbourhoods
import statistics


app = FastAPI(title="Census Internal API", docs_url=None, redoc_url=None)

class StackRequest(BaseModel):
    rows: list[int]

class AskRequest(BaseModel):
    question: str
    confirmed_row_id: int | None = None
    confirmed_year: int | None = None



def _sanitize(obj):
    """Recursively replace nan/inf with None for JSON compliance."""
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj

def _to_json(fig_dict: dict) -> Response:
    """Plotly's serializer handles numpy/pandas types that json.dumps cannot."""
    json_str = pio.to_json(go.Figure(fig_dict))
    return Response(content=json_str, media_type="application/json")

def _load(year: int):
    """
    Returns 7 values:
    geo_gdf, geo_dict, wards_gdf, census_df, label_col, wards_name_col, id_col
    """
    try:
        paths = get_paths(year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    geo_gdf,   geo_dict = load_geo(paths["neighbourhoods"])
    wards_gdf, _        = load_geo(paths["wards"])
    census_df           = load_census(
        paths["census"],
        drop_cols=tuple(paths.get("drop_cols", ())),
    )

    return geo_gdf, geo_dict, wards_gdf, census_df, paths["label_col"], paths["wards_name_col"], paths.get("id_col")


def resolve_row(census_df: pd.DataFrame, row: int, id_col: str | None = None) -> int:
    """Convert a user-facing row identifier to a 0-based DataFrame index.

    For years with an id_col (e.g. 2016), matches against that column exactly.
    For years without (e.g. 2021), falls back to the original row - 2 convention.
    """
    if id_col and id_col in census_df.columns:
        matches = census_df[census_df[id_col] == row]
        if matches.empty:
            raise HTTPException(status_code=404, detail=f"No row with {id_col}={row}")
        return int(matches.index[0])
    return row - 2  # 2021 convention

@lru_cache(maxsize=1)
def _load_weights():
    ROOT_DIR = Path(__file__).resolve().parent.parent
    if os.path.exists("/app/data"):
        BASE = Path("/app/data")
    else:
        BASE = ROOT_DIR / "data"
        
    return pd.read_parquet(str(BASE / 'weights/140_to_158.parquet'))





@app.get("/census/{year}/row/{row}/compare/{prev_year}")
def compare_years(year: int, row: int, prev_year: int):
    curr_paths = get_paths(year)
    prev_paths = get_paths(prev_year)

    curr_df = load_census(curr_paths["census"], drop_cols=tuple(curr_paths.get("drop_cols", ())))
    prev_df = load_census(prev_paths["census"], drop_cols=tuple(prev_paths.get("drop_cols", ())))

    # Resolve current row
    curr_id_col = curr_paths.get("id_col")
    if curr_id_col and curr_id_col in curr_df.columns:
        curr_matches = curr_df[curr_df[curr_id_col] == row]
        if curr_matches.empty:
            return {"error": "row not found"}
        curr_row = curr_matches.iloc[0]
    else:
        curr_row = curr_df.iloc[row - 2]

    # Build search label: use Combined_Label if available for richer context
    curr_label = (
        str(curr_row["Combined_Label"]) if "Combined_Label" in curr_df.columns
        else str(curr_row[curr_paths["label_col"]]).strip()
    )

    # RAG: find equivalent row in prev year
    prev_results = semantic_search(curr_label, year=prev_year, limit=3)
    if not prev_results:
        return {"error": f"no matching row for '{curr_label}' in {prev_year}"}

    best        = prev_results[0]
    prev_id_col = prev_paths.get("id_col")
    if prev_id_col and prev_id_col in prev_df.columns:
        prev_matches = prev_df[prev_df[prev_id_col] == best["row_id"]]
    else:
        prev_matches = prev_df.iloc[[best["row_id"] - 2]]

    if prev_matches.empty:
        return {"error": f"row {best['row_id']} not found in {prev_year}"}

    prev_row      = prev_matches.iloc[0]
    prev_label = (
        str(prev_row["Combined_Label"]) if "Combined_Label" in prev_df.columns
        else str(prev_row[prev_paths["label_col"]]).strip()
    )
    prev_row_id, match_score = find_row_in_year(curr_label, prev_year)
    if prev_row_id is None:
        return {"error": f"no matching row for '{curr_label}' in {prev_year}"}

    curr_label_col = curr_paths["label_col"]
    col_start      = curr_df.columns.get_loc(curr_label_col)
    curr_neighbourhoods = list(curr_df.columns[col_start + 1:])

    weights_df = _load_weights()

    result  = {}
    mapping = {}

    for col in curr_neighbourhoods:
        try:
            curr_val = float(str(curr_row[col]).replace(",", "").replace("%", ""))
        except (ValueError, TypeError):
            continue

        old_names = weights_df[weights_df["AREA_NAME_2"] == col]

        if not old_names.empty and year == 2021:
            # 140 → 158 weighted mapping (parquet)
            prev_val     = 0.0
            total_weight = 0.0
            sources      = []
            for _, wrow in old_names.iterrows():
                old_name = wrow["AREA_NAME_1"]
                weight   = wrow["weight"]
                if old_name in prev_df.columns:
                    try:
                        v = float(str(prev_row[old_name]).replace(",", "").replace("%", ""))
                        prev_val     += v * weight
                        total_weight += weight
                        sources.append({"name": old_name, "weight": round(float(weight), 3)})
                    except (ValueError, TypeError):
                        pass
            if total_weight > 0:
                result[col] = {"current": curr_val, "prev": round(prev_val, 2)}
                if sources and (len(sources) > 1 or sources[0]["weight"] < 0.99):
                    mapping[col] = sources
        else:
            # Same 140 neighbourhood system — direct lookup
            if col in prev_df.columns:
                try:
                    prev_val = float(str(prev_row[col]).replace(",", "").replace("%", ""))
                    result[col] = {"current": curr_val, "prev": prev_val}
                except (ValueError, TypeError):
                    pass

    return {
        "curr_label":   curr_label,
        "prev_label":   prev_label,
        "match_score":  round(match_score, 3),  # so frontend can warn if low confidence
        "year":         year,
        "prev_year":    prev_year,
        "data":         result,
        "mapping":      mapping,
    }

@app.get("/years")
def get_years():
    return JSONResponse(content={"years": available_years()})

@app.get("/census/{year}/search")
def search(year: int, q: str):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    return JSONResponse(content={"results": search_rows(census_df, q, label_col=label_col, id_col=id_col)})

@app.get("/census/{year}/row/{row}/map")
def get_map(year: int, row: int):
    geo_gdf, geo_dict, wards_gdf, census_df, label_col, wards_name_col, id_col = _load(year)
    return _to_json(build_map(geo_gdf, geo_dict, wards_gdf, census_df, resolve_row(census_df, row, id_col), label_col, wards_name_col))

@app.get("/census/{year}/row/{row}/bar")
def get_bar(year: int, row: int):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    return _to_json(build_bar(census_df, resolve_row(census_df, row, id_col), label_col))

@app.post("/census/{year}/stack")
def get_stack(year: int, body: StackRequest):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    indices = [resolve_row(census_df, r, id_col) for r in body.rows]
    return _to_json(build_stack(census_df, indices, label_col))

@app.get("/census/{year}/row/{row}/export/{kind}")
def get_export(year: int, row: int, kind: str):
    if kind not in ("map", "bar"):
        raise HTTPException(status_code=400, detail="kind must be 'map' or 'bar'")

    geo_gdf, geo_dict, wards_gdf, census_df, label_col, wards_name_col, id_col = _load(year)
    idx = resolve_row(census_df, row, id_col)

    if kind == "map":
        fig_dict = build_map(geo_gdf, geo_dict, wards_gdf, census_df, idx, label_col, wards_name_col)
    else:
        fig_dict = build_bar(census_df, idx, label_col)

    pdf_bytes = export_pdf(fig_dict, kind)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{kind}_{year}_{row}.pdf"'}
    )

@app.post("/census/{year}/export/stack")
def export_stack(year: int, body: StackRequest):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    indices = [resolve_row(census_df, r, id_col) for r in body.rows]
    fig_dict = build_stack(census_df, indices, label_col)
    pdf_bytes = export_pdf(fig_dict, "stack")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="stack_{year}.pdf"'}
    )

@app.get("/census/{year}/semantic-search")
def semantic(year: int, q: str):
    results = semantic_search(q, year=year)
    return JSONResponse(content={"results": results})

# cross-year semantic search
@app.get("/census/search/semantic")
def semantic_global(q: str):
    results = semantic_search(q)
    return JSONResponse(content={"results": results})

# natural language Q&A
@app.post("/ask")
def ask(body: AskRequest):
    result = ask_answer(body.question, body.confirmed_row_id, body.confirmed_year)
    return JSONResponse(content=_sanitize(result))

@app.get("/predict/neighbourhoods")
def predict_neighbourhoods():
    pop_df = load_population_series()
    return JSONResponse(content={"neighbourhoods": sorted(pop_df.index.tolist())})

@app.get("/predict/{neighbourhood}")
def predict(neighbourhood: str, years: str = "2026,2031"):
    forecast_years = [int(y) for y in years.split(",")]
    result = forecast(neighbourhood, forecast_years)
    return JSONResponse(content=_sanitize(result))

@app.post("/predict/compare")
def predict_compare(body: dict):
    neighbourhoods  = body.get("neighbourhoods", [])
    forecast_years  = body.get("years", [2026, 2031])
    result = compare_neighbourhoods(neighbourhoods, forecast_years)
    return JSONResponse(content=_sanitize(result))

@app.get("/census/cell")
def get_cell(year: int, row_id: int, neighbourhood: str, context_rows: int = 6):
    try:
        paths = get_paths(year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    df        = load_census(paths["census"], drop_cols=tuple(paths.get("drop_cols", ())))
    id_col    = paths.get("id_col")
    label_col = paths["label_col"]

    # resolve row index
    if id_col and id_col in df.columns:
        matches = df.index[df[id_col] == row_id].tolist()
        if not matches:
            raise HTTPException(status_code=404, detail=f"row_id {row_id} not found")
        idx = matches[0]
    else:
        idx = row_id
        if idx >= len(df):
            raise HTTPException(status_code=404, detail=f"row_id {row_id} out of range")

    # slice rows
    row_start = max(0, idx - context_rows)
    row_end   = min(len(df), idx + context_rows + 1)
    slice_df  = df.iloc[row_start:row_end].copy()

    # slice columns: label + target neighbourhood ± 2 neighbours
    data_cols = [c for c in df.columns if c != label_col]
    if neighbourhood in data_cols:
        ci        = data_cols.index(neighbourhood)
        col_slice = data_cols[max(0, ci - 2) : ci + 3]
    else:
        col_slice = data_cols[:5]

    slice_df = slice_df[[label_col] + col_slice]

    return _sanitize({
        "rows":          slice_df.to_dict(orient="records"),
        "target_row_id": row_id,
        "target_col":    neighbourhood,
        "label_col":     label_col,
        "target_df_idx": int(idx),
        "row_start":     int(row_start),
    })

@app.get("/census/{year}/row/{row}/median")
def get_median(year: int, row: int):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    idx = resolve_row(census_df, row, id_col)
    if not (0 <= idx < len(census_df)):
        raise HTTPException(status_code=404, detail=f"row {row} not found")
    
    row_data = census_df.iloc[idx]
    col_start = census_df.columns.get_loc(label_col)
    neighbourhood_cols = census_df.columns[col_start + 1:]
    
    values = []
    for col in neighbourhood_cols:
        try:
            val = float(str(row_data[col]).replace(",", "").replace("%", ""))
            if not math.isnan(val):
                values.append(val)
        except (ValueError, TypeError):
            pass
    
    median_val = None
    if values:
        median_val = statistics.median(values)
    
    return JSONResponse(content=_sanitize({"median": median_val}))