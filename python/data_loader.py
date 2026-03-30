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
    df = pd.read_csv(path)
    df = df.drop(columns=[c for c in drop_cols if c in df.columns])

    # build Combined_Label for pre-2021 years that have Category/Topic/Attribute
    if all(c in df.columns for c in ["Category", "Topic", "Attribute"]):
        def _build_label(row):
            parts = [
                str(row[c]).strip()
                for c in ["Category", "Topic", "Attribute"]
                if pd.notna(row[c]) and str(row[c]).strip()
            ]
            return " \u2014 ".join(parts)
        df["Combined_Label"] = df.apply(_build_label, axis=1)

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
