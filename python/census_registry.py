# census_registry.py
# The only file that knows which census years exist and where their data lives.
# Adding a new year = one dict entry. Nothing else changes.

CENSUS_YEARS: dict[int, dict[str, str]] = {
    2021: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2021/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2021/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2021/CityWards.geojson",
        "label_col":      "Neighbourhood Name",
    },

    2016: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2016/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2016/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2016/CityWards.geojson",
        "label_col":      "Characteristic",
    },
}

DEFAULT_YEAR = 2021


def get_paths(year: int) -> dict[str, str]:
    if year not in CENSUS_YEARS:
        raise ValueError(
            f"No data registered for year {year}. "
            f"Available: {available_years()}"
        )
    return CENSUS_YEARS[year]


def available_years() -> list[int]:
    return sorted(CENSUS_YEARS.keys(), reverse=True)