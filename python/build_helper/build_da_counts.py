import pandas as pd

MAPPING_PATH = r"C:\Users\Derek\wlucsa prod\torontoCensusVisualizer2\data\weights\da_to_neighbourhood_mapping 2.parquet"
LARGE_FILE_PATH = r"C:\Users\Derek\wlucsa prod\torontoCensusVisualizer2\python\build_helper\98-401-X2021006_English_CSV_data_Ontario.csv"

OUTPUT_FILE = r"C:\Users\Derek\wlucsa prod\torontoCensusVisualizer2\data\processed_2021_da_counts.csv"

da_map_df = pd.read_parquet(MAPPING_PATH)
toronto_dauids = set(da_map_df['DAUID'].astype(str).unique())
print(f"Targeting {len(toronto_dauids)} Dissemination Areas.")

relevant_data = []

# use ISO-8859-1 for StatCan special characters
reader = pd.read_csv(
    LARGE_FILE_PATH, 
    chunksize=100000, 
    usecols=['ALT_GEO_CODE', 'CHARACTERISTIC_ID', 'C1_COUNT_TOTAL'],
    dtype={'ALT_GEO_CODE': str},
    encoding='ISO-8859-1'
)

print("Starting extraction (this may take a few minutes)...")
for i, chunk in enumerate(reader):
    # CHARACTERISTIC_ID 1 = Population, 2021
    matches = chunk[
        (chunk['CHARACTERISTIC_ID'] == 1) & 
        (chunk['ALT_GEO_CODE'].isin(toronto_dauids))
    ]
    
    if not matches.empty:
        relevant_data.append(matches[['ALT_GEO_CODE', 'C1_COUNT_TOTAL']])
    
    if i % 10 == 0:
        print(f"  Processed {i * 100000} rows...")

if relevant_data:
    final_df = pd.concat(relevant_data).rename(columns={'ALT_GEO_CODE': 'DAUID'})
    final_df.to_csv(OUTPUT_FILE, index=False)
    print(f"\nSuccess! Created {OUTPUT_FILE} with {len(final_df)} rows.")
else:
    print("\nNo matches found. Double-check that your DAUIDs match the ALT_GEO_CODE format.")