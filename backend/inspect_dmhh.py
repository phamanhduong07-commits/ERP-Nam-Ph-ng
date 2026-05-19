import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

dmhh_path = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
dtdh_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"

print("=" * 60)
print("DMHH.xlsx - Danh mục hàng hóa")
print("=" * 60)

xl = pd.ExcelFile(dmhh_path)
print("Sheet names:", xl.sheet_names)

for sheet in xl.sheet_names[:3]:
    print(f"\n--- Sheet: {sheet} ---")
    df = pd.read_excel(dmhh_path, sheet_name=sheet, nrows=5)
    print(f"Columns ({len(df.columns)}):")
    print(df.columns.tolist())
    print("\nFirst 3 rows:")
    for col in df.columns:
        val = df[col].iloc[0] if len(df) > 0 else "N/A"
        print(f"  {col}: {val}")

print("\n")
print("=" * 60)
print("Column analysis - non-null counts")
print("=" * 60)

df_all = pd.read_excel(dmhh_path, nrows=200)
for col in df_all.columns:
    non_null = df_all[col].notna().sum()
    sample = ""
    nn = df_all[col].dropna()
    if not nn.empty:
        sample = str(nn.iloc[0])[:80]
    print(f"  {col:<30} | non-null: {non_null:<5} | sample: {sample}")

print("\n")
print("=" * 60)
print("Looking for customer code column (Ma KH / MaKH)")
print("=" * 60)

df_all_full = pd.read_excel(dmhh_path)
print(f"Total rows in DMHH: {len(df_all_full)}")
# Find columns likely to be customer codes
for col in df_all_full.columns:
    col_lower = col.lower().replace(" ", "").replace("_", "")
    if any(kw in col_lower for kw in ["makH", "makh", "khachhang", "customer", "kh", "loaikh", "KHDIDONG"]):
        unique_vals = df_all_full[col].dropna().nunique()
        sample_vals = df_all_full[col].dropna().unique()[:5]
        print(f"  Candidate column '{col}': {unique_vals} unique vals, samples: {sample_vals}")

# Also check overlap between DMHH and DTDONHANG on MaHang/MaAMIS
print("\n")
print("=" * 60)
print("Checking overlap with DTDONHANG.xlsx on key columns")
print("=" * 60)

dtdh = pd.read_excel(dtdh_path, sheet_name='Sheet2')
print(f"DTDONHANG rows: {len(dtdh)}")

# Check all shared column names
shared_cols = set(df_all_full.columns) & set(dtdh.columns)
print(f"Shared columns between DMHH and DTDONHANG: {sorted(shared_cols)}")
