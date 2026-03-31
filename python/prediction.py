# prediction.py
# GP forecasting + SHAP for census variables across neighbourhoods.

import numpy as np
import pandas as pd
from functools import lru_cache
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import shap
from data_loader import load_population_series


def fit_gp(years: np.ndarray, values: np.ndarray):
    """Fit a Gaussian Process to (years, population) data."""
    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)

    # Normalise year to [0,1] for numerical stability
    X_norm = (X - X.min()) / (X.max() - X.min() + 1e-8)

    kernel = RBF(length_scale=0.5, length_scale_bounds=(0.1, 10)) \
           + WhiteKernel(noise_level=0.01, noise_level_bounds=(1e-5, 1))

    gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5, normalize_y=True)
    gp.fit(X_norm, y)
    return gp, X.min(), X.max()


def forecast(
    neighbourhood: str,
    forecast_years: list[int] = [2026, 2031],
) -> dict:
    """
    Returns GP forecast for a neighbourhood with confidence intervals.
    """
    pop_df = load_population_series()

    if neighbourhood not in pop_df.index:
        # fuzzy match
        matches = [n for n in pop_df.index if neighbourhood.lower() in n.lower()]
        if not matches:
            return {"error": f"Neighbourhood '{neighbourhood}' not found"}
        neighbourhood = matches[0]

    row = pop_df.loc[neighbourhood].dropna()
    years  = np.array(row.index.tolist(), dtype=float)
    values = np.array(row.values, dtype=float)

    gp, y_min, y_max = fit_gp(years, values)

    all_years = np.array(sorted(years.tolist() + forecast_years), dtype=float)
    X_norm = ((all_years - y_min) / (y_max - y_min + 1e-8)).reshape(-1, 1)
    y_pred, y_std = gp.predict(X_norm, return_std=True)

    # SHAP on a GBM trained on all neighbourhoods to explain year→population
    shap_values = _compute_shap(pop_df, neighbourhood, years, values)

    return {
        "neighbourhood": neighbourhood,
        "historical": {
            int(y): float(v) for y, v in zip(years, values)
        },
        "forecast": {
            int(y): {
                "mean":  round(float(m), 1),
                "lower": round(float(m - 1.96 * s), 1),
                "upper": round(float(m + 1.96 * s), 1),
            }
            for y, m, s in zip(all_years, y_pred, y_std)
            if int(y) in forecast_years
        },
        "gp_full": {
            "years":  [int(y) for y in all_years],
            "mean":   [round(float(m), 1) for m in y_pred],
            "lower":  [round(float(m - 1.96 * s), 1) for m, s in zip(y_pred, y_std)],
            "upper":  [round(float(m + 1.96 * s), 1) for m, s in zip(y_pred, y_std)],
        },
        "shap": shap_values,
    }


def _compute_shap(
    pop_df: pd.DataFrame,
    target_neighbourhood: str,
    years: np.ndarray,
    values: np.ndarray,
) -> dict:
    """
    Train a GBM across all neighbourhoods using year + neighbouhood size features.
    Return SHAP values for the target neighbourhood explaining each year's prediction.
    """
    rows = []
    for neigh, row in pop_df.iterrows():
        row = row.dropna()
        if len(row) < 2:
            continue
        y_arr = np.array(row.index.tolist(), dtype=float)
        v_arr = np.array(row.values, dtype=float)
        for i, (y, v) in enumerate(zip(y_arr, v_arr)):
            rows.append({
                "year":        y,
                "prev_pop":    v_arr[i - 1] if i > 0 else v,
                "growth_prev": (v - v_arr[i-1]) / (v_arr[i-1] + 1e-8) if i > 0 else 0.0,
                "population":  v,
            })

    train_df = pd.DataFrame(rows)
    features = ["year", "prev_pop", "growth_prev"]
    X_train  = train_df[features].values
    y_train  = train_df["population"].values

    gbm = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
    gbm.fit(X_train, y_train)

    # Build feature matrix for target neighbourhood
    target_rows = []
    for i, (y, v) in enumerate(zip(years, values)):
        target_rows.append({
            "year":        y,
            "prev_pop":    values[i - 1] if i > 0 else v,
            "growth_prev": (v - values[i-1]) / (values[i-1] + 1e-8) if i > 0 else 0.0,
        })
    X_target = pd.DataFrame(target_rows)[features].values

    explainer   = shap.TreeExplainer(gbm)
    shap_matrix = explainer.shap_values(X_target)

    return {
        "features": features,
        "years":    [int(y) for y in years],
        "values":   [
            {f: round(float(shap_matrix[i][j]), 2) for j, f in enumerate(features)}
            for i in range(len(years))
        ],
    }


def compare_neighbourhoods(
    neighbourhoods: list[str],
    forecast_years: list[int] = [2026, 2031],
) -> dict:
    """Forecast multiple neighbourhoods for comparison."""
    return {
        n: forecast(n, forecast_years)
        for n in neighbourhoods
    }