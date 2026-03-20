import chromadb
from sentence_transformers import SentenceTransformer
from functools import lru_cache

_model  = SentenceTransformer('all-MiniLM-L6-v2')
_client = chromadb.PersistentClient(path="/Users/dereksong/Documents/torontoCensusVisualizer2/data/chroma")
_col    = _client.get_collection("census_rows")

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
    )
    
    return [
        {
            "year":   m["year"],
            "row_id": m["row_id"],
            "label":  m["label"],
            "score":  1 - d,  # chromadb returns distance, convert to similarity
        }
        for m, d in zip(
            results["metadatas"][0],
            results["distances"][0],
        )
    ]