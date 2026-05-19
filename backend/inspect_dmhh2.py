import pandas as pd
import sys
sys.stdout.reconfigure(encoding='utf-8')

dmhh_path = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
dtdh_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"

print("=" * 60)
print("Reading DMHH Sheet2 fully")
print("=" * 60)

df_dmhh = pd.read_excel(dmhh_path, sheet_name='Sheet2')
print(f"Rows: {len(df_dmhh)}, Columns: {len(df_dmhh.columns)}")
print("Columns:", df_dmhh.columns.tolist())
print(f"\nNon-null counts:")
for col in df_dmhh.columns:
    nn = df_dmhh[col].notna().sum()
    sample = str(df_dmhh[col].dropna().iloc[0])[:60] if nn > 0 else ""
    print(f"  {col:<20} | {nn:<6} | {sample}")

print("\nFirst 5 rows - MaHH column:")
print(df_dmhh['MaHH'].head(10).tolist())

# The key in DMHH is MaHH - check structure
# MaHH looks like "A&M_32*19*41_3L" - prefix before _ is likely customer code
print("\n")
print("=" * 60)
print("Extracting customer prefix from MaHH (before first underscore)")
print("=" * 60)

df_dmhh['ma_kh_prefix'] = df_dmhh['MaHH'].astype(str).str.split('_').str[0]
unique_prefixes = df_dmhh['ma_kh_prefix'].value_counts()
print(f"Total unique customer prefixes: {len(unique_prefixes)}")
print("Top 20 prefixes (ma_kh):")
print(unique_prefixes.head(20))

print("\n")
print("=" * 60)
print("Loading DTDONHANG to check MaAMIS vs MaHH overlap")
print("=" * 60)

dtdh = pd.read_excel(dtdh_path, sheet_name='Sheet2')
print(f"DTDONHANG rows: {len(dtdh)}")

dtdh_amis = dtdh['MaAMIS'].dropna().astype(str).str.strip()
dmhh_mahh = df_dmhh['MaHH'].dropna().astype(str).str.strip()

overlap = set(dtdh_amis) & set(dmhh_mahh)
print(f"Overlap MaAMIS (DTDONHANG) vs MaHH (DMHH): {len(overlap)} matched")
print(f"Sample overlapping codes: {list(overlap)[:10]}")

# Also check ChonAMIS column (which has numeric IDs) vs internal DB IDs
print("\nSample MaAMIS in DTDONHANG (non-null):")
print(dtdh_amis.unique()[:15])
print("\nSample MaHH in DMHH:")
print(dmhh_mahh.unique()[:15])
