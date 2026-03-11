"""
shp_to_geojson.py
Converts a shapefile to a GeoJSON file compatible with torontoCensusVisualizer
Helper file; does not run as part of the app. 

While this app only calls for a .shp file as its params, you'll require all of the
WGS84 shapefile components (.shp, .shx, .dbf, .prj) in the same directory for it to work.

Usage:
    python3 shp_to_geojson.py <input.shp> <output.geojson>

Example:
    python3 shp_to_geojson.py icitw_wgs84.shp data/2016/CityWards.geojson
"""

import sys
import json
from pathlib import Path

try:
    import geopandas as gpd
except ImportError:
    print("geopandas not found. (pip install geopandas)")
    sys.exit(1)


def convert(shp_path: str, out_path: str) -> None:
    shp = Path(shp_path)
    out = Path(out_path)

    if not shp.exists():
        print(f"File not found: {shp}")
        sys.exit(1)

    print(f"Reading {shp} ...")
    gdf = gpd.read_file(shp)

    # Print info so you can verify columns
    print(f"\nLoaded {len(gdf)} features")
    print(f"    CRS: {gdf.crs}")
    print(f"    Columns: {gdf.columns.tolist()}")
    print(f"\n    Preview:")
    print(gdf.drop(columns="geometry").head(3).to_string(index=False))
    print()

    # Reproject to WGS84 if needed (Plotly requires lat/lon)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"Reprojecting from {gdf.crs} → EPSG:4326 ...")
        gdf = gdf.to_crs("EPSG:4326")
    else:
        print("Already in WGS84, no reprojection needed.")

    out.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing {out} ...")
    gdf.to_file(out, driver="GeoJSON")

    with open(out) as f:
        geojson = json.load(f)
    feature_count = len(geojson.get("features", []))
    print(f"Done! {feature_count} features written to {out}")
    print()
    print("Next step — add to census_registry.py:")
    print(f'    "wards": "{out.resolve()}",')


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    convert(sys.argv[1], sys.argv[2])