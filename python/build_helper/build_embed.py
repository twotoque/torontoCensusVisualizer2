# Builds ChromaDB embeddings for all census years.
# Uses hierarchy paths for better cross-year label matching and disambiguation.

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import chromadb
from sentence_transformers import SentenceTransformer
from data_loader import load_census, get_label_depth
from census_registry import CENSUS_YEARS


# setup

model  = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(
    path="/Users/dereksong/Documents/torontoCensusVisualizer2/data/chroma"
)

# delete / recreate collections for clean state
try:
    client.delete_collection("census_rows")
    print("Deleted existing collection.")
except Exception:
    pass

collection = client.get_or_create_collection("census_rows")


def build_hierarchy_path(df: pd.DataFrame, row_idx: int, label_col: str) -> str:
    """
    Build full ancestor path for a census row based on indentation depth.
 
    Example:
        Mother tongue > Single responses > Official languages > English
 
    Indentation in census CSVs encodes tree depth:
        2 spaces per level (e.g. "  English" = depth 1, "    French" = depth 2)
    """
    current_label = df.iloc[row_idx][label_col]
    current_depth = get_label_depth(current_label)

    path = [current_label.strip()]

    # walk backwards to find parent labels by indentation
    for i in range(row_idx - 1, -1, -1):
        parent_label = df.iloc[i][label_col]
        parent_depth = get_label_depth(parent_label)
        if parent_depth < current_depth:
            path.insert(0, parent_label.strip())
            current_depth = parent_depth
        if current_depth == 0:
            break

    # add Category and Topic columns if present (2016 and earlier)
    row = df.iloc[row_idx]
    prefix = []
    if "Category" in df.columns and str(row.get("Category", "")).strip():
        prefix.append(str(row["Category"]).strip())
    if "Topic" in df.columns and str(row.get("Topic", "")).strip():
        prefix.append(str(row["Topic"]).strip())

    # avoids duplicating if the top of path already matches Topic
    if prefix and path[0] == prefix[-1]:
        path = prefix[:-1] + path
    else:
        path = prefix + path

    return " > ".join(path)


# index all years

total = 0

for year, config in CENSUS_YEARS.items():
    print(f"\nIndexing {year}...")

    df = load_census(
        config["census"],
        drop_cols=tuple(config.get("drop_cols", ())),
    )
    label_col = config["label_col"]

    ids         = []
    embeddings  = []
    documents   = []
    metadatas   = []

    for idx in range(len(df)):
        row = df.iloc[idx]

        label = str(row[label_col])
        if not label.strip():
            continue  # skip blank rows

        # Build hierarchy path for richer embedding context
        text  = build_hierarchy_path(df, idx, label_col)

        # Use _id column if available (2016+), otherwise use positional index
        row_id = int(row["_id"]) if "_id" in df.columns else idx

        _id = f"{year}_{row_id}"

        ids.append(_id)
        embeddings.append(model.encode(text).tolist())
        documents.append(text)
        metadatas.append({
            "year":   year,
            "row_id": row_id,
            "label":  str(row["Combined_Label"]) if "Combined_Label" in df.columns else label,
        })

    # Batch upsert for efficiency
    BATCH = 500
    for start in range(0, len(ids), BATCH):
        collection.add(
            ids=ids[start:start + BATCH],
            embeddings=embeddings[start:start + BATCH],
            documents=documents[start:start + BATCH],
            metadatas=metadatas[start:start + BATCH],
        )

    count = len(ids)
    total += count
    print(f"  {year}: indexed {count} rows")

print(f"\nDone. Total indexed: {collection.count()} rows")