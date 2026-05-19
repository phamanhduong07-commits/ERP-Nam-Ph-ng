"""
Phân tích 7648 dòng thiếu mã KH để tìm cách khôi phục thêm.
"""
import pandas as pd
import numpy as np
import sys
sys.stdout.reconfigure(encoding='utf-8')

dmhh_path   = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
dtdh_path   = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"

print("Đọc dữ liệu...")
dmhh = pd.read_excel(dmhh_path, sheet_name='Sheet2')
dmhh['ma_kh'] = dmhh['MaHH'].astype(str).str.split('_').str[0].str.strip()

dtdh = pd.read_excel(dtdh_path, sheet_name='Sheet2')
dtdh['ma_kh_amis'] = dtdh['MaAMIS'].astype(str).str.split('-').str[0].str.strip()
dtdh['ma_kh_amis'] = dtdh['ma_kh_amis'].replace('nan', np.nan)

# Dòng thiếu MaAMIS (chính là 7648 dòng thiếu mã KH)
missing = dtdh[dtdh['MaAMIS'].isna()].copy()
print(f"\nTổng dòng thiếu MaAMIS: {len(missing)}")

# Thử khớp theo TenHang → TenHH trong DMHH
dmhh_name_to_makH = dict(zip(
    dmhh['TenHH'].astype(str).str.strip(),
    dmhh['ma_kh']
))
missing['ma_kh_by_name'] = missing['TenHang'].astype(str).str.strip().map(dmhh_name_to_makH)
matched_by_name = missing['ma_kh_by_name'].notna().sum()
print(f"Khớp bổ sung theo TenHang==TenHH: {matched_by_name} dòng")

# Kiểm tra dòng vẫn còn thiếu
still_missing = missing[missing['ma_kh_by_name'].isna()]
print(f"\nVẫn thiếu sau khi khớp tên: {len(still_missing)} dòng")

# Khớp mềm: normalize tên (bỏ khoảng trắng, viết thường)
def normalize(s):
    return str(s).lower().strip().replace('  ', ' ')

dmhh_norm_to_makH = {normalize(k): v for k, v in dmhh_name_to_makH.items()}
still_missing['ma_kh_by_norm'] = still_missing['TenHang'].apply(
    lambda x: dmhh_norm_to_makH.get(normalize(x))
)
matched_by_norm = still_missing['ma_kh_by_norm'].notna().sum()
print(f"Khớp bổ sung theo tên normalize: {matched_by_norm} dòng")

# Xem sample các dòng vẫn không có mã KH
final_missing = still_missing[still_missing['ma_kh_by_norm'].isna()]
print(f"\n🔴 Vẫn thiếu hoàn toàn: {len(final_missing)} dòng")
print("\nSample 20 dòng thiếu hoàn toàn (TenHang, DVT, Lop, LoaiThung):")
sample_cols = ['TenHang', 'DVT', 'Lop', 'LoaiThung', 'GiaBan', 'SoLuong', 'NgayGH', 'SoPOKH']
print(final_missing[sample_cols].head(20).to_string())

print("\nTop 20 TenHang phổ biến nhất trong dòng thiếu mã KH:")
print(final_missing['TenHang'].value_counts().head(20))
