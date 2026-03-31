import pandas as pd
import os
import glob

def split_csv(source_filepath, output_dir, max_size_mb=99):
    if not os.path.exists(output_dir):
        print(f"Creating directory: {output_dir}")
        os.makedirs(output_dir)
    
    max_bytes = max_size_mb * 1024 * 1024
    
    source_filepath = os.path.abspath(source_filepath)
    
    with open(source_filepath, 'r', encoding='utf-8') as f:
        header = f.readline()
        header_bytes = len(header.encode('utf-8'))
        
        file_count = 1
        current_bytes = 0
        
        current_output_path = os.path.join(output_dir, f'split_{file_count}.csv')
        out_file = open(current_output_path, 'w', encoding='utf-8')
        out_file.write(header)
        current_bytes = header_bytes
        
        for line in f:
            line_bytes = len(line.encode('utf-8'))
            
            if current_bytes + line_bytes > max_bytes:
                out_file.close()
                file_count += 1
                current_output_path = os.path.join(output_dir, f'split_{file_count}.csv')
                out_file = open(current_output_path, 'w', encoding='utf-8')
                out_file.write(header)
                current_bytes = header_bytes
            
            out_file.write(line)
            current_bytes += line_bytes
            
        out_file.close()
        print(f"Done! Split into {file_count} files in '{output_dir}'.")

def validate_split(original_path, output_dir):
    print("Reading original file (this may take a moment)...")
    df_orig = pd.read_csv(original_path)
    original_row_count = len(df_orig)
    
    split_files = glob.glob(os.path.join(output_dir, "split_*.csv"))
    total_split_rows = 0
    
    print(f"Validating {len(split_files)} split files...")
    
    for file in split_files:
        df_temp = pd.read_csv(file)
        total_split_rows += len(df_temp)
        
    print("--- Results ---")
    print(f"Original Rows:    {original_row_count}")
    print(f"Total Split Rows: {total_split_rows}")
    
    if original_row_count == total_split_rows:
        print("Success! Data integrity verified.")
    else:
        diff = abs(original_row_count - total_split_rows)
        print(f"Error! Row mismatch. Difference: {diff} rows.")

input_csv = '/Users/dereksong/Documents/torontoCensusVisualizer2/python/build_helper/Cleared Building Permits since 2017 (1).csv'
output_folder = './output_folder'

split_csv(input_csv, output_folder)
validate_split(input_csv, output_folder)