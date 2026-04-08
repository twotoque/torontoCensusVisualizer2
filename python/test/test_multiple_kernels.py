# test_multiple_kernels.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd

class TeeLogger:
    def __init__(self, filename):
        self.terminal = sys.stdout
        self.log = open(filename, "w", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()

from data_loader import load_population_series
from prediction_multi_kernel import fit_gp_with_kernel, KERNEL_CONFIGS

BASE_PATH    = Path(__file__).resolve().parent.parent.parent / "data"
WEIGHTS_PATH = BASE_PATH / "weights/158_to_140.parquet"


def run_backtest(holdout_year: int, kernel_type: str, df: pd.DataFrame, stable_list: list[str]) -> list[dict]:
    """
    Train on census years < holdout_year, predict holdout_year.
    Uses raw weighted census values for both 2016 and 2021 (no DA anchor).
    Uses fit_gp_with_kernel.
    Requires at least 2 training points.
    """
    results = []

    for neigh in df.index:
        row = df.loc[neigh].dropna()

        train = row[row.index < holdout_year]
        if holdout_year not in row.index or len(train) < 2:
            continue

        actual = float(row[holdout_year])
        years  = np.array(train.index.tolist(), dtype=float)
        values = np.array(train.values, dtype=float)

        try:
            gp, x_min, x_max = fit_gp_with_kernel(years, values, kernel_type=kernel_type)

            X_pred = np.array([[(holdout_year - x_min) / (x_max - x_min + 1e-8)]])
            pred, std = gp.predict(X_pred, return_std=True)

            predicted_val = float(pred[0])
            std_val       = float(std[0])

            results.append({
                "neighbourhood": neigh,
                "actual":        actual,
                "predicted":     predicted_val,
                "signed_error":  (predicted_val - actual) / actual * 100 if actual > 0 else 0,
                "within_ci":     (predicted_val - 1.96 * std_val) <= actual <= (predicted_val + 1.96 * std_val),
                "pct_error":     abs(predicted_val - actual) / actual * 100 if actual > 0 else 0,
                "is_stable":     neigh in stable_list,
            })
        except Exception as e:
            print(f"  [ERROR] {holdout_year} | {kernel_type} | {neigh}: {e}")

    return results


def print_summary(label: str, results: list[dict]):
    if not results:
        print(f"    {label}: NO RESULTS")
        return
    rdf = pd.DataFrame(results)
    stable = rdf[rdf["is_stable"]]
    split  = rdf[~rdf["is_stable"]]

    for group_label, group in [("STABLE", stable), ("SPLIT", split)]:
        print(
            f"      {group_label} ({len(group)}):  "
            f"CI={group.within_ci.mean():.1%}  "
            f"Median MAPE={group.pct_error.median():.1f}%  "
            f"Mean MAPE={group.pct_error.mean():.1f}%  "
            f"Signed={group.signed_error.mean():.1f}%"
        )


if __name__ == "__main__":
    if not WEIGHTS_PATH.exists():
        print(f"ERROR: weights file not found: {WEIGHTS_PATH}", file=sys.stderr)
        sys.exit(1)

    df  = load_population_series()
    cw  = pd.read_parquet(WEIGHTS_PATH)
    stable_list = cw[cw["weight"] > 0.95]["AREA_NAME_1"].unique().tolist()

    log_file = "kernel_test_results.txt"
    logger = TeeLogger(log_file)
    original_stdout = sys.stdout
    sys.stdout = logger
    try:
        print("=" * 80)
        print("Weighted Census Backtest  |  2016 vs 2021  |  fit_gp_with_kernel (no anchor)")
        print("Both holdouts use raw weighted census actuals. No DA data.")
        print("=" * 80)

        for kernel_type, cfg in KERNEL_CONFIGS.items():
            if kernel_type == "polynomial":
                continue

            r2016 = run_backtest(2016, kernel_type, df, stable_list)
            r2021 = run_backtest(2021, kernel_type, df, stable_list)

            print(f"\n{'─' * 60}")
            print(f"Kernel : {cfg['name']}")
            print(f"Desc   : {cfg['description']}")

            print(f"  Holdout 2016  (train ≤2011, weighted census actual):")
            print_summary("2016", r2016)

            print(f"  Holdout 2021  (train ≤2016, weighted census actual):")
            print_summary("2021", r2021)

        print("\n" + "=" * 80)
    finally:
        logger.log.close()
        sys.stdout = original_stdout

    print(f"Done! Results saved to {log_file}")