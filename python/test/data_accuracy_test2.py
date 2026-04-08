import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from data_loader import load_population_series
from prediction import fit_gp_da

''' Solely to test DA -> neighbourhood mapping accuracy, and the impact of using DA-level 2021 counts as GP anchors.

Backtesting holdout year: 2021

STABLE neighbourhoods:
  Within 95% CI: 17.5%
  Median MAPE:   70.5%
  Count: 120

SPLIT neighbourhoods:
  Within 95% CI: 55.6%
  Median MAPE:   155.6%
  Count: 36
  
  '''
BASE_PATH = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/data")
DA_COUNTS_PATH = BASE_PATH / "processed_2021_da_counts.csv"
DA_MAP_PATH = BASE_PATH / "weights/da_to_neighbourhood_mapping 2.parquet"
WEIGHTS_PATH = BASE_PATH / "weights/158_to_140.parquet"

da_counts = pd.read_csv(DA_COUNTS_PATH)
da_map = pd.read_parquet(DA_MAP_PATH)

da_map['DAUID'] = da_map['DAUID'].astype(str)
da_counts['DAUID'] = da_counts['DAUID'].astype(str)

da_joined = da_map.merge(da_counts, on='DAUID')
true_2021_totals = da_joined.groupby('AREA_NAME')['C1_COUNT_TOTAL'].sum()
da_joined = da_map.merge(da_counts, on='DAUID')
true_2021_totals = da_joined.groupby('AREA_NAME')['C1_COUNT_TOTAL'].sum()

HOLDOUT_YEAR = 2021 
df = load_population_series()
results = []

cw = pd.read_parquet(WEIGHTS_PATH)
stable_list = cw[cw['weight'] > 0.95]['AREA_NAME_1'].unique().tolist()

for neigh in df.index:

    row = df.loc[neigh].dropna()
    if HOLDOUT_YEAR not in row.index or len(row) < 3:
        continue
    
    actual = true_2021_totals.get(neigh, row[HOLDOUT_YEAR])
    
    train = row[row.index < HOLDOUT_YEAR]
    years  = np.array(train.index.tolist(), dtype=float)
    values = np.array(train.values, dtype=float)
    
    gp, y_min, y_max, y_scaler = fit_gp_da(
        years,
        values,
        neighbourhood_name=neigh,
        true_2021_value=actual
    )
    X_pred = np.array([[(HOLDOUT_YEAR - y_min) / (y_max - y_min + 1e-8)]])
    pred_scaled, std_scaled = gp.predict(X_pred, return_std=True)

    predicted_val = float(y_scaler.inverse_transform(pred_scaled.reshape(-1, 1))[0, 0])
    std_val       = float(std_scaled[0]) * float(y_scaler.scale_[0])


    results.append({
        "neighbourhood": neigh,
        "actual":        actual,
        "predicted":     predicted_val,
        "within_ci":     (predicted_val - 1.96 * std_val) <= actual <= (predicted_val + 1.96 * std_val),
        "pct_error":     abs(predicted_val - actual) / actual * 100 if actual > 0 else 0,
        "is_stable":     neigh in stable_list
    })
    

results_df = pd.DataFrame(results)


bad = results_df[results_df['pct_error'] > 50].sort_values('pct_error', ascending=False)
print(bad[['neighbourhood', 'actual', 'predicted', 'pct_error', 'is_stable']].head(20))

print("\nMean signed error (positive = overpredict):")
results_df['signed_error'] = (results_df['predicted'] - results_df['actual']) / results_df['actual'] * 100
print(results_df.groupby('is_stable')['signed_error'].describe())

print(f"Backtesting holdout year: {HOLDOUT_YEAR}")

print("\nSTABLE neighbourhoods:")
stable_df = results_df[results_df['is_stable']]
print(f"  Within 95% CI: {stable_df.within_ci.mean():.1%}")
print(f"  Median MAPE:   {stable_df.pct_error.median():.1f}%")
print(f"  Count: {len(stable_df)}")

print("\nSPLIT neighbourhoods:")
split_df = results_df[~results_df['is_stable']]
print(f"  Within 95% CI: {split_df.within_ci.mean():.1%}")
print(f"  Median MAPE:   {split_df.pct_error.median():.1f}%")
print(f"  Count: {len(split_df)}")