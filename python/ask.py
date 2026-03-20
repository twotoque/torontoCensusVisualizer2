# ask.py
#
# 1.   parse(query) = intent, metric, neighbourhoods, years  (PyTorch model)
# 2. semantic_search(...) = row_ids per year  (ChromaDB RAG)
# 3. fetch_values(...) = actual census numbers  (data_loader)
# 4. format_answer(...) = human-readable string  (templates)
#
# Everything is localish 

from query_parser import parse
from rag import semantic_search
from data_loader import load_census
from census_registry import get_paths, CENSUS_YEARS
import pandas as pd

# import the weight "Translator" fn 
weights_df = pd.read_parquet("/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet")

# training wheels for the RAG
ENRICHMENTS = {
    "population": "total population count",
    "income":     "average household total income",
    "housing":    "dwelling units",
    "neighbourhood number": "Neighbourhood Number",
}
BLOCKED_LABELS = {
    "Neighbourhood Number",
    "TSNS2020 Designation", 
    "Neighbourhood Name",
}


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
    for word in ["what was", "what is", "show me", "how did", "compare",
                 "which neighbourhood", "highest", "lowest", "over time",
                 "changed", "difference", "between", "and", "in", "the",
                 "from", "to", "how has", "historical", "trend", "terms of"]:
        cleaned = cleaned.replace(word, " ")
    cleaned = " ".join(cleaned.split()).strip()
    return ENRICHMENTS.get(cleaned, cleaned)  


def _get_row_ids(query: str, neighbourhoods: list[str], years: list[int]) -> dict:
    search_query = _clean_query_for_rag(query, neighbourhoods, years)
    if not search_query:
        search_query = query

    row_ids = {}
    for year in years:
        results = semantic_search(search_query, year=year, limit=5)  
        for r in results:
            if r["score"] > 0.05 and r["label"].strip() not in BLOCKED_LABELS:
                row_ids[year] = r["row_id"]
                break 
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

def answer(query: str) -> dict:
    """
    Answer a natural language Toronto census question.

    Returns:
    {
        "answer":  str,   # human-readable answer
        "intent":  str,   # detected intent
        "metric":  str,   # matched census metric label
        "context": dict,  # raw values used to generate the answer
    }
    """
    # 1. parse query with PyTorch model
    parsed = parse(query)
    intent        = parsed["intent"]
    metric_query  = parsed["metric"] or query  # fallback to full query if NER missed
    neighbourhoods = parsed["neighbourhoods"]
    years         = parsed["years"]

    # 2. RAG:find matching row per year
    row_ids = _get_row_ids(query, neighbourhoods, years)
    if not row_ids:
        return {
            "answer":  "Could not find a matching census metric for your query.",
            "intent":  intent,
            "metric":  metric_query,
            "context": {},
        }

    rag_results = semantic_search(
        _clean_query_for_rag(query, neighbourhoods, years) or query,
        year=None, limit=1
    )
    display_metric = rag_results[0]["label"] if rag_results else query

    # 3. Fetch values 
    if intent == "ranking":
        # Need all neighbourhoods for ranking
        year  = years[0]
        rid   = row_ids.get(year)
        if rid is None:
            return {"answer": f"No data for {year}.", "intent": intent,
                    "metric": display_metric, "context": {}}
        all_vals = _fetch_all_neighbourhoods_for_year(rid, year)
        values   = {year: all_vals}
        neighbourhoods = list(all_vals.keys())  

    else:
        # Need specific neighbourhoods (a specific request)
        if not neighbourhoods:
            return {
                "answer":  "Could not identify a neighbourhood in your query. "
                           "Try including a Toronto neighbourhood name such as "
                           "'Malvern', 'Annex', or 'Scarborough Village'.",
                "intent":  intent,
                "metric":  display_metric,
                "context": {},
            }
        values = _fetch_values(row_ids, neighbourhoods)

    # 4. Generate answer from template
    template_fn = TEMPLATE_FNS.get(intent, _template_single_value)
    answer_text = template_fn(values, neighbourhoods, years, display_metric)

    return {
        "answer":  answer_text,
        "intent":  intent,
        "metric":  display_metric,
        "context": {"years": years, "neighbourhoods": neighbourhoods, "values": values},
    }

