# build_nlp.py

# B = Beginning of an entity
#I = Inside (cont of) an entity  
#O = Outside: not part of any entity

#e.g. 
#"What was household income in Malvern from 2016"
# O     O   B-METRIC  I-METRIC O  B-NEIGHBOURHOOD O    O
# O = "What", O = "was", B-METRIC = "household", I-METRIC = "income", O = "in", B-NEIGHBOURHOOD = "Malvern", O = "from", O = "2016"

import os
import json
import random
import re
from pathlib import Path
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel
from collections import Counter

# imports

BASE     = Path("/Users/dereksong/Documents/torontoCensusVisualizer2")
OUT_DIR  = BASE / "python" / "models" / "query_parser"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CENSUS_FILES = {
    2021: (BASE / "data/2021/CityCensusData.csv",  "Neighbourhood Name"),
    2016: (BASE / "data/2016/CityCensusData.csv",  "Characteristic"),
    2011: (BASE / "data/2011/CityCensusData.csv",  "Attribute"),
    2006: (BASE / "data/2006/CityCensusData.csv",  "Attribute"),
    2001: (BASE / "data/2001/CityCensusData.csv",  "Attribute"),
}

DROP_COLS = {"City of Toronto", "_id", "Category", "Topic",
             "Data Source", "Attribute", "Characteristic",
             "Neighbourhood Name"}

VALID_YEARS = [2001, 2006, 2011, 2016, 2021]

# label maps

INTENTS = ["single_value", "compare_years", "trend", "ranking", "cross_neighbourhood"]
INTENT2ID = {v: i for i, v in enumerate(INTENTS)}
ID2INTENT = {i: v for v, i in INTENT2ID.items()}

NER_LABELS = ["O", "B-METRIC", "I-METRIC", "B-NEIGHBOURHOOD", "I-NEIGHBOURHOOD"]
NER2ID     = {v: i for i, v in enumerate(NER_LABELS)}

# class definitions

class CensusQueryDataset(Dataset):
    def __init__(self, data, tokenizer, max_len=128):
        self.data      = data
        self.tokenizer = tokenizer
        self.max_len   = max_len

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item   = self.data[idx]
        ids, mask, ner = build_bio_labels(
            self.tokenizer,
            item["query"],
            item["metric"],
            item["neighbourhoods"],
            self.max_len,
        )
        return {
            "input_ids":      torch.tensor(ids,               dtype=torch.long),
            "attention_mask": torch.tensor(mask,              dtype=torch.long),
            "intent_label":   torch.tensor(INTENT2ID[item["intent"]], dtype=torch.long),
            "ner_labels":     torch.tensor(ner,               dtype=torch.long),
        }

class QueryParser(nn.Module):
    def __init__(self, n_intents, n_ner_labels, dropout=0.1):
        super().__init__()
        self.encoder = AutoModel.from_pretrained("distilbert-base-uncased")

        hidden = self.encoder.config.hidden_size  # 768

        # CLS token -> class
        self.intent_head = nn.Sequential(
            nn.Linear(hidden, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, n_intents),
        )

        # NER head — every token -> label
        self.ner_head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden, n_ner_labels),
        )

    def forward(self, input_ids, attention_mask):
        out     = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        seq_out = out.last_hidden_state # (B, L, 768)
        cls_out = seq_out[:, 0, :]  # (B, 768)

        return self.intent_head(cls_out), self.ner_head(seq_out)

# 1. load data

def load_metrics_and_neighbourhoods():
    metrics        = set()
    neighbourhoods = set()

    for year, (path, label_col) in CENSUS_FILES.items():
        if not path.exists():
            print(f"  skipping {year} — file not found")
            continue
        df = pd.read_csv(path)
        metrics.update(df[label_col].dropna().astype(str).tolist())
        for col in df.columns:
            if col not in DROP_COLS and not col.startswith("Unnamed"):
                neighbourhoods.add(col)

    # clean up: remove very long or numeric-only labels
    metrics = [m for m in metrics if 3 < len(m) < 120 and not m.strip().lstrip('-').isdigit()]
    neighbourhoods = sorted(neighbourhoods)
    print(f"Loaded {len(metrics)} metrics, {len(neighbourhoods)} neighbourhoods")
    return metrics, neighbourhoods


# 2. synthetic data generation

TEMPLATES = {
    "single_value": [
        "What is {metric} in {neighbourhood} in {year}",
        "What was {metric} in {neighbourhood} in {year}",
        "How many {metric} in {neighbourhood} in {year}",
        "Show me {metric} for {neighbourhood} in {year}",
        "{neighbourhood} {metric} {year}",
        "What is the {metric} for {neighbourhood} {year}",
    ],
    "compare_years": [
        "What was the difference in {metric} in {neighbourhood} from {year1} to {year2}",
        "How did {metric} change in {neighbourhood} between {year1} and {year2}",
        "Compare {metric} in {neighbourhood} {year1} vs {year2}",
        "{metric} in {neighbourhood} {year1} and {year2}",
        "How much did {metric} increase in {neighbourhood} from {year1} to {year2}",
        "Did {metric} grow in {neighbourhood} between {year1} and {year2}",
        "{neighbourhood} {metric} change {year1} to {year2}",
    ],
    "trend": [
        "How has {metric} changed in {neighbourhood} over time",
        "Show the trend for {metric} in {neighbourhood}",
        "What is the historical {metric} for {neighbourhood}",
        "{metric} trend in {neighbourhood} over the years",
        "How has {neighbourhood} changed in terms of {metric}",
        "Show me {metric} in {neighbourhood} over all years",
        "Historical {metric} data for {neighbourhood}",
    ],
    "ranking": [
        "Which neighbourhood had the highest {metric} in {year}",
        "Which neighbourhood had the lowest {metric} in {year}",
        "Top neighbourhoods by {metric} in {year}",
        "Rank neighbourhoods by {metric} in {year}",
        "What are the top 5 neighbourhoods for {metric} in {year}",
        "Which area has the most {metric} in {year}",
        "Best neighbourhoods for {metric} {year}",
        "Worst neighbourhoods for {metric} {year}",
    ],
    "cross_neighbourhood": [
        "Compare {metric} between {neighbourhood1} and {neighbourhood2} in {year}",
        "{neighbourhood1} vs {neighbourhood2} {metric} in {year}",
        "How does {metric} in {neighbourhood1} compare to {neighbourhood2} in {year}",
        "Difference in {metric} between {neighbourhood1} and {neighbourhood2} {year}",
        "Is {metric} higher in {neighbourhood1} or {neighbourhood2} in {year}",
        "{neighbourhood1} and {neighbourhood2} {metric} comparison {year}",
    ],
}


def generate_dataset(metrics, neighbourhoods, n_per_intent=120):
    data = []
    for intent, templates in TEMPLATES.items():
        for _ in range(n_per_intent):
            template     = random.choice(templates)
            metric       = random.choice(metrics)
            neighbourhood  = random.choice(neighbourhoods)
            neighbourhood1 = random.choice(neighbourhoods)
            neighbourhood2 = random.choice([n for n in neighbourhoods if n != neighbourhood1])
            year         = random.choice(VALID_YEARS)
            year1, year2 = sorted(random.sample(VALID_YEARS, 2))

            query = template.format(
                metric=metric,
                neighbourhood=neighbourhood,
                neighbourhood1=neighbourhood1,
                neighbourhood2=neighbourhood2,
                year=year,
                year1=year1,
                year2=year2,
            )

            query_neighbourhoods = []
            for n in [neighbourhood, neighbourhood1, neighbourhood2]:
                if n.lower() in query.lower():
                    query_neighbourhoods.append(n)

            data.append({
                "query":           query,
                "intent":          intent,
                "metric":          metric,
                "neighbourhoods":  list(set(query_neighbourhoods)),
            })

    random.shuffle(data)
    return data


# 3. tokenise + build BIO labels

def build_bio_labels(tokenizer, query, metric, neighbourhoods, max_len=128):
    """
    Tokenise query and assign BIO NER labels per token.
    Returns input_ids, attention_mask, ner_labels (all length max_len).
    """
    encoding = tokenizer(
        query,
        max_length=max_len,
        padding="max_length",
        truncation=True,
        return_offsets_mapping=True,
    )
    tokens        = tokenizer.convert_ids_to_tokens(encoding["input_ids"])
    offset_map    = encoding["offset_mapping"]
    query_lower   = query.lower()
    labels        = [NER2ID["O"]] * max_len

    def tag_span(text, b_tag, i_tag):
        text_lower = text.lower()
        start = query_lower.find(text_lower)
        if start == -1:
            return
        end = start + len(text_lower)
        first = True
        for idx, (tok_start, tok_end) in enumerate(offset_map):
            if tok_start == tok_end:   # special token
                continue
            if tok_start >= start and tok_end <= end:
                labels[idx] = NER2ID[b_tag if first else i_tag]
                first = False

    tag_span(metric, "B-METRIC", "I-METRIC")
    for n in neighbourhoods:
        tag_span(n, "B-NEIGHBOURHOOD", "I-NEIGHBOURHOOD")

    return (
        encoding["input_ids"],
        encoding["attention_mask"],
        labels,
    )


# 4. training loop

def train(model, loader, optimizer, device, epochs=20):
    intent_criterion = nn.CrossEntropyLoss()
    ner_criterion    = nn.CrossEntropyLoss(ignore_index=-100)

    model.train()
    for epoch in range(epochs):
        total_loss = 0.0
        intent_correct = 0
        total = 0

        for batch in loader:
            input_ids      = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            intent_labels  = batch["intent_label"].to(device)
            ner_labels     = batch["ner_labels"].to(device)

            intent_logits, ner_logits = model(input_ids, attention_mask)
            i_loss = intent_criterion(intent_logits, intent_labels)

            # NER loss:  flatten (B, L, C) → (B*L, C)
            # B = Batch size (ie. querys in batch)
            # L = sequence length (ie. tokens in query)
            # C = number of NER labels

            B, L, C = ner_logits.shape
            n_loss = ner_criterion(
                ner_logits.view(B * L, C),
                ner_labels.view(B * L),
            )

            loss = i_loss + 0.5 * n_loss
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()

            total_loss     += loss.item()
            intent_correct += (intent_logits.argmax(dim=1) == intent_labels).sum().item()
            total          += len(intent_labels)

        acc = intent_correct / total * 100
        print(f"Epoch {epoch+1:02d}/{epochs}  loss={total_loss/len(loader):.4f}  intent_acc={acc:.1f}%")


# save model

def save(model, tokenizer, neighbourhoods, metrics):
    # saves tokenizer and encoder config
    model.encoder.config.save_pretrained(str(OUT_DIR))
    tokenizer.save_pretrained(str(OUT_DIR))

    heads_only = {
        k: v for k, v in model.state_dict().items()
        if "intent_head" in k or "ner_head" in k
    }
    torch.save(heads_only, OUT_DIR / "query_parser.pt")

    meta = {
        "intents":        INTENTS,
        "ner_labels":     NER_LABELS,
        "neighbourhoods": neighbourhoods,
        "n_metrics":      len(metrics),
        "encoder":        "distilbert-base-uncased", 
    }
    with open(OUT_DIR / "meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Saved heads to {OUT_DIR / 'query_parser.pt'}")
    print(f"Size: {(OUT_DIR / 'query_parser.pt').stat().st_size / 1e6:.1f}MB")

#main fn

def main():
    random.seed(42)
    torch.manual_seed(42)

    device = (
        "mps"  if torch.backends.mps.is_available() else
        "cuda" if torch.cuda.is_available()         else
        "cpu"
    )
    print(f"Device: {device}")

    # 1. load real labels
    print("\nLoading census labels...")
    metrics, neighbourhoods = load_metrics_and_neighbourhoods()

    # 2. generate training data
    print("\nGenerating synthetic training data...")
    data = generate_dataset(metrics, neighbourhoods, n_per_intent=120)
    print(f"Generated {len(data)} training examples")

    dist = Counter(d["intent"] for d in data)
    for intent, count in dist.items():
        print(f"  {intent}: {count}")

    print("\nLoading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    dataset   = CensusQueryDataset(data, tokenizer)
    loader    = DataLoader(dataset, batch_size=16, shuffle=True)

    model = QueryParser(
        n_intents=len(INTENTS),
        n_ner_labels=len(NER_LABELS),
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5, weight_decay=0.01)

    print("\nTraining...")
    train(model, loader, optimizer, device, epochs=20)

    save(model, tokenizer, neighbourhoods, metrics)
    print("Done.")


if __name__ == "__main__":
    main()