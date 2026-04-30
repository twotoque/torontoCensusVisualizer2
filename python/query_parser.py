# query_parser.py
# Loads the trained Queryparser model and parses natural language census query

# must run build_nlp.py first to generate model!

import json
import re
from functools import lru_cache
from pathlib import Path

import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel

from huggingface_hub import snapshot_download
import os

MODEL_DIR = Path(os.environ.get("MODEL_DIR", Path(__file__).parent / "models" / "query_parser"))

if not MODEL_DIR.exists() or not any(MODEL_DIR.iterdir()):
    snapshot_download(
        repo_id="twotoque/query-parser",
        local_dir=str(MODEL_DIR)
    )
VALID_YEARS = [2001, 2006, 2011, 2016, 2021]
NEIGHBOURHOOD_SUFFIXES = {
    "heights", "village", "west", "east", "north", "south", "centre",
    "center", "park", "corridor", "quarter", "gardens", "town", "valley",
    "woods", "shore", "shores", "beach", "beaches", "point",
}


# define model
# make sure it matches the architecture used during training in build_nlp.py

class QueryParser(nn.Module):
    def __init__(self, encoder_name, n_intents, n_ner_labels, dropout=0.1):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(encoder_name)
        hidden = self.encoder.config.hidden_size
        self.intent_head = nn.Sequential(
            nn.Linear(hidden, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, n_intents),
        )
        self.ner_head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden, n_ner_labels),
        )

    def forward(self, input_ids, attention_mask):
        out     = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        seq_out = out.last_hidden_state
        cls_out = seq_out[:, 0, :]
        return self.intent_head(cls_out), self.ner_head(seq_out)


# loader with caching

@lru_cache(maxsize=1)
def _load():
    with open(MODEL_DIR / "meta.json") as f:
        meta = json.load(f)

    device    = "mps" if torch.backends.mps.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(meta["encoder"])  
    model     = QueryParser(
        encoder_name = meta["encoder"],
        n_intents    = len(meta["intents"]),
        n_ner_labels = len(meta["ner_labels"]),
    ).to(device)

    model.load_state_dict(
        torch.load(MODEL_DIR / "query_parser.pt", map_location=device),
        strict=False,  
    )
    model.eval()

    neighbourhood_lookup = {n.lower(): n for n in meta["neighbourhoods"]}
    return model, tokenizer, meta, device, neighbourhood_lookup

# year extract

def _extract_years(query: str) -> list[int]:
    found = [int(y) for y in re.findall(r'\b(200[1-9]|201[0-9]|202[0-9])\b', query)]
    return sorted(set(y for y in found if y in VALID_YEARS))


# named entity recongition decoding 

def _decode_ner(tokens, ner_ids, id2ner):
    """
    Convert BIO token labels back to spans.
    Returns {"METRIC": [...], "NEIGHBOURHOOD": [...]}
    """
    spans: dict[str, list[str]] = {"METRIC": [], "NEIGHBOURHOOD": []}
    current_label = None
    current_tokens: list[str] = []

    def flush():
        if current_label and current_tokens:
            # join wordpiece tokens with proper spacing
            text = ""
            for t in current_tokens:
                if t.startswith("##"):
                    text += t[2:]                      # continuation -> no space
                else:
                    text += (" " if text else "") + t  # new word -> add space
            text = text.strip()
            if text:
                spans[current_label].append(text)

    for token, ner_id in zip(tokens, ner_ids):
        if token in ("[CLS]", "[SEP]", "[PAD]"):
            flush()
            current_label  = None
            current_tokens = []
            continue

        label = id2ner[ner_id]
        if label == "O":
            flush()
            current_label  = None
            current_tokens = []
        elif label.startswith("B-"):
            flush()
            current_label  = label[2:]
            current_tokens = [token]
        elif label.startswith("I-") and current_label == label[2:]:
            current_tokens.append(token)
        else:
            flush()
            current_label  = None
            current_tokens = []

    flush()
    return spans


def _normalize_neighbourhood_spans(spans: list[str], known_neighbourhoods: list[str]) -> list[str]:
    """
    Expand partial NER spans to the best matching census neighbourhood name.

    The model sometimes extracts a prefix like "York University" for the full
    neighbourhood "York University Heights". Prefer the longest known match.
    """
    if not spans:
        return []

    known_by_lower = {n.lower(): n for n in known_neighbourhoods}
    normalized: list[str] = []

    for span in spans:
        span_clean = span.strip()
        if not span_clean:
            continue

        span_lower = span_clean.lower()

        if span_lower in known_by_lower:
            candidate = known_by_lower[span_lower]
        else:
            candidates = [
                n for n in known_neighbourhoods
                if span_lower in n.lower() or n.lower() in span_lower
            ]
            if candidates:
                candidate = max(candidates, key=len)
            else:
                candidate = span_clean

        if candidate not in normalized:
            normalized.append(candidate)

    return normalized


def _normalize_text(text: str) -> str:
    """Normalize text for loose phrase matching."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _generate_neighbourhood_aliases(name: str) -> list[str]:
    """
    Generate a small set of useful aliases for a neighbourhood name.

    We keep the aliases conservative: exact name, parenthetical prefix, hyphen
    prefix, and a short suffix-stripped form when the final token is a common
    geographic descriptor.
    """
    aliases = {name}

    base = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    if base:
        aliases.add(base)

    if "-" in base:
        aliases.add(base.split("-", 1)[0].strip())

    tokens = base.split()
    if len(tokens) >= 3 and tokens[-1].lower() in NEIGHBOURHOOD_SUFFIXES:
        aliases.add(" ".join(tokens[:-1]))

    return [a for a in aliases if a]


def _extract_neighbourhoods(query: str, known_neighbourhoods: list[str]) -> list[str]:
    """
    Deterministically match neighbourhood phrases in the query.

    This is used before NER output because the model sometimes confuses nearby
    neighbourhoods when names share common tokens like "North" or "South".
    """
    normalized_query = _normalize_text(query)
    matches: list[tuple[int, str]] = []

    for canonical in known_neighbourhoods:
        canonical_norm = _normalize_text(canonical)
        best_alias = None
        best_score = -1
        for alias in _generate_neighbourhood_aliases(canonical):
            alias_norm = _normalize_text(alias)
            if len(alias_norm.split()) < 2 and alias_norm != canonical_norm:
                continue
            if not alias_norm:
                continue
            pattern = rf"(?<!\w){re.escape(alias_norm)}(?!\w)"
            if re.search(pattern, normalized_query):
                score = len(alias_norm.split()) * 100 + len(alias_norm)
                if score > best_score:
                    best_alias = canonical
                    best_score = score
        if best_alias is not None:
            matches.append((best_score, best_alias))

    matches.sort(key=lambda item: item[0], reverse=True)

    result: list[str] = []
    for _, canonical in matches:
        if canonical not in result:
            result.append(canonical)
    return result


# api

def parse(query: str) -> dict:
    """
    Parse a natural language census query into structured components.

    Returns:
    {
        "intent":          str,        # one of INTENTS
        "metric":          str | None, # best metric match from query
        "neighbourhoods":  list[str],  # neighbourhood names found
        "years":           list[int],  # census years found
        "confidence":      float,      # intent confidence 0-1
    }
    """
    model, tokenizer, meta, device, neighbourhood_lookup = _load()

    id2intent = {i: v for i, v in enumerate(meta["intents"])}
    id2ner    = {i: v for i, v in enumerate(meta["ner_labels"])}

    encoding = tokenizer(
        query,
        max_length=128,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        intent_logits, ner_logits = model(
            encoding["input_ids"],
            encoding["attention_mask"],
        )

    # intent of question
    probs      = torch.softmax(intent_logits, dim=1)[0]
    intent_id  = probs.argmax().item()
    confidence = probs[intent_id].item()
    intent     = id2intent[intent_id]

    # named entity recongition (thereafter NER)
    ner_ids = ner_logits[0].argmax(dim=1).tolist()
    tokens  = tokenizer.convert_ids_to_tokens(encoding["input_ids"][0].tolist())
    spans   = _decode_ner(tokens, ner_ids, id2ner)

    direct_matches = _extract_neighbourhoods(query, meta["neighbourhoods"])

    # Restore proper casing and expand partial neighbourhood spans to the
    # longest known census neighbourhood name.
    ner_matches = _normalize_neighbourhood_spans(
        [neighbourhood_lookup.get(n.lower(), n) for n in spans["NEIGHBOURHOOD"]],
        meta["neighbourhoods"],
    )

    # Prefer deterministic phrase matches from the raw query. They are more
    # reliable than the model when names overlap or share directional tokens.
    if direct_matches:
        spans["NEIGHBOURHOOD"] = direct_matches
    elif ner_matches:
        spans["NEIGHBOURHOOD"] = ner_matches
    else:
        query_lower = query.lower().replace("the ", "")
        normalized_query = _normalize_text(query_lower)
        spans["NEIGHBOURHOOD"] = _normalize_neighbourhood_spans(
            [n for n in meta["neighbourhoods"] if _normalize_text(n) in normalized_query],
            meta["neighbourhoods"],
        )
    years = _extract_years(query)

    #defaults
    if not years:
        if intent == "compare_years":
            years = [2016, 2021]
        elif intent == "trend":
            years = VALID_YEARS
        else:
            years = [2021]

    return {
        "intent":         intent,
        "metric":         spans["METRIC"][0] if spans["METRIC"] else None,
        "neighbourhoods": spans["NEIGHBOURHOOD"],
        "years":          years,
        "confidence":     round(confidence, 3),
    }
