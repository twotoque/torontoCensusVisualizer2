import geopandas as gpd
import pandas as pd
from pathlib import Path

BASE = Path("data")
FILE_140 = BASE / "neighbourhood-140/Neighbourhoods.geojson"
FILE_158 = BASE / "neighbourhood-158/Neighbourhoods.geojson"

def clean_name(s):
    """Removes trailing ID numbers in parentheses, e.g., 'Annex (62)' -> 'Annex'"""
    return s.str.replace(r'\s*\(\d+\)$', '', regex=True).str.strip()

def get_stats(gdf, label):
    """Calculates area and basic descriptive statistics."""
    gdf_metric = gdf.to_crs(epsg=26917)
    areas = gdf_metric.geometry.area / 1e6
    
    stats = {
        "System": label,
        "Count": len(gdf),
        "Total Area (km2)": areas.sum(),
        "Mean Area (km2)": areas.mean(),
        "Median Area (km2)": areas.median(),
        "Min Area (km2)": areas.min(),
        "Max Area (km2)": areas.max(),
        "Std Dev": areas.std()
    }
    return stats, areas

try:
    gdf140 = gpd.read_file(FILE_140)
    gdf158 = gpd.read_file(FILE_158)

    gdf140["NAME_CLEAN"] = clean_name(gdf140["AREA_NAME"])
    gdf158["NAME_CLEAN"] = clean_name(gdf158["AREA_NAME"])

    s140, a140 = get_stats(gdf140, "140 System")
    s158, a158 = get_stats(gdf158, "158 System")

    df_stats = pd.DataFrame([s140, s158]).set_index("System").T
    
    print("--- NEIGHBOURHOOD SYSTEM STATISTICAL SUMMARY ---")
    print(df_stats.round(3))

    names140 = set(gdf140["NAME_CLEAN"])
    names158 = set(gdf158["NAME_CLEAN"])
    
    shared = names140.intersection(names158)
    only_140 = names140 - names158
    only_158 = names158 - names140

    print("\n--- NAME OVERLAP ANALYSIS ---")
    print(f"Unique Names in 140: {len(names140)}")
    print(f"Unique Names in 158: {len(names158)}")
    print(f"Shared Names:        {len(shared)}")
    print(f"Names Removed/Moved: {len(only_140)}")
    print(f"Names Added/New:     {len(only_158)}")

    if only_158:
        print("\nNew/Renamed in 158:")
        print(sorted(list(only_158)))

except Exception as e:
    print(f"Error loading files: {e}")