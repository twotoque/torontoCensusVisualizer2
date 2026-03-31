import os
import geopandas as gpd
import pandas as pd

old_gdf = gpd.read_file("/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson")
new_gdf = gpd.read_file("/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-158/Neighbourhoods.geojson")

old_gdf = old_gdf.to_crs("EPSG:32617")
new_gdf = new_gdf.to_crs("EPSG:32617")

intersection = gpd.overlay(old_gdf, new_gdf, how="intersection", keep_geom_type=False)
intersection["overlap_area"] = intersection.geometry.area

out_dir = "/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights"
os.makedirs(out_dir, exist_ok=True)

def clean_names(df):
    df["AREA_NAME_1"] = df["AREA_NAME_1"].str.replace(r'\s*\(\d+\)$', '', regex=True)
    df["AREA_NAME_2"] = df["AREA_NAME_2"].str.replace(r'\s*\(\d+\)$', '', regex=True)
    return df

#  158→158: what fraction of each NEW neighbourhood comes from each OLD one 
# e.g. Agincourt North (2021) = 95% Agincourt North (2016) + 5% Agincourt South (2016)
new_gdf["total_area"] = new_gdf.geometry.area
new_weights = intersection.merge(
    new_gdf[["AREA_NAME", "total_area"]],
    left_on="AREA_NAME_2", right_on="AREA_NAME"
).copy()
new_weights["weight"] = new_weights["overlap_area"] / new_weights["total_area"]
new_weights = clean_names(new_weights[["AREA_NAME_1", "AREA_NAME_2", "weight"]])
new_weights = new_weights[new_weights["weight"] > 0.001]
new_weights.to_parquet(f"{out_dir}/140_to_158.parquet", index=False)
print(f"Saved 140_to_158 ({len(new_weights)} pairs): weights sum to 1 per NEW neighbourhood")
print(new_weights.groupby("AREA_NAME_2")["weight"].sum().describe())

#  inverse: what fraction of each OLD neighbourhood goes into each NEW one 
# e.g. Agincourt North (2016) → 60% into Agincourt North (2021), 40% into Milliken (2021)
old_gdf["total_area"] = old_gdf.geometry.area
old_weights = intersection.merge(
    old_gdf[["AREA_NAME", "total_area"]],
    left_on="AREA_NAME_1", right_on="AREA_NAME"
).copy()
old_weights["weight"] = old_weights["overlap_area"] / old_weights["total_area"]
old_weights = clean_names(old_weights[["AREA_NAME_1", "AREA_NAME_2", "weight"]])
old_weights = old_weights[old_weights["weight"] > 0.001]
old_weights.to_parquet(f"{out_dir}/158_to_140.parquet", index=False)
print(f"\nSaved 158_to_140 ({len(old_weights)} pairs): weights sum to 1 per OLD neighbourhood")
print(old_weights.groupby("AREA_NAME_1")["weight"].sum().describe())