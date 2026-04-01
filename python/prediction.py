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
from permits import load_permits

import pyarrow.parquet as pq
from pathlib import Path

CROSSWALK_PATH = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet")

def normalize_neighbourhood(name: str) -> str:
    return name  

@lru_cache(maxsize=1)
def load_permit_features() -> pd.DataFrame:
    """
    Aggregate permit data per (neighbourhood, year) into features for SHAP.
    Uses WARD_GRID as a neighbourhood proxy since permits don't have neighbourhood names.
    Returns a DataFrame indexed by (neighbourhood, year).
    """
    df = load_permits()

    df = df[df["APPLICATION_DATE"].notna()].copy()
    df["year"] = df["APPLICATION_DATE"].dt.year

    agg = df.groupby(["WARD_GRID", "year"]).agg(
        permit_count        = ("PERMIT_NUM",            "count"),
        units_created       = ("DWELLING_UNITS_CREATED","sum"),
        units_lost          = ("DWELLING_UNITS_LOST",   "sum"),
        total_cost          = ("EST_CONST_COST",        "sum"),
        residential_permits = ("RESIDENTIAL",           "sum"),
        demolition_permits  = ("DEMOLITION",            "sum"),
    ).reset_index()

    agg["net_units"] = agg["units_created"] - agg["units_lost"]

    agg = agg.set_index(["WARD_GRID", "year"])
    return agg


def _get_permit_features_for(neighbourhood: str, year: float) -> dict:
    permit_df = load_permit_features()
    key = (neighbourhood, int(year))
    if key in permit_df.index:
        row = permit_df.loc[key]
        return {
            "permit_count":        float(row["permit_count"]),
            "units_created":       float(row["units_created"]),
            "units_lost":          float(row["units_lost"]),
            "net_units":           float(row["net_units"]),
            "total_cost":          float(row["total_cost"]),
            "residential_permits": float(row["residential_permits"]),
            "demolition_permits":  float(row["demolition_permits"]),
        }
    return {
        "permit_count": 0.0, "units_created": 0.0, "units_lost": 0.0,
        "net_units": 0.0, "total_cost": 0.0,
        "residential_permits": 0.0, "demolition_permits": 0.0,
    }

def fit_gp_da(years, values, neighbourhood_name):
    """
    Enhanced GP fitting using DA-interpolated ground truth and permit trends.
    Uses the da_to_neighbourhood_mapping to validate the 2021 anchor.
    """
    da_map = pd.read_parquet(r'C:\Users\Derek\wlucsa prod\torontoCensusVisualizer2\data\weights\da_to_neighbourhood_mapping.parquet')
    permit_data = pd.read_parquet(r'C:\Users\Derek\wlucsa prod\torontoCensusVisualizer2\data\weights\permit_to_neighbourhood.parquet')
    
    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)
    X_norm = (X - X.min()) / (X.max() - X.min() + 1e-8)

    # if the neighbourhood exists in our DA mapping, 
    # we treat the 2021 data point as high-confidence (low alpha).
    # historial points (pre-2021) get slightly higher alpha to allow for trend smoothing.
    is_in_da_map = neighbourhood_name in da_map['AREA_NAME'].unique()
    
    if is_in_da_map:
        # High confidence in 2021 (DA-derived), moderate confidence in historical
        alpha = np.where(years == 2021, 1e-6, 0.1) 
    else:
        # Standard noise for stable areas
        alpha = 1e-10

    kernel = RBF(length_scale=0.5, length_scale_bounds=(0.1, 10)) \
           + WhiteKernel(noise_level=0.01, noise_level_bounds=(1e-5, 0.5))

    gp = GaussianProcessRegressor(
        kernel=kernel, 
        alpha=alpha, 
        n_restarts_optimizer=10, 
        normalize_y=True
    )
    
    gp.fit(X_norm, y)
    return gp, X.min(), X.max()

def fit_gp_per_sample(years, values, is_stable=True):
    """Fit a Gaussian Process to (years, population) data."""
    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)
    X_norm = (X - X.min()) / (X.max() - X.min() + 1e-8)

    if not is_stable:
        # Higher noise on pre-2021 synthetic points, lower on 2021 actual
        alpha = np.where(years < 2021, 500.0, 10.0)  
    else:
        alpha = 1e-10 

    kernel = RBF(length_scale=0.3, length_scale_bounds=(0.01, 10)) \
           + WhiteKernel(noise_level=0.1, noise_level_bounds=(1e-3, 1))

    gp = GaussianProcessRegressor(
        kernel=kernel, alpha=alpha,
        n_restarts_optimizer=5, normalize_y=True
    )
    gp.fit(X_norm, y)
    return gp, X.min(), X.max()

def fit_gp(years: np.ndarray, values: np.ndarray):
    """Fit a Gaussian Process to (years, population) data."""
    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)

    X_norm = (X - X.min()) / (X.max() - X.min() + 1e-8)

    kernel = RBF(length_scale=0.3, length_scale_bounds=(0.01, 10))  + WhiteKernel(noise_level=0.01, noise_level_bounds=(1e-5, 1))

    gp = GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=5, normalize_y=True)
    gp.fit(X_norm, y)
    return gp, X.min(), X.max()


def forecast(
    neighbourhood: str,
    forecast_years: list[int] = [2026, 2031],
    ward: str | None = None,         
) -> dict:
    """
    Returns GP forecast for a neighbourhood with confidence intervals.
    Pass `ward` (e.g. "N2502") to include permit-based SHAP features.
    """
    pop_df = load_population_series()
    neighbourhood = normalize_neighbourhood(neighbourhood) 

    if neighbourhood not in pop_df.index:
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


PERMIT_FEATURES = [
    "permit_count", "units_created", "units_lost",
    "net_units", "total_cost", "residential_permits", "demolition_permits",
]

BASE_FEATURES = ["year", "prev_pop", "growth_prev"]


def _compute_shap(
    pop_df: pd.DataFrame,
    target_neighbourhood: str,
    years: np.ndarray,
    values: np.ndarray,
    ward: str | None = None,
) -> dict:
    """
    Train a GBM across all neighbourhoods using year + population features,
    optionally enriched with per-ward permit aggregates.
    Returns SHAP values for the target neighbourhood explaining each year's prediction.
    """
    use_permits = True

    rows = []
    for neigh, neigh_row in pop_df.iterrows():
        neigh_row = neigh_row.dropna()
        if len(neigh_row) < 2:
            continue
        y_arr = np.array(neigh_row.index.tolist(), dtype=float)
        v_arr = np.array(neigh_row.values, dtype=float)
        for i, (y, v) in enumerate(zip(y_arr, v_arr)):
            entry = {
                "year":        y,
                "prev_pop":    v_arr[i - 1] if i > 0 else v,
                "growth_prev": (v - v_arr[i-1]) / (v_arr[i-1] + 1e-8) if i > 0 else 0.0,
                "population":  v,
            }
            # Permit features are attached via the target ward only;
            # other neighbourhoods get zeros (we don't have their ward mappings here).
            if use_permits:
                permit_feat = _get_permit_features_for(neigh, y) \
                    if neigh == target_neighbourhood \
                    else {f: 0.0 for f in PERMIT_FEATURES}
                entry.update(permit_feat)
            rows.append(entry)

    train_df = pd.DataFrame(rows)
    features = BASE_FEATURES + (PERMIT_FEATURES if use_permits else [])

    X_train = train_df[features].values
    y_train = train_df["population"].values

    gbm = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
    gbm.fit(X_train, y_train)

    # Build feature matrix for target neighbourhood
    target_rows = []
    for i, (y, v) in enumerate(zip(years, values)):
        entry = {
            "year":        y,
            "prev_pop":    values[i - 1] if i > 0 else v,
            "growth_prev": (v - values[i-1]) / (values[i-1] + 1e-8) if i > 0 else 0.0,
        }
        if use_permits:
            entry.update(_get_permit_features_for(ward, y))
        target_rows.append(entry)

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
    ward_map: dict[str, str] | None = None,   # {"neighbourhood name": "WARD_GRID"}
) -> dict:
    """
    Forecast multiple neighbourhoods for comparison.
    Optionally pass ward_map to enable permit features per neighbourhood.
    """
    ward_map = ward_map or {}
    return {
        n: forecast(normalize_neighbourhood(n), forecast_years, ward=ward_map.get(n))
        for n in neighbourhoods
    }