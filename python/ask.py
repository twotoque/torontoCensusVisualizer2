# ask.py
#
# 1.   parse(query) = intent, metric, neighbourhoods, years  (PyTorch model)
# 2. semantic_search(...) = row_ids per year  (ChromaDB RAG)
# 3. fetch_values(...) = actual census numbers  (data_loader)
# 4. format_answer(...) = human-readable string  (templates)
#
# Everything is localish 

import re

from query_parser import parse
from rag import semantic_search, semantic_search_with_disambiguation, find_row_in_year
from data_loader import load_census
from census_registry import get_paths, CENSUS_YEARS
import pandas as pd

# import the weight "Translator" fn 
weights_df = pd.read_parquet("/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet")

# training wheels for the RAG
ENRICHMENTS = {
    "population":        "total population count",
    "income":            "average total income",
    "household income":  "average household total income",
    "housing":           "dwelling units",
    "neighbourhood number": "Neighbourhood Number",
}

BLOCKED_LABELS = {
    "Neighbourhood Number",
    "TSNS2020 Designation", 
    "Neighbourhood Name",
}

# Use word-boundary aware replacement to avoid breaking words like "income"
STOP_WORDS = [
    "what was", "what is", "show me", "how did", "compare",
    "which neighbourhood", "highest", "lowest", "over time",
    "changed", "difference", "between", "terms of",
    "from", "how has", "historical", "trend",
    r"\bthe\b", r"\band\b", r"\bin\b", r"\bto\b", r"\bof\b",
]

ATTRIBUTE_MAP = {
    "population": {
        2001: "Population, 2001 - 100% data",
        2006: "Population, 2006 - 100% data",
        2011: "Population, 2011",
        2016: "Population, 2016",
        2021: "Total - Age groups of the population - 25% sample data",
    }
}

def get_attribute(field: str, year: int) -> str:
    """Return the correct CSV attribute name for a given field and year."""
    if field in ATTRIBUTE_MAP:
        return ATTRIBUTE_MAP[field].get(year, field)
    return field

def _fetch_values(
    row_ids: dict,     
    neighbourhoods: list[str],
) -> dict:
    """
    Returns {year: {neighbourhood: value}} for all matched rows.
    Values are floats where possible, strings otherwise.
    """
    result = {}
    for year, row_id in row_ids.items():
        paths = get_paths(year)
        df    = load_census(paths["census"], drop_cols=tuple(paths.get("drop_cols", ())))
        id_col = paths.get("id_col")

        if id_col and id_col in df.columns:
            matches = df[df[id_col] == row_id]
            if matches.empty:
                continue
            row = matches.iloc[0]
        else:
            row = df.iloc[row_id]

        result[year] = {}
        for n in neighbourhoods:
            resolved = _resolve_neighbourhood(n, weights_df, year)
            total = 0.0
            total_weight = 0.0
            for new_name, weight in resolved.items():
                if new_name in df.columns:
                    raw = row[new_name]
                    try:
                        val = float(str(raw).replace(",", "").replace("%", ""))
                        total += val * weight
                        total_weight += weight
                    except (ValueError, TypeError):
                        pass
            if total_weight > 0:
                result[year][n] = total / total_weight

    return result

def _resolve_neighbourhood(name: str, weights_df: pd.DataFrame, year: int) -> dict:
    """
    For years using 158-neighbourhood system (2021), map old names to new via weights.
    Returns {new_name: weight} for neighbourhoods to fetch and combine.
    """
    NEW_SYSTEM_YEARS = [2021]
    
    if year not in NEW_SYSTEM_YEARS:
        return {name: 1.0}  # 140 older name
    
    matches = weights_df[weights_df["AREA_NAME_1"] == name]
    if matches.empty:
        return {name: 1.0}  # 158 newer name
    
    return dict(zip(matches["AREA_NAME_2"], matches["weight"]))

def _clean_query_for_rag(query: str, neighbourhoods: list[str], years: list[int]) -> str:
    """Remove neighbourhood names and years from query to get a cleaner metric search."""
    cleaned = query.lower()
    for n in neighbourhoods:
        cleaned = cleaned.replace(n.lower(), "")
    for y in years:
        cleaned = cleaned.replace(str(y), "")
    
    
    for word in STOP_WORDS:
        if word.startswith(r"\b"):
            cleaned = re.sub(word, " ", cleaned)
        else:
            cleaned = cleaned.replace(word, " ")
    
    cleaned = " ".join(cleaned.split()).strip()
    return ENRICHMENTS.get(cleaned, cleaned)


def _get_row_ids(query: str, neighbourhoods: list[str], years: list[int]) -> dict:
    row_ids = {}
    for year in years:
        search_query = _clean_query_for_rag(query, neighbourhoods, [year]) or query
        # append year to help find year-specific rows like "Population, 2011"
        if search_query:
            if year == 2021 and "population" in search_query.lower():
                search_query = "Total - Age groups of the population - 25% sample data"
            elif str(year) not in search_query:
                search_query = f"{search_query} {year}"

        results = semantic_search(search_query, year=year, limit=5)
        results = [r for r in results if r["label"].strip() not in BLOCKED_LABELS]
        if not results:
            continue

        year_str = str(year)
        year_match = [r for r in results if year_str in r["label"]]
        if year_match:
            row_ids[year] = year_match[0]["row_id"]  # always prefer year match
        elif results[0]["score"] > 0.05:
            row_ids[year] = results[0]["row_id"]

    
    return row_ids
# answer tempaltes

def _fmt(value) -> str:
    """Format a value for display."""
    if isinstance(value, float):
        if value > 100:
            return f"{value:,.0f}"
        else:
            return f"{value:,.2f}"
    return str(value)


def _template_single_value(values, neighbourhoods, years, metric) -> str:
    year = years[0]
    n    = neighbourhoods[0]
    val  = values.get(year, {}).get(n)
    if val is None:
        return f"No data found for {metric} in {n} for {year}."
    return f"In {year}, {metric} in {n} was {_fmt(val)}."


def _template_compare_years(values, neighbourhoods, years, metric) -> str:
    n     = neighbourhoods[0]
    y1, y2 = years[0], years[-1]
    v1    = values.get(y1, {}).get(n)
    v2    = values.get(y2, {}).get(n)
    if v1 is None or v2 is None:
        return f"Insufficient data to compare {metric} in {n} between {y1} and {y2}."
    if isinstance(v1, float) and isinstance(v2, float):
        diff = v2 - v1
        pct  = (diff / v1 * 100) if v1 != 0 else 0
        direction = "increased" if diff > 0 else "decreased"
        return (
            f"In {n}, {metric} {direction} from {_fmt(v1)} in {y1} "
            f"to {_fmt(v2)} in {y2}, a change of {diff:+,.1f} ({pct:+.1f}%)."
        )
    return f"{metric} in {n}: {y1} → {_fmt(v1)}, {y2} → {_fmt(v2)}."


def _template_trend(values, neighbourhoods, years, metric) -> str:
    n     = neighbourhoods[0]
    lines = [f"{metric} in {n} over time:"]
    first_val = last_val = None
    for year in sorted(years):
        val = values.get(year, {}).get(n)
        if val is not None:
            lines.append(f"  {year}: {_fmt(val)}")
            if first_val is None:
                first_val = (year, val)
            last_val = (year, val)
    if first_val and last_val and isinstance(first_val[1], float):
        diff = last_val[1] - first_val[1]
        pct  = (diff / first_val[1] * 100) if first_val[1] != 0 else 0
        lines.append(
            f"Overall change {first_val[0]}–{last_val[0]}: "
            f"{diff:+,.1f} ({pct:+.1f}%)"
        )
    return "\n".join(lines)


def _template_ranking(values, neighbourhoods, years, metric) -> str:
    year = years[0]
    year_vals = values.get(year, {})
    if not year_vals:
        return f"No data found for {metric} in {year}."
    sortable = {n: v for n, v in year_vals.items() if isinstance(v, float)}
    if not sortable:
        return f"Could not rank {metric} in {year} — values are not numeric."
    ranked = sorted(sortable.items(), key=lambda x: x[1], reverse=True)
    lines  = [f"Top neighbourhoods by {metric} in {year}:"]
    for i, (n, v) in enumerate(ranked[:10], 1):
        lines.append(f"  {i}. {n} — {_fmt(v)}")
    return "\n".join(lines)


def _template_cross_neighbourhood(values, neighbourhoods, years, metric) -> str:
    year  = years[0]
    n1, n2 = neighbourhoods[0], neighbourhoods[1]
    v1    = values.get(year, {}).get(n1)
    v2    = values.get(year, {}).get(n2)
    if v1 is None or v2 is None:
        return f"Insufficient data to compare {metric} between {n1} and {n2} in {year}."
    lines = [f"{metric} in {year}:", f"  {n1}: {_fmt(v1)}", f"  {n2}: {_fmt(v2)}"]
    if isinstance(v1, float) and isinstance(v2, float):
        diff   = v2 - v1
        winner = n2 if diff > 0 else n1
        lines.append(f"  Difference: {abs(diff):,.1f} — {winner} is higher.")
    return "\n".join(lines)


TEMPLATE_FNS = {
    "single_value":        _template_single_value,
    "compare_years":       _template_compare_years,
    "trend":               _template_trend,
    "ranking":             _template_ranking,
    "cross_neighbourhood": _template_cross_neighbourhood,
}


# rank all neighboruhood values

def _fetch_all_neighbourhoods_for_year(row_id: int, year: int) -> dict:
    """For ranking: fetch values for every neighbourhood in a year."""
    paths = get_paths(year)
    df    = load_census(
        paths["census"],
        drop_cols=tuple(paths.get("drop_cols", ())),
    )
    id_col    = paths.get("id_col")
    label_col = paths["label_col"]

    if id_col and id_col in df.columns:
        matches = df[df[id_col] == row_id]
        if matches.empty:
            return {}
        row = matches.iloc[0]
    else:
        row = df.iloc[row_id]

    # Everything after the metadata columns
    col_start = df.columns.get_loc(label_col)
    result    = {}
    for col in df.columns[col_start + 1:]:
        raw = row[col]
        try:
            result[col] = float(str(raw).replace(",", "").replace("%", ""))
        except (ValueError, TypeError):
            pass
    return result


# api

def answer(query: str, confirmed_row_id: int | None = None, confirmed_year: int | None = None) -> dict:
    """
    Answer a natural language Toronto census question.

    Returns:
    {
        "answer":        str | None,  # human-readable answer, None if disambiguation needed
        "intent":        str,
        "metric":        str | None,
        "context":       dict,
        "disambiguation": list | None  # options to pick from if ambiguous
    }
    """
    # 1. parse query with PyTorch model
    parsed         = parse(query)
    intent         = parsed["intent"]
    neighbourhoods = parsed["neighbourhoods"]
    years          = parsed["years"]

    # 2. if it is a trend, do a special multi-year search and answer generation flow
    if intent == "trend":
        search_query = _clean_query_for_rag(query, neighbourhoods, years) or query
        anchor_year = max(years)
        
        anchor_results = semantic_search(search_query, year=anchor_year, limit=10)
        anchor_results = [r for r in anchor_results if r["label"].strip() not in BLOCKED_LABELS]
        
        if anchor_results:
            anchor_row = anchor_results[0]
            anchor_label = anchor_row["label"]
            row_ids = {anchor_year: anchor_row["row_id"]}
            
            for y in sorted(years):
                if y == anchor_year:
                    continue
                if "Age groups" in anchor_label:
                    lookup_label = f"Population, {y}"
                else:
                    lookup_label = anchor_label
                row_id, score = find_row_in_year(lookup_label, y)
                if row_id is not None and score > 0.3:
                    row_ids[y] = row_id
            
            if row_ids:
                display_metric = re.sub(r"\s*[-—]\s*\d{4}.*$", "", anchor_label).strip()
                display_metric = re.sub(r",?\s*\d{4}$", "", display_metric).strip()
                
                values = _fetch_values(row_ids, neighbourhoods)
                
                import math
                for y in list(values.keys()):
                    for n in list(values[y].keys()):
                        if isinstance(values[y][n], float) and math.isnan(values[y][n]):
                            del values[y][n]
                    if not values[y]:
                        del values[y]
                
                answer_text = _template_trend(values, neighbourhoods,
                                            sorted(values.keys()), display_metric)
                return {
                    "answer":         answer_text,
                    "intent":         intent,
                    "metric":         display_metric,
                    "context":        {"years": years, "neighbourhoods": neighbourhoods,
                                    "values": values},
                    "disambiguation": None,
                }
            
    # 3. RAG — skip if user already confirmed a row
    if confirmed_row_id is not None and confirmed_year is not None:
        row_ids = {year: confirmed_row_id for year in years}  # use same row across all years
        
        confirmed_results = semantic_search(query, year=confirmed_year, limit=1)
        display_metric = confirmed_results[0]["label"].strip() if confirmed_results else query
    else:
        search_query = _clean_query_for_rag(query, neighbourhoods, years) or query
        results, needs_disambiguation = semantic_search_with_disambiguation(
            search_query, year=None, limit=5
        )

        if not results:
            return {
                "answer": "Could not find a matching census metric for your query.",
                "intent": intent, "metric": None, "context": {}, "disambiguation": None,
            }

        if needs_disambiguation:
            return {
                "answer": None, "intent": intent, "metric": None, "context": {},
                "disambiguation": [
                    {"row_id": r["row_id"], "year": r["year"], "label": r["label"], "score": r["score"]}
                    for r in results
                ],
            }

        row_ids = _get_row_ids(query, neighbourhoods, years)
        if not row_ids:
            return {
                "answer": "Could not find a matching census metric for your query.",
                "intent": intent, "metric": results[0]["label"], "context": {}, "disambiguation": None,
            }

        first_year = next(iter(row_ids))
        year_results = semantic_search(
            f"{_clean_query_for_rag(query, neighbourhoods, [first_year]) or query} {first_year}",
            year=first_year, limit=1
        )
        display_metric = year_results[0]["label"].strip() if year_results else results[0]["label"]

    # 4. Fetch values
    if intent == "ranking":
        year = years[0]
        rid  = row_ids.get(year)
        if rid is None:
            return {"answer": f"No data for {year}.", "intent": intent,
                    "metric": display_metric, "context": {}, "disambiguation": None}
        all_vals       = _fetch_all_neighbourhoods_for_year(rid, year)
        values         = {year: all_vals}
        neighbourhoods = list(all_vals.keys())
    else:
        if not neighbourhoods:
            return {
                "answer": "Could not identify a neighbourhood in your query. "
                          "Try including a Toronto neighbourhood name such as "
                          "'Malvern', 'Annex', or 'Scarborough Village'.",
                "intent": intent, "metric": display_metric, "context": {}, "disambiguation": None,
            }
        values = _fetch_values(row_ids, neighbourhoods)

    # 5. Generate answer from template
    template_fn = TEMPLATE_FNS.get(intent, _template_single_value)
    answer_text = template_fn(values, neighbourhoods, years, display_metric)

    return {
        "answer":         answer_text,
        "intent":         intent,
        "metric":         display_metric,
        "context":        {"years": years, "neighbourhoods": neighbourhoods, "values": values},
        "disambiguation": None,
    }