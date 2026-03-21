import chromadb
from sentence_transformers import SentenceTransformer
from functools import lru_cache

_model  = SentenceTransformer('all-MiniLM-L6-v2')
_client = chromadb.PersistentClient(path="/Users/dereksong/Documents/torontoCensusVisualizer2/data/chroma")
_col    = _client.get_collection("census_rows")

def semantic_search_with_disambiguation(
    query: str,
    year: int | None = None,
    limit: int = 5,
    similarity_threshold: float = 0.05,  # scores within this range are "similar"
    min_score: float = 0.1,  # reject results below this entirely
) -> tuple[list[dict], bool]:
    """
    Returns (results, needs_disambiguation).
    needs_disambiguation is True if top results are too close to call.
    """
    results = semantic_search(query, year=year, limit=limit)
    results = [r for r in results if r["score"] > min_score]
    if not results:
        return [], False
    
    top_score = results[0]["score"]
    similar = [r for r in results if top_score - r["score"] <= similarity_threshold]
    needs_disambiguation = len(similar) > 1
    return similar if needs_disambiguation else results[:1], needs_disambiguation

def semantic_search(
    query: str,
    year: int | None = None,
    limit: int = 5,
) -> list[dict]:
    """
    Returns list of {year, row_id, label, score} sorted by relevance.
    Optionally filtered by year.
    """
    embedding = _model.encode(query).tolist()
    
    where = {"year": {"$eq": year}} if year else None
    
    results = _col.query(
        query_embeddings=[embedding],
        n_results=limit,
        where=where,
        include=["metadatas", "distances", "documents"],  # add documents
    )
    
    return [
    {
        "year":     m["year"],
        "row_id":   m["row_id"],
        "label":    m["label"].strip(),
        "document": d,
        "score":    1 - dist, # chromadb returns distance, convert to similarity
    }
    for m, d, dist in zip(
        results["metadatas"][0],
        results["documents"][0],
        results["distances"][0],
    )
]