import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd
from data_loader import load_population_series
from prediction import fit_gp  

BASE_PATH = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/data")

PARQUETS = {
    "baseline":        BASE_PATH / "weights/140_to_158.parquet",
    "permit_weighted": BASE_PATH / "weights/140_to_158_permit_weighted.parquet",
}


def main():
    df = load_population_series()

    output_file = "results_output.txt"
    with open(output_file, "w") as f:
        f.write("GP Prediction Results Summary\n")

    for parquet_name, parquet_path in PARQUETS.items():
        cw = pd.read_parquet(parquet_path)
        stable_list = cw[cw["weight"] > 0.95]["AREA_NAME_1"].unique().tolist()

        for HOLDOUT_YEAR in [2016, 2021]:
            results = []

            for neigh in df.index:
                row = df.loc[neigh].dropna()
                if HOLDOUT_YEAR not in row.index or len(row) < 3:
                    continue

                actual = row[HOLDOUT_YEAR]
                train  = row[row.index < HOLDOUT_YEAR]
                years  = np.array(train.index.tolist(), dtype=float)
                values = np.array(train.values, dtype=float)

                try:
                    gp, y_min, y_max = fit_gp(years, values)
                except Exception:
                    continue

                # Normalize the holdout year the same way fit_gp does
                X_pred = np.array([[(HOLDOUT_YEAR - y_min) / (y_max - y_min + 1e-8)]])
                pred, std = gp.predict(X_pred, return_std=True)

                # normalize_y=True means pred is already in population units: no inverse transform needed
                predicted = float(pred[0])
                std_val   = float(std[0])   

                results.append({
                    "neighbourhood": neigh,
                    "actual":        actual,
                    "predicted":     predicted,
                    "within_ci":     (predicted - 1.96 * std_val) <= actual <= (predicted + 1.96 * std_val),
                    "pct_error":     abs(predicted - actual) / actual * 100 if actual > 0 else 0,
                    "is_stable":     neigh in stable_list,
                })

            results_df = pd.DataFrame(results)
            stable_df  = results_df[results_df["is_stable"]]
            split_df   = results_df[~results_df["is_stable"]]

            header = f"\n{'='*60}"
            meta   = f"Parquet: {parquet_name}  |  Holdout: {HOLDOUT_YEAR}"
            stable_res = (f"  STABLE (n={len(stable_df)}):  "
                          f"CI={stable_df.within_ci.mean():.1%}  "
                          f"Median MAPE={stable_df.pct_error.median():.1f}%")
            split_res  = (f"  SPLIT  (n={len(split_df)}):  "
                          f"CI={split_df.within_ci.mean():.1%}  "
                          f"Median MAPE={split_df.pct_error.median():.1f}%")

            print(header)
            print(meta)
            print(stable_res)
            print(split_res)

            with open(output_file, "a") as f:
                f.write(f"{header}\n{meta}\n{stable_res}\n{split_res}\n")


if __name__ == "__main__":
    main()