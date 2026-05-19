"""
Bước 1: Xuất toàn bộ mã KH từ DB ERP ra file để xem cấu trúc
và so sánh với prefix từ MaHH / MaAMIS
"""
import pandas as pd
from sqlalchemy import create_engine, text
import sys
sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
output_path = r"C:\Users\TUF\Desktop\New folder\bd_ma_kh_ERP.xlsx"

engine = create_engine(db_url)
with engine.connect() as conn:
    # Lấy toàn bộ bảng khách hàng
    df_kh = pd.read_sql(text("SELECT id, ma_kh, ten_viet_tat, ten_don_vi FROM customers ORDER BY ma_kh"), conn)

print(f"Tổng khách hàng trong DB: {len(df_kh)}")
print(f"\nSample 30 dòng đầu:")
print(df_kh.head(30).to_string())

# Xuất ra file để xem
df_kh.to_excel(output_path, index=False)
print(f"\n✅ Đã xuất ra: {output_path}")

# Phân tích cấu trúc mã KH trong DB
print("\n--- Phân tích cấu trúc mã_kh ---")
# Mã có dạng tiền tố 3-4 ký tự không?
df_kh['prefix'] = df_kh['ma_kh'].astype(str).str[:3]
print("Mẫu mã KH (20 dòng đầu):")
for _, row in df_kh.head(20).iterrows():
    print(f"  ma_kh={row['ma_kh']:<20} | ten_viet_tat={row['ten_viet_tat']}")
