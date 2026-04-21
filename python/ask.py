# ask.py
#
# 1.   parse(query) = intent, metric, neighbourhoods, years  (PyTorch model)
# 2. semantic_search(...) = row_ids per year  (ChromaDB RAG)
# 3. fetch_values(...) = actual census numbers  (data_loader)
# 4. format_answer(...) = human-readable string  (templates)
#
# Everything is localish 

import math
import os
import re

from query_parser import parse
from rag import semantic_search, semantic_search_with_disambiguation, find_row_in_year
from data_loader import load_census
from census_registry import get_paths, CENSUS_YEARS
import pandas as pd
from pathlib import Path
import statistics

# import the weight "Translator" fn 


BASE = Path(os.environ.get('DATA_DIR', Path(__file__).parent.parent / 'data'))
weights_df = pd.read_parquet(BASE / "weights/140_to_158.parquet")

# training wheels for the RAG
ENRICHMENTS = {
    "population":        "population",
    "income":            "average total income",
    "household income":  "Average total income of household",
    "housing":           "Total - Occupied private dwellings by structural type of dwelling",
    "dwelling units":    "Total - Occupied private dwellings by structural type of dwelling",
    "dwellings":         "Total - Occupied private dwellings by structural type of dwelling",
    "neighbourhood number": "Neighbourhood Number",
}

METRIC_PATTERNS = [
    (re.compile(r"\bvisible minority\b"), "Total visible minority population"),
    (re.compile(r"\bmother tongue\b"), "Total population by mother tongue"),
    (re.compile(r"\bemployment income\b"), "Average employment income"),
    (re.compile(r"\baverage household total income\b"), "Average total income of household"),
    (re.compile(r"\bhousehold total income\b"), "Average total income of household"),
    (re.compile(r"\baverage total income\b"), "Average total income of household"),
    (re.compile(r"\bprivate dwellings\b"), "Total - Occupied private dwellings by structural type of dwelling"),
    (re.compile(r"\bdwelling units?\b"), "Total - Occupied private dwellings by structural type of dwelling"),
]

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



def _drop_nan_values(values: dict) -> None:
    """Remove NaN entries from a {year: {neighbourhood: value}} dict in-place."""
    for y in list(values.keys()):
        for n in list(values[y].keys()):
            if isinstance(values[y][n], float) and math.isnan(values[y][n]):
                del values[y][n]
        if not values[y]:
            del values[y]

def _drop_outlier_years(values: dict) -> dict:
    """
    Remove years whose values are implausible compared to the rest of the trend.
    
    Strategy:
    - If values clearly switch scale (count vs percentage), drop the outlier years
    - Uses IQR-based outlier detection on log scale to handle large ranges
    - Always keeps at least 2 years if possible
    
    Returns a new dict (does not mutate the original).
    """

    result = {y: dict(neighbourhood_vals) for y, neighbourhood_vals in values.items()}

    # Collect (year, value) pairs — assume single neighbourhood for trend context
    year_vals = []
    for year, neighbourhood_dict in result.items():
        for val in neighbourhood_dict.values():
            if isinstance(val, float) and not math.isnan(val) and val > 0:
                year_vals.append((year, val))

    if len(year_vals) < 3:
        return result  # not enough data to do outlier detection safely

    years_list = [yv[0] for yv in year_vals]
    vals_list  = [yv[1] for yv in year_vals]

    # If some values are <= 100 and others are >> 100, split into two clustersand drop the minority cluster
    under_100  = [(y, v) for y, v in year_vals if v <= 100]
    over_100   = [(y, v) for y, v in year_vals if v > 100]

    if under_100 and over_100:
        # Keep whichever group is larger; on a tie, prefer the anchor (latest) year
        majority = over_100 if len(over_100) >= len(under_100) else under_100
        keep_years = {y for y, _ in majority}
        result = {y: nd for y, nd in result.items() if y in keep_years}
        if len(result) >= 2:
            return result
        # If dropping left us with < 2 years, fall through to IQR

    # IQR outlier detection on log scale to catch more subtle outliers without assuming a specific distribution
    log_vals = [math.log10(v) for v in vals_list if v > 0]
    if len(log_vals) < 3:
        return result

    q1 = statistics.quantiles(log_vals, n=4)[0]   # 25th percentile
    q3 = statistics.quantiles(log_vals, n=4)[2]   # 75th percentile
    iqr = q3 - q1
    fence = 1.5 * iqr

    outlier_years = {
        year for year, val in year_vals
        if val > 0 and not (q1 - fence <= math.log10(val) <= q3 + fence)
    }

    # Never drop so many that fewer than 2 years remain
    survivors = [y for y in years_list if y not in outlier_years]
    if len(survivors) < 2:
        return result  # abort: don't drop anything

    return {y: nd for y, nd in result.items() if y not in outlier_years}


def _get_label_for_row(row_id: int, year: int) -> str | None:
    """Return the descriptive label for a given row/year."""
    paths = get_paths(year)
    df    = load_census(paths["census"], drop_cols=tuple(paths.get("drop_cols", ())))
    id_col    = paths.get("id_col")
    label_col = paths["label_col"]

    if id_col and id_col in df.columns:
        matches = df[df[id_col] == row_id]
        if matches.empty:
            return None
        row = matches.iloc[0]
    else:
        if row_id >= len(df):
            return None
        row = df.iloc[row_id]

    if "Combined_Label" in df.columns and pd.notna(row.get("Combined_Label")):
        return str(row["Combined_Label"])
    return str(row[label_col])

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
    for pattern, replacement in METRIC_PATTERNS:
        if pattern.search(cleaned):
            return replacement
    return ENRICHMENTS.get(cleaned, cleaned)



def _get_row_ids(query: str, neighbourhoods: list[str], years: list[int]) -> dict:
    row_ids = {}
    for year in years:
        search_query = _clean_query_for_rag(query, neighbourhoods, [year]) or query

        # append year to help find year-specific rows like "Population, 2011"
        if search_query:
            if year == 2021 and "population" in search_query.lower():
                search_query = "Total - Age groups of the population - 25% sample data"
            elif year == 2021 and "mother tongue" in search_query.lower():
                search_query = "Total - Mother tongue for the population in private households - 25% sample data"
            elif str(year) not in search_query:
                search_query = f"{search_query} {year}"

        results = semantic_search(search_query, year=year, limit=5)
        results = [r for r in results if r["label"].strip() not in BLOCKED_LABELS]
        if not results:
            continue

        year_str = str(year)
        year_match = [r for r in results if year_str in r["label"]]
        if year_match:
            row_ids[year] = year_match[0]["row_id"] # always prefer year match
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


def _is_plausible_trend(values: dict) -> bool:
    """Reject trends where values switch scale dramatically."""
    all_vals = [v for year_dict in values.values() 
                for v in year_dict.values() if isinstance(v, float)]
    if len(all_vals) < 2:
        return True
    max_v, min_v = max(all_vals), min(all_vals)
    if min_v <= 0:
        return True
    # if values differ by more than 100x, something is wrong
    return (max_v / min_v) < 100

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
        return f"No data found for {metric} in {year}. As I am a local AI model trained on Toronto census data, I can only answer questions about Toronto neighbourhoods and census years. Try using the prompt builder below to rephrase your question."
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
    if len(neighbourhoods) < 2:
        if len(neighbourhoods) == 1:
            return _template_single_value(values, neighbourhoods, years, metric)
        return f"Need two neighbourhoods to compare {metric} in {year}."

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


def _build_cell_info(row_ids: dict, neighbourhoods: list[str], display_metric: str) -> dict:
    """Return human-readable cell provenance for the frontend."""
    if not row_ids:
        return {}
    year = next(iter(row_ids))
    row_id = row_ids[year]
    label = _get_label_for_row(row_id, year)
    return {
        "row_label": display_metric,
        "columns":   neighbourhoods[:1],
        "years": [
            {"year": year, "row_id": rid}
            for year, rid in sorted(row_ids.items())
        ],
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
def _make_result(
    answer_text: str,
    intent: str,
    metric: str,
    years: list[int],
    neighbourhoods: list[str],
    values: dict,
    row_ids: dict,
) -> dict:
    return {
        "answer":  answer_text,
        "intent":  intent,
        "metric":  metric,
        "context": {
            "years":          years,
            "neighbourhoods": neighbourhoods,
            "values":         values,
            "cell":           _build_cell_info(row_ids, neighbourhoods, metric),
        },
        "disambiguation": None,
    }


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
    cleaned_metric = _clean_query_for_rag(query, neighbourhoods, years)
    explicit_year  = bool(re.search(r"\b(?:2001|2006|2011|2016|2021)\b", query))

    neighbourhoods = [n for n in neighbourhoods if len(n) > 3]

    # Guard: single year can never be a comparison
    if intent == "compare_years" and len(years) == 1:
        intent = "single_value"

    if intent == "cross_neighbourhood" and len(neighbourhoods) < 2:
        intent = "single_value" if neighbourhoods else "ranking"

    # 2. if it is a trend, do a special multi-year search and answer generation flow
    if intent == "trend":
        search_query    = cleaned_metric or query
        canonical_field = (cleaned_metric or "").strip()
        canonical_field = canonical_field if canonical_field in ATTRIBUTE_MAP else None

        if canonical_field:
            row_ids = {}
            for y in sorted(years):
                lookup_label = get_attribute(canonical_field, y)
                row_id, score = find_row_in_year(lookup_label, y)
                if row_id is not None and score > 0.3:
                    row_ids[y] = row_id

            if row_ids:
                anchor_lookup  = get_attribute(canonical_field, max(row_ids))
                display_metric = re.sub(r"\s*[-—]\s*\d{4}.*$", "", anchor_lookup).strip()
                display_metric = re.sub(r",?\s*\d{4}.*$", "", display_metric).strip()

                values = _fetch_values(row_ids, neighbourhoods)
                _drop_nan_values(values)

                return _make_result(
                    _template_trend(values, neighbourhoods, sorted(values.keys()), display_metric or canonical_field.title()),
                    intent, display_metric or canonical_field.title(),
                    years, neighbourhoods, values, row_ids,
                )

        if confirmed_row_id is not None and confirmed_year is not None and not canonical_field:
            anchor_label = _get_label_for_row(confirmed_row_id, confirmed_year)
            if anchor_label:
                row_ids = {confirmed_year: confirmed_row_id}
                for y in sorted(years):
                    if y == confirmed_year:
                        continue
                    lookup_label = f"Population, {y}" if "Age groups" in anchor_label else anchor_label
                    row_id, score = find_row_in_year(lookup_label, y)
                    if row_id is not None and score > 0.3:
                        row_ids[y] = row_id
                if row_ids:
                    display_metric = re.sub(r"\s*[-—]\s*\d{4}.*$", "", anchor_label).strip()
                    display_metric = re.sub(r",?\s*\d{4}$", "", display_metric).strip()
                    values = _fetch_values(row_ids, neighbourhoods)
                    _drop_nan_values(values)

                    return _make_result(
                        _template_trend(values, neighbourhoods, sorted(values.keys()), display_metric or anchor_label),
                        intent, display_metric or anchor_label,
                        years, neighbourhoods, values, row_ids,
                    )

        disambig_results = []
        if not canonical_field and confirmed_row_id is None:
            anchor_year      = max(years)
            raw_results      = semantic_search(search_query, year=anchor_year, limit=5)
            disambig_results = [r for r in raw_results if r["label"].strip() not in BLOCKED_LABELS]
            if len(disambig_results) > 1:
                return {
                    "answer": None, "intent": intent, "metric": None,
                    "context": {}, "disambiguation": [
                        {"row_id": r["row_id"], "year": r["year"],
                         "label": r["label"], "score": r["score"]}
                        for r in disambig_results
                    ],
                }

        anchor_year    = max(years)
        anchor_results = disambig_results[:1] if disambig_results else [
            r for r in semantic_search(search_query, year=anchor_year, limit=10)
            if r["label"].strip() not in BLOCKED_LABELS
        ]

        if anchor_results:
            anchor_row   = anchor_results[0]
            anchor_label = anchor_row["label"]
            row_ids      = {anchor_year: anchor_row["row_id"]}

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
                _drop_nan_values(values)

                return _make_result(
                    _template_trend(values, neighbourhoods, sorted(values.keys()), display_metric),
                    intent, display_metric,
                    years, neighbourhoods, values, row_ids,
                )

    # 3. RAG — skip if user already confirmed a row
    if confirmed_row_id is not None and confirmed_year is not None:
        row_ids = {confirmed_year: confirmed_row_id}

        remaining_years = [y for y in years if y != confirmed_year]
        if remaining_years:
            additional_ids = _get_row_ids(query, neighbourhoods, remaining_years)
            row_ids.update(additional_ids)

        confirmed_results = semantic_search(query, year=confirmed_year, limit=1)
        display_metric = confirmed_results[0]["label"].strip() if confirmed_results else query
    else:
        search_query = cleaned_metric or query

        # When the user specified a year explicitly, scope the disambiguation search
        # to that year only. Searching year=None causes cross-year label collisions
        # (e.g. the same metric indexed under 2016 AND 2021 both appear as candidates),
        # which triggers unnecessary disambiguation prompts.
        search_year = years[0] if explicit_year and len(years) == 1 else None

        results, needs_disambiguation = semantic_search_with_disambiguation(
            search_query, year=search_year, limit=5
        )

        if not results:
            if not explicit_year:
                for fallback_year in sorted((2001, 2006, 2011, 2016, 2021), reverse=True):
                    if fallback_year in years:
                        continue
                    results, needs_disambiguation = semantic_search_with_disambiguation(
                        search_query, year=fallback_year, limit=5
                    )
                    if results:
                        years = [fallback_year]
                        break

        if not results:
            return {
                "answer": "Could not find a matching census metric for your query. As I am a local AI model trained on Toronto census data, I can only answer questions about Toronto neighbourhoods and census years. Try using the prompt builder below to rephrase your question.",
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
            if not explicit_year:
                fallback_years = [y for y in sorted((2001, 2006, 2011, 2016, 2021), reverse=True) if y not in years]
                for fallback_year in fallback_years:
                    row_ids = _get_row_ids(query, neighbourhoods, [fallback_year])
                    if row_ids:
                        years = [fallback_year]
                        break

        if not row_ids:
            return {
                "answer": "Could not find a matching census metric for your query. As I am a local AI model trained on Toronto census data, I can only answer questions about Toronto neighbourhoods and census years. Try using the prompt builder below to rephrase your question.",
                "intent": intent, "metric": results[0]["label"], "context": {}, "disambiguation": None,
            }

        first_year   = next(iter(row_ids))  
        display_metric = _get_label_for_row(row_ids[first_year], first_year) or results[0]["label"]
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
                "answer": "Could not identify a neighbourhood in your query. As I am a local AI model trained on Toronto census data, I can only answer questions about Toronto neighbourhoods and census years. Try using the prompt builder below to rephrase your question. Try including a Toronto neighbourhood name such as 'Malvern', 'Annex', or 'Scarborough Village'.",
                "intent": intent, "metric": display_metric, "context": {}, "disambiguation": None,
            }
        values = _fetch_values(row_ids, neighbourhoods)

    # 5. Generate answer from template
    template_fn = TEMPLATE_FNS.get(intent, _template_single_value)

    return _make_result(
        template_fn(values, neighbourhoods, years, display_metric),
        intent, display_metric,
        years, neighbourhoods, values, row_ids,
    )