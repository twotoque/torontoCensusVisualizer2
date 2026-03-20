# api.py
import json
import plotly.graph_objects as go
import plotly.io as pio

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from census_registry import available_years, get_paths
from data_loader import load_census, load_geo
from figures import build_bar, build_map, build_stack, export_pdf, search_rows

app = FastAPI(title="Census Internal API", docs_url=None, redoc_url=None)

class StackRequest(BaseModel):
    rows: list[int] 

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
    census_df           = load_census(paths["census"])

    return geo_gdf, geo_dict, wards_gdf, census_df, paths["label_col"], paths["wards_name_col"], paths.get("id_col")


def _row_index(row: int) -> int:
    """Convert 1-based display row → 0-based DataFrame index."""
    return row - 2

@app.get("/years")
def get_years():
    return JSONResponse(content={"years": available_years()})

@app.get("/census/{year}/search")
def search(year: int, q: str):
    _, _, _, census_df, label_col, *_, id_col = _load(year)
    print(f"search: year={year} q={q} label_col={label_col} id_col={id_col}")
    results = search_rows(census_df, q, label_col=label_col, id_col=id_col)
    print(f"results: {results}")
    return JSONResponse(content={"results": results})

@app.get("/census/{year}/row/{row}/map")
def get_map(year: int, row: int):
    geo_gdf, geo_dict, wards_gdf, census_df, label_col, wards_name_col, _ = _load(year)
    return _to_json(build_map(geo_gdf, geo_dict, wards_gdf, census_df, _row_index(row), label_col, wards_name_col))

@app.get("/census/{year}/row/{row}/bar")
def get_bar(year: int, row: int):
    _, _, _, census_df, label_col, *rest = _load(year)
    return _to_json(build_bar(census_df, _row_index(row), label_col))

@app.post("/census/{year}/stack")
def get_stack(year: int, body: StackRequest):
    _, _, _, census_df, label_col, *rest = _load(year)
    indices = [_row_index(r) for r in body.rows]
    return _to_json(build_stack(census_df, indices, label_col))

@app.get("/census/{year}/row/{row}/export/{kind}")
def get_export(year: int, row: int, kind: str):
    if kind not in ("map", "bar"):
        raise HTTPException(status_code=400, detail="kind must be 'map' or 'bar'")
    
    geo_gdf, geo_dict, wards_gdf, census_df, label_col, wards_name_col, _ = _load(year)
    
    if kind == "map":
        fig_dict = build_map(geo_gdf, geo_dict, wards_gdf, census_df, _row_index(row), label_col, wards_name_col)
    else:
        fig_dict = build_bar(census_df, _row_index(row), label_col)
        
    pdf_bytes = export_pdf(fig_dict, kind)
    return Response(
        content=pdf_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{kind}_{year}_{row}.pdf"'}
    )

@app.post("/census/{year}/export/stack")
def export_stack(year: int, body: StackRequest):
    _, _, _, census_df, label_col, *rest = _load(year)
    indices = [_row_index(r) for r in body.rows]
    fig_dict = build_stack(census_df, indices, label_col)
    pdf_bytes = export_pdf(fig_dict, "stack")
    return Response(
        content=pdf_bytes, 
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="stack_{year}.pdf"'}
    )