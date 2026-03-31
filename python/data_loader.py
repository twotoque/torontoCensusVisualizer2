# data_loader.py
# File I/O only. Reads and caches geojson + CSV.

import json
from functools import lru_cache

import geopandas as gpd
import pandas as pd

def normalize_label(label: str) -> str:
    """Strip leading spaces/indentation from census labels for cross-year matching."""
    return label.strip()

def get_label_depth(label: str) -> int:
    """Return nesting depth based on leading spaces (2 spaces per level)."""
    return (len(label) - len(label.lstrip())) // 2
    

@lru_cache(maxsize=16)
def load_census(path: str, drop_cols: tuple[str, ...] = ()) -> pd.DataFrame:
    """
    Load and cache a census CSV file as a DataFrame, optionally dropping columns.

    Results are memoized per (path, drop_cols) via functools.lru_cache. Any column
    names listed in drop_cols that are present in the CSV are removed before the
    cleaned DataFrame is returned.
    """
    df = pd.read_csv(path)
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    # build Combined_Label for pre-2021 years that have Category/Topic/Attribute
    if all(c in df.columns for c in ["Category", "Topic", "Attribute"]):
        # Vectorized construction: strip, drop empty, and join non-empty parts with " — "
        cols = ["Category", "Topic", "Attribute"]
        clean_df = pd.DataFrame(
            {
                c: df[c].where(df[c].notna(), "").astype(str).str.strip()
                for c in cols
            }
        )
        stacked = clean_df.replace("", pd.NA).stack()
        combined = stacked.groupby(level=0).agg(" \u2014 ".join)
        df["Combined_Label"] = combined.reindex(df.index, fill_value="")

    neighbourhood_cols = df.columns[5:]
    df[neighbourhood_cols] = df[neighbourhood_cols].replace(
        {r',': '', r'%': ''}, regex=True
    )
    return df

@lru_cache(maxsize=16)
def load_geo(path: str) -> tuple[gpd.GeoDataFrame, dict]:
    """
    Load and cache a GeoJSON file
    Returns (GeoDataFrame, plotly-ready FeatureCollection dict).
    """
    gdf = gpd.read_file(path)
    # normalize neighbourhood names by stripping trailing " (number)" suffix (for 2016 and earlier only)
    if "AREA_NAME" in gdf.columns:
       gdf["AREA_NAME"] = (
            gdf["AREA_NAME"]
            .str.replace(r'\s*\(\d+\)$', '', regex=True)
            .str.replace(r'St\.James', 'St. James', regex=False)
            .str.strip()
        )
    geo_dict = json.loads(gdf.to_json())
    return gdf, {
        "type": "FeatureCollection",
        "features": geo_dict["features"],
    }
