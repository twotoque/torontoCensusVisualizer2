# census_registry.py
# The only file that knows which census years exist and where their data lives.

CENSUS_YEARS: dict[int, dict[str, str]] = {
    2021: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2021/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-158/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/wards-44/CityWards.geojson",
        "label_col":      "Neighbourhood Name",
        "wards_name_col": "AREA_NAME",
        "id_col": None,
        "row_offset": 2,
    },

    2016: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2016/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/wards-44/CityWards.geojson",
        "label_col":      "Characteristic",
        "wards_name_col": "AREA_NAME",
        "id_col": "_id",
        "row_offset": 1,
        "drop_cols": ("City of Toronto",),
    },

    2011: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2011/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/wards-44/CityWards.geojson",
        "label_col":      "Attribute",
        "wards_name_col": "AREA_NAME",
        "id_col":         "_id",
        "drop_cols": ("City of Toronto",),
    },

    2006: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2006/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/wards-44/CityWards.geojson",
        "label_col":      "Attribute",
        "wards_name_col": "AREA_NAME",
        "id_col":         "_id",
        "drop_cols": ("City of Toronto",),
    },

    2001: {
        "census":         "/Users/dereksong/Documents/torontoCensusVisualizer2/data/2001/CityCensusData.csv",
        "neighbourhoods": "/Users/dereksong/Documents/torontoCensusVisualizer2/data/neighbourhood-140/Neighbourhoods.geojson",
        "wards":          "/Users/dereksong/Documents/torontoCensusVisualizer2/data/wards-44/CityWards.geojson",
        "label_col":      "Attribute",
        "wards_name_col": "AREA_NAME",
        "id_col":         "_id",
        "drop_cols": ("City of Toronto",),
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