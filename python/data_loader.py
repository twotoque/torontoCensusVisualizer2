# data_loader.py
# File I/O only. Reads and caches geojson + CSV.

import json
from functools import lru_cache

import geopandas as gpd
import pandas as pd
from pathlib import Path

BASE = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/data")

POPULATION_LABELS = {
    2021: "Population, 2016",  
    2016: "Population, 2016",
    2011: "Population, 2011",
    2006: "Population, 2006",
    2001: "Population, 2001",
}

CENSUS_PATHS = {
    2021: (BASE / "2021/CityCensusData.csv",  "Neighbourhood Name"),
    2016: (BASE / "2016/CityCensusData.csv",  "Characteristic"),
    2011: (BASE / "2011/CityCensusData.csv",  "Attribute"),
    2006: (BASE / "2006/CityCensusData.csv",  "Attribute"),
    2001: (BASE / "2001/CityCensusData.csv",  "Attribute"),
}


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

@lru_cache(maxsize=1)
def load_population_series() -> pd.DataFrame:
    """
    Returns a DataFrame: index=neighbourhood, columns=years [2001,2006,2011,2016,2021]
    Each cell is the total population for that neighbourhood in that year.
    """
    records: dict[str, dict[int, float]] = {}

    # 2016 CSV contains both 2016 and 2011 population
    df16 = pd.read_csv(CENSUS_PATHS[2016][0])
    df16.columns = df16.columns.str.strip()
    drop = {"_id", "Category", "Topic", "Characteristic", "City of Toronto"}
    neigh_cols_16 = [c for c in df16.columns if c not in drop]

    for year, label in [(2016, "Population, 2016"), (2011, "Population, 2011")]:
        row = df16[df16["Characteristic"].str.strip() == label]
        if row.empty:
            continue
        row = row.iloc[0]
        for col in neigh_cols_16:
            try:
                val = float(str(row[col]).replace(",", "").replace("%", ""))
                records.setdefault(col, {})[year] = val
            except (ValueError, TypeError):
                pass

    # 2011 CSV contains 2011 and 2006
    df11 = pd.read_csv(CENSUS_PATHS[2011][0])
    df11.columns = df11.columns.str.strip()
    drop11 = {"_id", "Category", "Topic", "Attribute", "City of Toronto"}
    neigh_cols_11 = [c for c in df11.columns if c not in drop11]

    for year, label in [(2006, "Population, 2006")]:
        row = df11[df11["Attribute"].str.strip() == label]
        if row.empty:
            continue
        row = row.iloc[0]
        for col in neigh_cols_11:
            try:
                val = float(str(row[col]).replace(",", "").replace("%", ""))
                records.setdefault(col, {})[year] = val
            except (ValueError, TypeError):
                pass

    # 2001 CSV
    df01 = pd.read_csv(CENSUS_PATHS[2001][0])
    df01.columns = df01.columns.str.strip()
    drop01 = {"_id", "Category", "Topic", "Attribute", "City of Toronto"}
    neigh_cols_01 = [c for c in df01.columns if c not in drop01]
    row = df01[df01["Attribute"].str.strip() == "Population, 2001"]
    if not row.empty:
        row = row.iloc[0]
        for col in neigh_cols_01:
            try:
                val = float(str(row[col]).replace(",", "").replace("%", ""))
                records.setdefault(col, {})[2001] = val
            except (ValueError, TypeError):
                pass

    # 2021 CSV — find total population row
    df21 = pd.read_csv(CENSUS_PATHS[2021][0])
    df21.columns = df21.columns.str.strip()
    drop21 = {"Neighbourhood Number", "TSNS 2020 Designation", "Neighbourhood Name"}
    neigh_cols_21 = [c for c in df21.columns if c not in drop21]
    # Total population is labelled differently — find it
    pop_row = df21[df21["Neighbourhood Name"].str.contains("Population, 2021", na=False)]
    if pop_row.empty:
        # fallback: search all columns
        for col in df21.columns:
            mask = df21[col].astype(str).str.strip() == "Population, 2021"
            if mask.any():
                pop_row = df21[mask]
                break
    if not pop_row.empty:
        pop_row = pop_row.iloc[0]
        for col in neigh_cols_21:
            try:
                val = float(str(pop_row[col]).replace(",", "").replace("%", ""))
                records.setdefault(col, {})[2021] = val
            except (ValueError, TypeError):
                pass

    df = pd.DataFrame(records).T
    df = df[[y for y in [2001, 2006, 2011, 2016, 2021] if y in df.columns]]
    df = df.dropna(how="all")
    return df


