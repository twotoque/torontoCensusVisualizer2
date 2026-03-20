import pandas as pd
weights = pd.read_parquet("/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet")
print(weights[weights["AREA_NAME_1"] == "Malvern"])