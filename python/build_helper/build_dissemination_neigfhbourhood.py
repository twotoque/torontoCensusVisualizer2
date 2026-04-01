import geopandas as gpd

da_path = r'\torontoCensusVisualizer2\data\dissemination-boundary\lda_000a21a_e.shp'
das = gpd.read_file(da_path)

ontario_das = das[das['PRUID'] == '35'].copy()

hood_158_path = r'\torontoCensusVisualizer2\data\neighbourhood-158\Neighbourhoods.geojson'
hoods_158 = gpd.read_file(hood_158_path)

# check and match the CRS
if ontario_das.crs != hoods_158.crs:
    print(f"Reprojecting DAs from {ontario_das.crs} to {hoods_158.crs}...")
    ontario_das = ontario_das.to_crs(hoods_158.crs)

# perform the Spatial Join again
mapping_158 = gpd.sjoin(ontario_das, hoods_158, how="inner", predicate="within")

print(f"Successfully mapped {len(mapping_158)} DAs to the 158-Neighbourhood system.")

output_path = r'\torontoCensusVisualizer2\data\da_to_neighbourhood_mapping.parquet'
mapping_158.to_parquet(output_path)
print(f"Mapping saved to: {output_path}")