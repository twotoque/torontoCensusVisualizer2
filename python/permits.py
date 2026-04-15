# permits.py
import pandas as pd
from pathlib import Path
from functools import lru_cache

ROOT_DIR = Path(__file__).resolve().parent.parent
BASE = ROOT_DIR / "data"

@lru_cache(maxsize=1)
def load_permits() -> pd.DataFrame:
    """Load and combine all permit CSVs, parse dates, normalize columns."""
    df1 = pd.read_csv(BASE / "permits-2000/Cleared Permits 2000 to 2016 1.csv", low_memory=False)
    df2 = pd.read_csv(BASE / "permits-2000/Cleared Permits 2000 to 2016 2.csv", low_memory=False)
    df3 = pd.read_csv(BASE / "permits-2017/Cleared Permits since 2017 1.csv", low_memory=False)
    df4 = pd.read_csv(BASE / "permits-2017/Cleared Permits since 2017 2.csv", low_memory=False)

    df3 = df3.drop(columns=["_id", "BUILDER_NAME"], errors="ignore")
    df4 = df4.drop(columns=["_id", "BUILDER_NAME"], errors="ignore")

    df = pd.concat([df1, df2, df3, df4], ignore_index=True)

    for col in ["APPLICATION_DATE", "ISSUED_DATE", "COMPLETED_DATE"]:
        df[col] = pd.to_datetime(df[col], errors="coerce")

    df["year"] = df["APPLICATION_DATE"].dt.year

    for col in ["DWELLING_UNITS_CREATED", "DWELLING_UNITS_LOST", "EST_CONST_COST"]:
        df[col] = pd.to_numeric(
            df[col].astype(str).str.replace(",", "").str.strip(),
            errors="coerce"
        ).fillna(0)

    # Attach neighbourhood via pre-built spatial lookup
    lookup = pd.read_parquet(BASE / "weights/permit_to_neighbourhood.parquet")
    df = df.merge(lookup[["PERMIT_NUM", "AREA_NAME"]], on="PERMIT_NUM", how="left")
    df = df.rename(columns={"AREA_NAME": "neighbourhood"})

    return df


@lru_cache(maxsize=1)
def load_permit_features() -> pd.DataFrame:
    """
    Aggregate permit data per (neighbourhood, year) into features.
    Returns a DataFrame indexed by (neighbourhood, year).
    """
    df = load_permits()
    df = df[df["APPLICATION_DATE"].notna() & df["neighbourhood"].notna()].copy()

    agg = df.groupby(["neighbourhood", "year"]).agg(
        permit_count        = ("PERMIT_NUM",             "count"),
        units_created       = ("DWELLING_UNITS_CREATED", "sum"),
        units_lost          = ("DWELLING_UNITS_LOST",    "sum"),
        total_cost          = ("EST_CONST_COST",         "sum"),
        residential_permits = ("RESIDENTIAL",            "sum"),
        demolition_permits  = ("DEMOLITION",             "sum"),
    ).reset_index()

    agg["net_units"] = agg["units_created"] - agg["units_lost"]
    agg = agg.set_index(["neighbourhood", "year"])
    return agg


def _get_permit_features_for(neighbourhood: str, year: float) -> dict:
    permit_df = load_permit_features()
    key = (neighbourhood, int(year))
    if key in permit_df.index:
        row = permit_df.loc[key]
        return {
            "permit_count":        float(row["permit_count"]),
            "units_created":       float(row["units_created"]),
            "units_lost":          float(row["units_lost"]),
            "net_units":           float(row["net_units"]),
            "total_cost":          float(row["total_cost"]),
            "residential_permits": float(row["residential_permits"]),
            "demolition_permits":  float(row["demolition_permits"]),
        }
    return {
        "permit_count": 0.0, "units_created": 0.0, "units_lost": 0.0,
        "net_units": 0.0, "total_cost": 0.0,
        "residential_permits": 0.0, "demolition_permits": 0.0,
    }