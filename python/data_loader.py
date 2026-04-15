# data_loader.py
# File I/O only. Reads and caches geojson + CSV.

import json
from functools import lru_cache

import geopandas as gpd
import pandas as pd
from pathlib import Path

BASE = Path("/app/data")

POPULATION_LABELS = {
    2021: "Population, 2021",  
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
    1996: (BASE / "2001/CityCensusData.csv",  "Attribute"), 
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
    Returns a DataFrame: index=neighbourhood (158 standard), columns=years [2001,2006,2011,2016,2021]
    Pre-2021 years are crosswalked from 140 -> 158 using weighted redistribution.
    2021 is native 158-standard.
    """
    cw = pd.read_parquet(BASE / "weights/140_to_158.parquet")
    # cw: AREA_NAME_1=140, AREA_NAME_2=158, weight

    def crosswalk_140_to_158(pop_dict: dict[str, float]) -> dict[str, float]:
        """
        Given {140_name: population}, return {158_name: weighted_population}.
        A 140 neighbourhood splits across 158 neighbourhoods proportionally by weight.
        Weights per 140 neighbourhood are already normalised in the parquet (sum to ~1).
        """
        result: dict[str, float] = {}
        for _, row in cw.iterrows():
            name_140 = row["AREA_NAME_1"]
            name_158 = row["AREA_NAME_2"]
            w        = row["weight"]
            if name_140 in pop_dict:
                result[name_158] = result.get(name_158, 0.0) + pop_dict[name_140] * w
        return result

    def extract_row(df: pd.DataFrame, label_col: str, label: str, skip: set) -> dict[str, float]:
        """Extract a population row from a census CSV into {neighbourhood: value}."""
        row = df[df[label_col].str.strip() == label]
        if row.empty:
            return {}
        row = row.iloc[0]
        out = {}
        for col in df.columns:
            if col in skip:
                continue
            try:
                out[col.strip()] = float(str(row[col]).replace(",", "").replace("%", ""))
            except (ValueError, TypeError):
                pass
        return out

    records: dict[str, dict[int, float]] = {}

    def merge(year: int, pop_158: dict[str, float]):
        for name, val in pop_158.items():
            records.setdefault(name, {})[year] = val

    # --- 2016 + 2011 from the 2016 CSV ---
    df16 = pd.read_csv(CENSUS_PATHS[2016][0])
    df16.columns = df16.columns.str.strip()
    skip16 = {"_id", "Category", "Topic", "Characteristic", "City of Toronto"}
    for year, label in [(2016, "Population, 2016"), (2011, "Population, 2011")]:
        raw = extract_row(df16, "Characteristic", label, skip16)
        merge(year, crosswalk_140_to_158(raw))

    # --- 2006 from the 2011 CSV ---
    df11 = pd.read_csv(CENSUS_PATHS[2011][0])
    df11.columns = df11.columns.str.strip()
    skip11 = {"_id", "Category", "Topic", "Attribute", "City of Toronto"}
    raw = extract_row(df11, "Attribute", "Population, 2006", skip11)
    merge(2006, crosswalk_140_to_158(raw))

 # --- 2001 + 1996 (both in the 2001 CSV) ---
    df01 = pd.read_csv(CENSUS_PATHS[2001][0])
    df01.columns = df01.columns.str.strip()
    skip01 = {"_id", "Category", "Topic", "Attribute", "City of Toronto"}
    for year, label in [
        (2001, "Population, 2001 - 100% Data"),
        (1996, "Population, 1996 - 100% Data"),
    ]:
        raw = extract_row(df01, "Attribute", label, skip01)
        merge(year, crosswalk_140_to_158(raw))

    # --- 2021 — already 158 standard, load directly ---
    df21 = pd.read_csv(CENSUS_PATHS[2021][0])
    df21.columns = df21.columns.str.strip()
    label_col = "Neighbourhood Name"
    skip21 = {label_col, "Neighbourhood Number", "TSNS 2020 Designation"}
    pop_mask = df21[label_col].astype(str).str.strip().str.startswith(
        "Total - Age groups of the population - 25%"
    )
    pop_row = df21[pop_mask]
    if pop_row.empty:
        pop_row = df21[df21[label_col].astype(str).str.strip().str.startswith("Total")]
    if not pop_row.empty:
        pop_row = pop_row.iloc[0]
        for col in df21.columns:
            if col in skip21:
                continue
            try:
                val = float(str(pop_row[col]).replace(",", "").replace("%", ""))
                records.setdefault(col.strip(), {})[2021] = val
            except (ValueError, TypeError):
                pass

    df = pd.DataFrame(records).T
    df = df[[y for y in [1996, 2001, 2006, 2011, 2016, 2021] if y in df.columns]]
    df = df.dropna(how="all")
    return df