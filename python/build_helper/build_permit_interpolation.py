import os
import json
import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point

BASE = "/Users/dereksong/Documents/torontoCensusVisualizer2/data"

p20001 = pd.read_csv(f"{BASE}/permits-2000/Cleared Permits 2000 to 2016 1.csv", low_memory=False)
p20002 = pd.read_csv(f"{BASE}/permits-2000/Cleared Permits 2000 to 2016 2.csv", low_memory=False)
p20171 = pd.read_csv(f"{BASE}/permits-2017/Cleared Permits since 2017 1.csv",   low_memory=False)
p20172 = pd.read_csv(f"{BASE}/permits-2017/Cleared Permits since 2017 2.csv",   low_memory=False)

for df in [p20001, p20002, p20171, p20172]:
    df.columns = df.columns.str.strip()

permits = pd.concat([p20001, p20002, p20171, p20172], ignore_index=True)

permits["DWELLING_UNITS_CREATED"] = pd.to_numeric(
    permits["DWELLING_UNITS_CREATED"].astype(str).str.replace(",", ""), errors="coerce"
).fillna(0)

residential_mask = (
    permits["RESIDENTIAL"].fillna(0).astype(str).str.strip() == "1"
) | (permits["DWELLING_UNITS_CREATED"] > 0)

res_permits = permits[residential_mask].copy()

def parse_coords(g):
    try:
        coords = json.loads(g)["coordinates"][0]
        return Point(coords[0], coords[1])
    except:
        return None

addr = pd.read_csv(f"{BASE}/address/address1.csv", low_memory=False)
addr["geometry"] = addr["geometry"].apply(parse_coords)
addr_gdf = gpd.GeoDataFrame(addr.dropna(subset=["geometry"]), geometry="geometry", crs="EPSG:4326")
addr_gdf["GEO_ID"] = pd.to_numeric(addr_gdf["ADDRESS_POINT_ID"], errors="coerce")

res_permits["GEO_ID"] = pd.to_numeric(
    res_permits["GEO_ID"].astype(str).str.replace(",", ""), errors="coerce"
)

permit_pts = res_permits.merge(addr_gdf[["GEO_ID", "geometry"]], on="GEO_ID", how="inner")
permit_gdf = gpd.GeoDataFrame(permit_pts, geometry="geometry", crs="EPSG:4326").to_crs("EPSG:32617")

# Find unmatched permits
already_matched_idx = set(permit_pts.index)  # permit_pts is the result of the GEO_ID merge
unmatched = res_permits[
    ~res_permits.index.isin(already_matched_idx)
].copy()


def normalize_street(s):
    return s.astype(str).str.strip().str.upper().str.replace(r'\s+', ' ', regex=True)

unmatched["STREET_NUM_N"] = pd.to_numeric(unmatched["STREET_NUM"], errors="coerce")
unmatched["STREET_NAME_N"] = normalize_street(unmatched["STREET_NAME"])
unmatched["STREET_TYPE_N"] = normalize_street(unmatched["STREET_TYPE"].fillna(""))

addr_gdf["STREET_NUM_N"] = pd.to_numeric(addr_gdf["LO_NUM"], errors="coerce")
addr_gdf["STREET_NAME_N"] = normalize_street(addr_gdf["LINEAR_NAME"])
addr_gdf["STREET_TYPE_N"] = normalize_street(addr_gdf["LINEAR_NAME_TYPE"].fillna(""))

# Join on number + name + type (most precise)
unmatched_reset = unmatched.reset_index().rename(columns={"index": "orig_idx"})

fallback = unmatched_reset.merge(
    addr_gdf[["STREET_NUM_N", "STREET_NAME_N", "STREET_TYPE_N", "geometry"]].drop_duplicates(
        subset=["STREET_NUM_N", "STREET_NAME_N", "STREET_TYPE_N"]
    ),
    on=["STREET_NUM_N", "STREET_NAME_N", "STREET_TYPE_N"],
    how="inner"
)
# Deduplicate on original permit index : one geocode per permit
fallback = fallback.drop_duplicates(subset=["orig_idx"], keep="first")
print(f"Recovered via street match (num+name+type): {len(fallback)}")

# Loose match only for permits still unmatched
matched_orig_idxs = set(fallback["orig_idx"])
still_unmatched = unmatched_reset[~unmatched_reset["orig_idx"].isin(matched_orig_idxs)]

fallback_loose = still_unmatched.merge(
    addr_gdf[["STREET_NUM_N", "STREET_NAME_N", "geometry"]].drop_duplicates(
        subset=["STREET_NUM_N", "STREET_NAME_N"]
    ),
    on=["STREET_NUM_N", "STREET_NAME_N"],
    how="inner"
)
fallback_loose = fallback_loose.drop_duplicates(subset=["orig_idx"], keep="first")
print(f"Recovered via street match (num+name only): {len(fallback_loose)}")

# drop the orig_idx tracking column before concat
fallback_combined = gpd.GeoDataFrame(
    pd.concat([
        fallback.drop(columns=["orig_idx"]), 
        fallback_loose.drop(columns=["orig_idx"])
    ], ignore_index=True),
    geometry="geometry", crs="EPSG:4326"
)

permit_gdf_4326 = permit_gdf.to_crs("EPSG:4326")
permit_gdf_full = gpd.GeoDataFrame(
    pd.concat([permit_gdf_4326, fallback_combined], ignore_index=True),
    geometry="geometry",
    crs="EPSG:4326"
).to_crs("EPSG:32617")

permit_gdf_full = gpd.GeoDataFrame(
    pd.concat([permit_gdf_4326, fallback_combined], ignore_index=True),
    geometry="geometry",
    crs="EPSG:4326"
).to_crs("EPSG:32617")

print(f"\nTotal geocoded permits (all methods): {len(permit_gdf_full):,}")
print(f"Coverage: {len(permit_gdf_full)/len(res_permits)*100:.1f}%")

print(f"Geocoded permits: {len(permit_gdf):,}")
print(f"Unique addresses in unmatched: {unmatched.drop_duplicates(subset=['STREET_NUM', 'STREET_NAME', 'STREET_TYPE']).shape[0]}")
print(f"Total unmatched permits: {len(unmatched)}")
print(f"fallback + fallback_loose: {len(fallback) + len(fallback_loose)}")

def clean(s):
    return s.str.replace(r'\s*\(\d+\)$', '', regex=True).str.strip()

old_gdf = gpd.read_file(f"{BASE}/neighbourhood-140/Neighbourhoods.geojson").to_crs("EPSG:32617")
new_gdf = gpd.read_file(f"{BASE}/neighbourhood-158/Neighbourhoods.geojson").to_crs("EPSG:32617")
old_gdf["AREA_NAME"] = clean(old_gdf["AREA_NAME"])
new_gdf["AREA_NAME"] = clean(new_gdf["AREA_NAME"])

# Spatial joins
joined_old = gpd.sjoin(
    permit_gdf_full[["geometry", "DWELLING_UNITS_CREATED"]],
    old_gdf[["AREA_NAME", "geometry"]].rename(columns={"AREA_NAME": "OLD_NBHD"}),
    how="left",
    predicate="within"
).drop(columns=["index_right"], errors="ignore").reset_index(drop=True)

joined_both = gpd.sjoin(
    joined_old[["geometry", "DWELLING_UNITS_CREATED", "OLD_NBHD"]],
    new_gdf[["AREA_NAME", "geometry"]].rename(columns={"AREA_NAME": "NEW_NBHD"}),
    how="left",
    predicate="within"
).drop(columns=["index_right"], errors="ignore").reset_index(drop=True)

# Aggregate permit units per (old, new) pair
pair_units = (
    joined_both.dropna(subset=["OLD_NBHD", "NEW_NBHD"])
    .groupby(["OLD_NBHD", "NEW_NBHD"])["DWELLING_UNITS_CREATED"]
    .sum()
    .reset_index()
    .rename(columns={"DWELLING_UNITS_CREATED": "permit_units"})
)

print(f"Permit pairs found: {len(pair_units)}")
print(pair_units.sort_values("permit_units", ascending=False).head(10))

# Build area weights w permit weights
old_gdf["total_area"] = old_gdf.geometry.area

intersection = gpd.overlay(old_gdf, new_gdf, how="intersection", keep_geom_type=False)
intersection["overlap_area"] = intersection.geometry.area

# total_area is already on intersection because old_gdf had it before overlay

area_w = intersection[["AREA_NAME_1", "AREA_NAME_2", "overlap_area", "total_area"]].copy()
area_w["AREA_NAME_1"] = clean(area_w["AREA_NAME_1"])
area_w["AREA_NAME_2"] = clean(area_w["AREA_NAME_2"])
area_w["area_weight"] = area_w["overlap_area"] / area_w["total_area"]

# Blend area + permit weight
merged = area_w.merge(
    pair_units.rename(columns={"OLD_NBHD": "AREA_NAME_1", "NEW_NBHD": "AREA_NAME_2"}),
    on=["AREA_NAME_1", "AREA_NAME_2"],
    how="left"
)
merged["permit_units"] = merged["permit_units"].fillna(0)

total_units = merged.groupby("AREA_NAME_1")["permit_units"].transform("sum")
merged["permit_weight"] = np.where(
    total_units > 0,
    merged["permit_units"] / total_units,
    merged["area_weight"]  # fallback for neighbourhoods with zero permits
)

ALPHA = 0.5  # 0=pure area, 1=pure permit
merged["weight"] = ALPHA * merged["permit_weight"] + (1 - ALPHA) * merged["area_weight"]

# Renormalize per old neighbourhood
total_w = merged.groupby("AREA_NAME_1")["weight"].transform("sum")
merged["weight"] = merged["weight"] / total_w


out = merged[merged["weight"] > 0.001][["AREA_NAME_1", "AREA_NAME_2", "weight"]]
os.makedirs(f"{BASE}/weights", exist_ok=True)
out.to_parquet(f"{BASE}/weights/140_to_158_permit_weighted.parquet", index=False)

print(f"\nSaved {len(out)} pairs")
print(out.groupby("AREA_NAME_1")["weight"].sum().describe())
all_geocoded_orig_idxs = set(permit_pts.index) | set(fallback["orig_idx"]) | set(fallback_loose["orig_idx"])
truly_unmatched = res_permits[~res_permits.index.isin(all_geocoded_orig_idxs)]
print(truly_unmatched["APPLICATION_DATE"].str[:4].value_counts().sort_index())
