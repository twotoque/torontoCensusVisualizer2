import pandas as pd
import geopandas as gpd
from pathlib import Path
from functools import lru_cache

BASE = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/data")

@lru_cache(maxsize=1)
def load_permits() -> pd.DataFrame:
    """Load and combine both permit CSVs, parse dates, normalize columns."""
    
    df1 = pd.concat([
        pd.read_csv(BASE / "permits-2000/Cleared Permits 2000 to 2016 1.csv"),
        pd.read_csv(BASE / "permits-2000/Cleared Permits 2000 to 2016 2.csv"),
    ], ignore_index=True)

    df2 = pd.concat([
        pd.read_csv(BASE / "permits-2017/Cleared Permits since 2017 1.csv"),
        pd.read_csv(BASE / "permits-2017/Cleared Permits since 2017 2.csv"),
    ], ignore_index=True)
    
    df2 = df2.drop(columns=["_id", "BUILDER_NAME"], errors="ignore")
    
    df = pd.concat([df1, df2], ignore_index=True)
    
    for col in ["APPLICATION_DATE", "ISSUED_DATE", "COMPLETED_DATE"]:
        df[col] = pd.to_datetime(df[col], errors="coerce")
    
    df["year"] = df["APPLICATION_DATE"].dt.year
    
    # Clean numeric columns
    for col in ["DWELLING_UNITS_CREATED", "DWELLING_UNITS_LOST", "EST_CONST_COST"]:
        df[col] = pd.to_numeric(
            df[col].astype(str).str.replace(",", "").str.strip(),
            errors="coerce"
        ).fillna(0)
    
    return df
