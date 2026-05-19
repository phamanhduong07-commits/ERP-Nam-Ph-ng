import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"

try:
    print("Loading all rows of 'Sheet2' to find customer identifiers...")
    df = pd.read_excel(file_path, sheet_name='Sheet2')
    print(f"Loaded {len(df)} rows.")
    
    # Check unique values of columns that might represent Customer or codes
    for col in ['SoPOKH', 'MaAMIS', 'ChonAMIS', 'LoaiThung', 'TinhTrang']:
        if col in df.columns:
            non_null = df[col].dropna()
            unique_count = non_null.nunique()
            print(f"\nColumn '{col}': {unique_count} unique values (out of {len(non_null)} non-null rows)")
            print("Top 10 unique values:")
            print(non_null.unique()[:10])
            
    # Search all text columns for customer-like terms (e.g. "CTY", "Công ty", "KH")
    print("\nSearching text columns for customer hints...")
    for col in df.select_dtypes(include=['object']).columns:
        samples_with_cty = df[col].astype(str).str.contains("CTY|Công ty|TNHH|KH_", case=False, na=False)
        if samples_with_cty.sum() > 0:
            print(f"Column '{col}' has {samples_with_cty.sum()} rows containing CTY/Công ty/TNHH/KH_")
            print("Sample values:")
            print(df.loc[samples_with_cty, col].unique()[:5])
            
except Exception as e:
    print("Error:", e)
