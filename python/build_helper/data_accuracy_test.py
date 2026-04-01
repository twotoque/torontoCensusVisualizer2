import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data_loader import load_population_series
from prediction import fit_gp
import numpy as np
import pandas as pd

'''
Test- March 31 2026

2021 
STABLE neighbourhoods (existed in 140 standard):
  Within 95% CI: 64.2%
  Median MAPE:   3.3%
  Mean MAPE:     4.4%
  Count: 120
SPLIT neighbourhoods (new in 158 standard):
  Within 95% CI: 5.6%
  Median MAPE:   89.1%
  Mean MAPE:     105.4%
  Count: 36

2016
STABLE neighbourhoods (existed in 140 standard):
  Within 95% CI: 69.2%
  Median MAPE:   3.2%
  Mean MAPE:     4.7%
  Count: 120
SPLIT neighbourhoods (new in 158 standard):
  Within 95% CI: 52.8%
  Median MAPE:   11.6%
  Mean MAPE:     13.8%
  Count: 36
'''
HOLDOUT_YEAR = 2021 

df = load_population_series()
results = []

for neigh in df.index:
    row = df.loc[neigh].dropna()
    if HOLDOUT_YEAR not in row.index or len(row) < 3:
        continue
    
    train = row[row.index < HOLDOUT_YEAR]
    actual = row[HOLDOUT_YEAR]
    
    years  = np.array(train.index.tolist(), dtype=float)
    values = np.array(train.values, dtype=float)
    
    gp, y_min, y_max = fit_gp(years, values)
    
    X_pred = np.array([[(HOLDOUT_YEAR - y_min) / (y_max - y_min + 1e-8)]])
    mean, std = gp.predict(X_pred, return_std=True)
    
    results.append({
        "neighbourhood": neigh,
        "actual":        actual,
        "predicted":     float(mean[0]),
        "lower":         float(mean[0] - 1.96 * std[0]),
        "upper":         float(mean[0] + 1.96 * std[0]),
        "within_ci":     float(mean[0] - 1.96 * std[0]) <= actual <= float(mean[0] + 1.96 * std[0]),
        "pct_error":     abs(float(mean[0]) - actual) / actual * 100,
    })

results_df = pd.DataFrame(results)
cw = pd.read_parquet('/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/158_to_140.parquet')
stable = cw[cw['weight'] > 0.95].groupby('AREA_NAME_1').first().index.tolist()

results_df['is_stable'] = results_df['neighbourhood'].isin(stable)

print(f"Backtesting holdout year: {HOLDOUT_YEAR}")

print("\nSTABLE neighbourhoods (existed in 140 standard):")
stable_df = results_df[results_df['is_stable']]
print(f"  Within 95% CI: {stable_df.within_ci.mean():.1%}")
print(f"  Median MAPE:   {stable_df.pct_error.median():.1f}%")
print(f"  Mean MAPE:     {stable_df.pct_error.mean():.1f}%")
print(f"  Count: {len(stable_df)}")

print("\nSPLIT neighbourhoods (new in 158 standard):")
split_df = results_df[~results_df['is_stable']]
print(f"  Within 95% CI: {split_df.within_ci.mean():.1%}")
print(f"  Median MAPE:   {split_df.pct_error.median():.1f}%")
print(f"  Mean MAPE:     {split_df.pct_error.mean():.1f}%")
print(f"  Count: {len(split_df)}")