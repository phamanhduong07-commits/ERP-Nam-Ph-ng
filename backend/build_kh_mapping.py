"""
Tạo bảng đề xuất mapping: mã KH cũ (DMHH prefix) → ma_kh ERP DB
Dùng fuzzy matching tên để gợi ý, người dùng xác nhận.
"""
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from difflib import get_close_matches
import sys
sys.stdout.reconfigure(encoding='utf-8')

db_url    = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
dmhh_path = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
out_map   = r"C:\Users\TUF\Desktop\New folder\bang_chuyen_doi_ma_kh.xlsx"

# ── 1. Lấy BD KH từ ERP ─────────────────────────────────────────
engine = create_engine(db_url)
with engine.connect() as conn:
    df_kh = pd.read_sql(text("SELECT id, ma_kh, ten_viet_tat FROM customers ORDER BY ma_kh"), conn)

db_ma_kh_list   = df_kh['ma_kh'].tolist()
db_ten_list      = df_kh['ten_viet_tat'].astype(str).tolist()
db_ten_to_makH   = dict(zip(df_kh['ten_viet_tat'].astype(str), df_kh['ma_kh']))
db_makH_to_ten   = dict(zip(df_kh['ma_kh'].astype(str), df_kh['ten_viet_tat']))

# ── 2. Lấy danh sách prefix KH từ DMHH ──────────────────────────
dmhh = pd.read_excel(dmhh_path, sheet_name='Sheet2')
dmhh['prefix'] = dmhh['MaHH'].astype(str).str.split('_').str[0].str.strip()

# Đếm số sản phẩm theo prefix (để biết prefix nào quan trọng)
prefix_counts = dmhh.groupby('prefix').agg(
    so_sp=('MaHH', 'count'),
    ten_mau=('TenHH', 'first')
).reset_index()
prefix_counts = prefix_counts[prefix_counts['prefix'].str.len() >= 2]
prefix_counts = prefix_counts.sort_values('so_sp', ascending=False)

print(f"Tổng prefix KH trong DMHH: {len(prefix_counts)}")
print(f"Tổng KH trong ERP DB: {len(df_kh)}")

# ── 3. Fuzzy match prefix → ten_viet_tat DB ─────────────────────
print("\nĐang fuzzy match (vài giây)...")

rows = []
for _, r in prefix_counts.iterrows():
    prefix = r['prefix']
    so_sp  = r['so_sp']
    ten_mau = r['ten_mau']
    
    # Tìm trong DB: exact match trước
    exact = df_kh[df_kh['ma_kh'] == prefix]
    if not exact.empty:
        rows.append({
            'Ma_KH_Cu':        prefix,
            'So_SP_DMHH':      so_sp,
            'Ten_Mau_DMHH':    ten_mau,
            'Ma_KH_ERP':       exact.iloc[0]['ma_kh'],
            'Ten_KH_ERP':      exact.iloc[0]['ten_viet_tat'],
            'Ty_le_tin_cay':   '100% - Khớp chính xác',
            'GHI_CHU':         'AUTO_MATCHED'
        })
        continue
    
    # Fuzzy match theo prefix gần giống ten_viet_tat
    matches = get_close_matches(prefix, db_ma_kh_list, n=3, cutoff=0.5)
    if matches:
        best = matches[0]
        rows.append({
            'Ma_KH_Cu':        prefix,
            'So_SP_DMHH':      so_sp,
            'Ten_Mau_DMHH':    ten_mau,
            'Ma_KH_ERP':       best,
            'Ten_KH_ERP':      db_makH_to_ten.get(best, ''),
            'Ty_le_tin_cay':   f'Gợi ý fuzzy: {matches}',
            'GHI_CHU':         'CẦN XÁC NHẬN'
        })
    else:
        rows.append({
            'Ma_KH_Cu':        prefix,
            'So_SP_DMHH':      so_sp,
            'Ten_Mau_DMHH':    ten_mau,
            'Ma_KH_ERP':       '',
            'Ten_KH_ERP':      '',
            'Ty_le_tin_cay':   'Không tìm thấy',
            'GHI_CHU':         'NHẬP TAY'
        })

df_map = pd.DataFrame(rows)

# Thống kê
auto    = (df_map['GHI_CHU'] == 'AUTO_MATCHED').sum()
confirm = (df_map['GHI_CHU'] == 'CẦN XÁC NHẬN').sum()
manual  = (df_map['GHI_CHU'] == 'NHẬP TAY').sum()

print(f"\nKết quả mapping:")
print(f"  ✅ Khớp chính xác (AUTO)  : {auto} prefix")
print(f"  🟡 Gợi ý fuzzy (XÁC NHẬN): {confirm} prefix")
print(f"  🔴 Không tìm thấy (TAY)   : {manual} prefix")

# ── 4. Ghi file Excel ────────────────────────────────────────────
with pd.ExcelWriter(out_map, engine='openpyxl') as writer:
    # Sheet 1: bảng mapping để điền
    df_map.to_excel(writer, sheet_name='Bang chuyen doi', index=False)
    
    # Sheet 2: danh sách KH ERP để tra cứu
    df_kh[['ma_kh', 'ten_viet_tat']].rename(
        columns={'ma_kh': 'Ma_KH_ERP', 'ten_viet_tat': 'Ten_KH_ERP'}
    ).to_excel(writer, sheet_name='DS KH ERP (tra cuu)', index=False)

print(f"\n✅ File đã xuất: {out_map}")
print("\nHướng dẫn:")
print("  1. Mở file 'bang_chuyen_doi_ma_kh.xlsx'")
print("  2. Sheet 'Bang chuyen doi': điền/sửa cột 'Ma_KH_ERP' cho các dòng 'CẦN XÁC NHẬN' và 'NHẬP TAY'")
print("  3. Tra cứu mã KH ERP ở sheet 'DS KH ERP (tra cuu)'")
print("  4. Lưu file lại → báo em để chạy bước cuối tổng hợp")
