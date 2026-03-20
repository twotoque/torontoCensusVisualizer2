# api.py
import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from census_registry import available_years, get_paths
from data_loader import load_census, load_geo
from figures import build_bar, build_map, build_stack, export_pdf, search_rows
from rag import semantic_search
from ask import answer as ask_answer

app = FastAPI(title="Census Internal API", docs_url=None, redoc_url=None)

class StackRequest(BaseModel):
    rows: list[int]

class AskRequest(BaseModel):
    question: str

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
    return JSONResponse(content=ask_answer(body.question))