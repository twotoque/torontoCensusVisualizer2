import pandas as pd

file_path = '/Users/dereksong/Documents/torontoCensusVisualizer2/data/weights/140_to_158.parquet'
df = pd.read_parquet(file_path)
pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', None)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', None)

output_path = 'census_full_report.txt'

with open(output_path, 'w') as f:
    def log_all(title, data):
        header = f"\n{'='*20} {title} {'='*20}\n"
        print(header)
        print(data)
        f.write(header + str(data) + "\n")

    log_all("COLUMNS", df.columns.tolist())
    log_all("SHAPE", df.shape)
    log_all("HEAD (20)", df.head(20))
    log_all("WEIGHT DESCRIPTION", df['weight'].describe())
    
    low_weights = df[df['weight'] < 0.95].sort_values('weight')
    log_all("ALL WEIGHTS < 0.95", low_weights)

print(f"\nSuccess! Full data exported to {output_path} with zero truncation.")