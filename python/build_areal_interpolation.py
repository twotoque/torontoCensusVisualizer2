import os
import geopandas as gpd
import pandas as pd

old_gdf = gpd.read_file("/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson")
new_gdf = gpd.read_file("/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-158/Neighbourhoods.geojson")

old_gdf = old_gdf.to_crs("EPSG:32617")
new_gdf = new_gdf.to_crs("EPSG:32617")

intersection = gpd.overlay(old_gdf, new_gdf, how="intersection", keep_geom_type=False)
intersection["overlap_area"] = intersection.geometry.area

old_gdf["total_area"] = old_gdf.geometry.area
intersection = intersection.merge(
    old_gdf[["AREA_NAME", "total_area"]],
    left_on="AREA_NAME_1",
    right_on="AREA_NAME"
)
intersection["weight"] = intersection["overlap_area"] / intersection["total_area"]

out_path = "/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet"
os.makedirs(os.path.dirname(out_path), exist_ok=True)

weights = intersection[["AREA_NAME_1", "AREA_NAME_2", "weight"]].copy()

weights["AREA_NAME_1"] = weights["AREA_NAME_1"].str.replace(r'\s*\(\d+\)$', '', regex=True)
weights["AREA_NAME_2"] = weights["AREA_NAME_2"].str.replace(r'\s*\(\d+\)$', '', regex=True)

weights = weights[weights["weight"] > 0.001]

weights.to_parquet(out_path, index=False)
print(f"Saved {len(weights)} overlap pairs")