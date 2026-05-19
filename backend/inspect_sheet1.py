import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"

try:
    print("Checking Sheet1 for headers or data at offsets...")
    # Read without headers to see what is in Sheet1
    df = pd.read_excel(file_path, sheet_name='Sheet1', header=None, nrows=20)
    print(f"Sheet1 dimensions (first 20 rows): {df.shape}")
    if not df.empty:
        print("First 10 rows of Sheet1 (raw):")
        print(df.head(10).to_string())
    else:
        print("Sheet1 is completely empty.")
        
except Exception as e:
    print("Error reading Sheet1:", e)
