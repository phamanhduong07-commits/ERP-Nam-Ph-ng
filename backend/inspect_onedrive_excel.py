import pandas as pd
import os
import sys

# Force UTF-8 output just in case
sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"
output_path = r"d:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend\inspect_result.txt"

print("Checking file path:", file_path)
if not os.path.exists(file_path):
    print("File does not exist!")
    exit(1)

try:
    print("Loading Excel sheet 'Sheet2'...")
    # Load Sheet2, let's read the first 100 rows to understand the data
    df = pd.read_excel(file_path, sheet_name='Sheet2', nrows=100)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"Excel File: {file_path}\n")
        f.write(f"Total Rows read for inspection: {len(df)}\n")
        f.write(f"Total Columns: {len(df.columns)}\n\n")
        
        f.write("Columns list:\n")
        f.write(", ".join(df.columns.tolist()) + "\n\n")
        
        f.write("Non-null counts & Sample values for each column:\n")
        f.write(f"{'Column Name':<25} | {'Type':<12} | {'Non-Null':<8} | {'Sample Value'}\n")
        f.write("-" * 80 + "\n")
        for col in df.columns:
            non_null = df[col].notna().sum()
            col_type = str(df[col].dtype)
            sample = ""
            non_null_vals = df[col].dropna()
            if not non_null_vals.empty:
                sample = str(non_null_vals.iloc[0])
            f.write(f"{col:<25} | {col_type:<12} | {non_null:<8} | {sample}\n")
            
        f.write("\n" + "="*50 + "\n")
        f.write("First 5 rows of data:\n")
        f.write(df.head(5).to_string())
        
    print("Inspection result successfully written to:", output_path)
except Exception as e:
    print("Error reading Excel:", e)
