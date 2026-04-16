import chromadb
import torch
from transformers import AutoTokenizer, AutoModel
from functools import lru_cache

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

@lru_cache(maxsize=1)
def _load_model():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModel.from_pretrained(MODEL_NAME)
    model.eval()
    return tokenizer, model

def _encode(text: str) -> list[float]:
    tokenizer, model = _load_model()
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
    # mean pooling
    attention_mask = inputs["attention_mask"]
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    embedding = torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    # normalize
    embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
    return embedding[0].tolist()

_client = chromadb.PersistentClient(path="/app/data/chroma")
_col    = _client.get_collection("census_rows")


def find_row_in_year(curr_label: str, target_year: int) -> tuple[int | None, float]:
    """
    Given a label from one year, find the best matching row_id in target_year.
    Returns (row_id, score) or (None, 0.0) if no match found.
    """
    results = semantic_search(curr_label, year=target_year, limit=3)
    if not results:
        return None, 0.0
    best = results[0]
    return best["row_id"], best["score"]


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
    
    embedding = _encode(query)
    where = {"year": {"$eq": year}} if year else None
    results = _col.query(
        query_embeddings=[embedding],
        n_results=limit,
        where=where,
        include=["metadatas", "distances", "documents"],
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