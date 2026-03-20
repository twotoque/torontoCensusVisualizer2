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

MODEL_DIR = Path("/Users/dereksong/Documents/torontoCensusVisualizer2/python/models/query_parser")
VALID_YEARS = [2001, 2006, 2011, 2016, 2021]


# define model
# make sure it matches the architecture used during training in build_nlp.py

class QueryParser(nn.Module):
    def __init__(self, n_intents, n_ner_labels, dropout=0.1):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(str(MODEL_DIR))
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

    # estore proper casing on neighbourhood names from NER
    spans["NEIGHBOURHOOD"] = [
        neighbourhood_lookup.get(n.lower(), n)
        for n in spans["NEIGHBOURHOOD"]
    ]

    # fallback: direct substring match against known neighbourhood list
    if not spans["NEIGHBOURHOOD"]:
        query_lower = query.lower()
        spans["NEIGHBOURHOOD"] = [
            n for n in meta["neighbourhoods"]
            if n.lower() in query_lower
        ]

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