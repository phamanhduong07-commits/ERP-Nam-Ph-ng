import pandas as pd
from sqlalchemy import create_engine, text
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"
db_url = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"

try:
    print("Loading Excel sheet 'Sheet2'...")
    df = pd.read_excel(file_path, sheet_name='Sheet2')
    excel_amis_codes = df['MaAMIS'].dropna().astype(str).str.strip().unique()
    excel_names = df['TenHang'].dropna().astype(str).str.strip().unique()
    print(f"Loaded {len(df)} rows from Excel.")
    print(f"Unique MaAMIS in Excel: {len(excel_amis_codes)}")
    print(f"Unique TenHang in Excel: {len(excel_names)}")
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Check active product count and existing codes in DB
        db_products = conn.execute(text("SELECT id, ma_amis, ten_hang FROM products")).fetchall()
        db_amis_map = {row[1]: row[0] for row in db_products if row[1]}
        db_name_map = {row[2].strip(): row[0] for row in db_products if row[2]}
        
        print(f"\nUnique MaAMIS in DB products: {len(db_amis_map)}")
        print(f"Unique TenHang in DB products: {len(db_name_map)}")
        
        matched_amis = sum(1 for code in excel_amis_codes if code in db_amis_map)
        matched_names = sum(1 for name in excel_names if name in db_name_map)
        
        print(f"\nMatched by MaAMIS: {matched_amis} / {len(excel_amis_codes)}")
        print(f"Matched by TenHang: {matched_names} / {len(excel_names)}")
        
        # Check unique customer codes in database to see if we can map SoPOKH or anything to actual customers
        db_customers = conn.execute(text("SELECT id, ma_kh, ten_viet_tat FROM customers")).fetchall()
        print(f"\nTotal Customers in DB: {len(db_customers)}")
        
except Exception as e:
    print("Error:", e)
