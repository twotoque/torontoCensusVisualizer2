import chromadb
from sentence_transformers import SentenceTransformer
from data_loader import load_census
from census_registry import CENSUS_YEARS

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path="/Users/dereksong/Documents/torontoCensusVisualizer2/data/chroma")
collection = client.get_or_create_collection("census_rows")

for year, config in CENSUS_YEARS.items():
    df = load_census(config["census"])
    label_col = config["label_col"]
    
    for idx, row in df.iterrows():
        text = f"{row.get('Category', '')} > {row.get('Topic', '')} > {row[label_col]}"
        _id = f"{year}_{row.get('_id', idx)}"
        
        collection.add(
            embeddings=model.encode(text).tolist(),
            documents=[text],
            metadatas=[{
                "year":    year,
                "row_id":  int(row.get('_id', idx)),
                "label":   str(row[label_col]),
            }],
            ids=[_id],
        )
        
print(f"Indexed {collection.count()} rows")