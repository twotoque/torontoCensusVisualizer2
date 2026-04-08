# prediction_multi_kernel.py
# GP forecasting + SHAP for census variables across neighbourhoods.
# Supports multiple kernel types for comparison.

import numpy as np
import pandas as pd
from functools import lru_cache
from typing import Literal, Tuple, Dict, Any
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import (
    RBF, WhiteKernel, ConstantKernel as C, 
    Matern, RationalQuadratic
)
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
import shap
from data_loader import load_population_series
from permits import load_permits
from prediction import normalize_neighbourhood, load_permit_features, _get_permit_features_for, fit_gp, fit_gp_da, fit_gp_per_sample, _compute_shap
from pathlib import Path
old_weights = pd.read_parquet('/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/158_to_140.parquet')

SPLIT_NEIGHBOURHOOD_LIST = old_weights[old_weights['weight'] < 0.95]['AREA_NAME_1'].unique().tolist()

# Kernel configs for easy reference and iteration
KERNEL_CONFIGS = {
    "rbf": {
        "name": "RBF (Radial Basis Function)",
        "description": "Smooth, flexible, assumes similarity decreases with distance",
        "builder": lambda: (
            C(1.0, (1e-3, 1e6))
            * RBF(length_scale=0.5, length_scale_bounds="fixed")
            + WhiteKernel(noise_level=1.0, noise_level_bounds=(1e-2, 10.0))
        ),
    },
    "matern_3_2": {
        "name": "Matérn ν=3/2",
        "description": "Less smooth than RBF, better for non-smooth data",
        "builder": lambda: (
            C(1.0, (1e-3, 1e6))
            * Matern(length_scale=0.5, nu=1.5, length_scale_bounds="fixed")
            + WhiteKernel(noise_level=1.0, noise_level_bounds=(1e-2, 10.0))
        ),
    },
    "matern_5_2": {
        "name": "Matern ν=5/2",
        "description": "Smoother than 3/2, good balance for real-world data",
        "builder": lambda: (
            C(1.0, (1e-3, 1e6))
            * Matern(length_scale=0.5, nu=2.5, length_scale_bounds="fixed")
            + WhiteKernel(noise_level=1.0, noise_level_bounds=(1e-2, 10.0))
        ),
    },
    "rational_quadratic": {
        "name": "Rational Quadratic",
        "description": "Mixture of RBF kernels at different scales; good for data with multiple scales",
        "builder": lambda: (
            C(1.0, (1e-3, 1e6))
            * RationalQuadratic(length_scale=0.5, alpha=1.0, length_scale_bounds="fixed")
            + WhiteKernel(noise_level=1.0, noise_level_bounds=(1e-2, 10.0))
        ),
    },
}


# fit GP with kerenel 

def fit_gp_with_kernel(
    years: np.ndarray,
    values: np.ndarray,
    kernel_type: Literal[
        "rbf", "matern_3_2", "matern_5_2", "rational_quadratic", 
    ] = "rbf",
) -> Tuple[GaussianProcessRegressor, float, float]:
    """
    Fit a Gaussian Process with any kernel type to (years, population) data.
    
    Args:
        years: array of year values
        values: array of population values
        kernel_type: one of the keys in KERNEL_CONFIGS
    
    Returns:
        (fitted_gp, X_min, X_max)
    """
    if kernel_type not in KERNEL_CONFIGS:
        raise ValueError(f"Unknown kernel_type '{kernel_type}'. Available: {list(KERNEL_CONFIGS.keys())}")
    
    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)

    X_norm = (X - X.min()) / (X.max() - X.min() + 1e-8)

    kernel = KERNEL_CONFIGS[kernel_type]["builder"]()

    gp = GaussianProcessRegressor(
        kernel=kernel,
        n_restarts_optimizer=5,
        normalize_y=True,
    )
    gp.fit(X_norm, y)
    return gp, X.min(), X.max()


def fit_gp_da_with_kernel(
    years: np.ndarray,
    values: np.ndarray,
    neighbourhood_name: str,
    kernel_type: Literal[
        "rbf", "matern_3_2", "matern_5_2", "rational_quadratic", 
    ] = "rbf",
    true_2021_value: float | None = None,
) -> Tuple[GaussianProcessRegressor, float, float, StandardScaler]:
    """
    Fit a GP with custom kernel, with optional 2021 anchor point.
    
    Args:
        years: array of year values
        values: array of population values
        neighbourhood_name: for determining stability
        kernel_type: one of the keys in KERNEL_CONFIGS
        true_2021_value: optional anchor point for 2021
    
    Returns:
        (fitted_gp, X_min, X_max, y_scaler)
    """
    if kernel_type not in KERNEL_CONFIGS:
        raise ValueError(f"Unknown kernel_type '{kernel_type}'. Available: {list(KERNEL_CONFIGS.keys())}")

    if true_2021_value is not None:
        years  = np.append(years, 2021.0)
        values = np.append(values, float(true_2021_value))

    X = years.reshape(-1, 1).astype(float)
    y = values.astype(float)

    x_min, x_max = X.min(), X.max()
    X_norm = (X - x_min) / (x_max - x_min + 1e-8)

    y_scaler = StandardScaler()
    y_scaled = y_scaler.fit_transform(y.reshape(-1, 1)).ravel()

    is_split = neighbourhood_name in SPLIT_NEIGHBOURHOOD_LIST

    if true_2021_value is not None:
        alpha = np.where(years == 2021, 1e-6, 0.5 if is_split else 0.05)
    else:
        alpha = 0.5 if is_split else 0.05

    kernel = KERNEL_CONFIGS[kernel_type]["builder"]()

    gp = GaussianProcessRegressor(
        kernel=kernel,
        alpha=alpha,
        n_restarts_optimizer=5,
        normalize_y=False,
    )
    gp.fit(X_norm, y_scaled)

    return gp, x_min, x_max, y_scaler



def forecast(
    neighbourhood: str,
    forecast_years: list[int] = [2026, 2031],
    ward: str | None = None,
    kernel_type: str = "rbf",
) -> dict:
    """
    Returns GP forecast for a neighbourhood with confidence intervals.
    Pass `ward` (e.g. "N2502") to include permit-based SHAP features.
    Pass `kernel_type` to use a different GP kernel.
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

    gp, y_min, y_max = fit_gp_with_kernel(years, values, kernel_type=kernel_type)

    all_years = np.array(sorted(years.tolist() + forecast_years), dtype=float)
    X_norm = ((all_years - y_min) / (y_max - y_min + 1e-8)).reshape(-1, 1)
    y_pred, y_std = gp.predict(X_norm, return_std=True)

    shap_values = _compute_shap(pop_df, neighbourhood, years, values)

    return {
        "neighbourhood": neighbourhood,
        "kernel_type": kernel_type,
        "kernel_name": KERNEL_CONFIGS[kernel_type]["name"],
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


def compare_neighbourhoods(
    neighbourhoods: list[str],
    forecast_years: list[int] = [2026, 2031],
    ward_map: dict[str, str] | None = None,
    kernel_type: str = "rbf",
) -> dict:
    """
    Forecast multiple neighbourhoods for comparison.
    Optionally pass ward_map to enable permit features per neighbourhood.
    Optionally pass kernel_type to use a different kernel.
    """
    ward_map = ward_map or {}
    return {
        n: forecast(
            normalize_neighbourhood(n), 
            forecast_years, 
            ward=ward_map.get(n),
            kernel_type=kernel_type,
        )
        for n in neighbourhoods
    }


def compare_kernels_single_neighbourhood(
    neighbourhood: str,
    forecast_years: list[int] = [2026, 2031],
) -> dict:
    """
    Forecast the same neighbourhood using all available kernels.
    Useful for comparing which kernel works best.
    
    Returns:
        Dict mapping kernel_type -> forecast result
    """
    return {
        kernel_type: forecast(
            neighbourhood, 
            forecast_years=forecast_years, 
            kernel_type=kernel_type
        )
        for kernel_type in KERNEL_CONFIGS.keys()
    }