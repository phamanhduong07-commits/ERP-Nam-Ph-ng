"""
Script FINAL: Merge DMHH + DTDONHANG, dùng BD mã KH từ ERP làm chuẩn.

Quy trình map mã KH (theo độ ưu tiên):
  T1. MaAMIS prefix   : "HOV-296"        → prefix = "HOV"  → map vs DB ma_kh
  T2. Tên hàng exact  : TenHang == TenHH → lấy MaHH prefix → map vs DB ma_kh
  T3. Tên hàng norm   : lowercase strip  → map vs DB ma_kh  
  T4. Tiền tố trong TenHang: "DPP5L046-Thùng..." → extract "DPP" → map vs DB
  T5. Khớp mềm tên KH : vd "NLCA" → "NL CA" → tìm trong ten_viet_tat DB

Output file Excel 3 sheets + 1 sheet thống kê.
"""
import pandas as pd
import numpy as np
import re
from sqlalchemy import create_engine, text
import sys
sys.stdout.reconfigure(encoding='utf-8')

# ── Cấu hình ────────────────────────────────────────────────────
db_url      = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
dmhh_path   = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
dtdh_path   = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"
output_path = r"C:\Users\TUF\Desktop\New folder\import_bao_gia_ERP_v2.xlsx"

# ── 1. Load bảng khách hàng từ DB (nguồn chuẩn) ─────────────────
print("1. Đọc bảng KH từ ERP Database...")
engine = create_engine(db_url)
with engine.connect() as conn:
    df_kh_db = pd.read_sql(
        text("SELECT id, ma_kh, ten_viet_tat FROM customers WHERE trang_thai = true ORDER BY ma_kh"),
        conn
    )
print(f"   → {len(df_kh_db)} khách hàng active trong DB")

# Tập hợp mã KH hợp lệ (để validate)
valid_ma_kh = set(df_kh_db['ma_kh'].astype(str).str.strip())

# Map ten_viet_tat → ma_kh (dùng cho fallback tìm theo tên)
name_to_makH_db = {
    row['ten_viet_tat'].strip(): row['ma_kh']
    for _, row in df_kh_db.iterrows()
    if pd.notna(row['ten_viet_tat'])
}

# ── 2. Load DMHH ─────────────────────────────────────────────────
print("2. Đọc DMHH.xlsx...")
dmhh = pd.read_excel(dmhh_path, sheet_name='Sheet2')
dmhh['ma_kh_prefix'] = dmhh['MaHH'].astype(str).str.split('_').str[0].str.strip()
# Chỉ giữ prefix đã xác thực trong DB
dmhh['ma_kh_valid'] = dmhh['ma_kh_prefix'].where(dmhh['ma_kh_prefix'].isin(valid_ma_kh))

# Map: TenHH → ma_kh (đã validate vs DB)
ten_hh_to_makH = {}
for _, row in dmhh.iterrows():
    if pd.notna(row.get('ma_kh_valid')) and pd.notna(row.get('TenHH')):
        ten_hh_to_makH[str(row['TenHH']).strip()] = row['ma_kh_valid']

# Map normalize
def normalize(s):
    return re.sub(r'\s+', ' ', str(s).lower().strip())

ten_hh_norm_to_makH = {normalize(k): v for k, v in ten_hh_to_makH.items()}

print(f"   → {len(dmhh)} sản phẩm trong DMHH")
print(f"   → {len(ten_hh_to_makH)} sản phẩm có mã KH hợp lệ")

# ── 3. Load DTDONHANG ────────────────────────────────────────────
print("3. Đọc DTDONHANG.xlsx...")
dtdh = pd.read_excel(dtdh_path, sheet_name='Sheet2')
print(f"   → {len(dtdh)} dòng")

# ── 4. Hàm tìm mã KH theo 5 tầng ────────────────────────────────
def find_ma_kh(row):
    # T1: MaAMIS prefix ("HOV-296" → "HOV")
    ma_amis = str(row.get('MaAMIS', '') or '').strip()
    if ma_amis and ma_amis != 'nan':
        prefix = ma_amis.split('-')[0].strip()
        if prefix in valid_ma_kh:
            return prefix, 'T1_MaAMIS'

    ten = str(row.get('TenHang', '') or '').strip()

    # T2: TenHang khớp chính xác TenHH trong DMHH
    if ten in ten_hh_to_makH:
        return ten_hh_to_makH[ten], 'T2_TenHang_Exact'

    # T3: TenHang normalize
    norm_ten = normalize(ten)
    if norm_ten in ten_hh_norm_to_makH:
        return ten_hh_norm_to_makH[norm_ten], 'T3_TenHang_Norm'

    # T4: Mã code nhúng ở đầu TenHang (VD: "DPP5L046-Thùng..." → "DPP")
    # Pattern: 2-6 ký tự chữ cái đầu + có thể số + dấu gạch
    match = re.match(r'^([A-Z]{2,6})\d*[-_]', ten)
    if match:
        code = match.group(1)
        if code in valid_ma_kh:
            return code, 'T4_Prefix_TenHang'

    # T5: Prefix 4 ký tự đầu của TenHang chứa mã KH
    # VD: "NLCA101_237-Thùng Medline..." → thử "NLCA", "NLC", "NL"
    for length in (4, 3):
        prefix = ten[:length].strip()
        if prefix in valid_ma_kh:
            return prefix, f'T5_Head{length}'

    return None, 'NOT_FOUND'

# ── 5. Áp dụng mapping ───────────────────────────────────────────
print("4. Đang map mã KH cho 35.319 dòng...")
results = dtdh.apply(find_ma_kh, axis=1, result_type='expand')
dtdh['ma_kh']        = results[0]
dtdh['ma_kh_source'] = results[1]

# Thống kê
stats = dtdh['ma_kh_source'].value_counts()
print("\n   Kết quả theo tầng:")
for src, cnt in stats.items():
    pct = cnt / len(dtdh) * 100
    print(f"   {src:<25}: {cnt:>6} dòng ({pct:.1f}%)")

total_found = (dtdh['ma_kh'].notna()).sum()
total_miss  = (dtdh['ma_kh'].isna()).sum()
print(f"\n   ✅ Tổng có mã KH: {total_found} ({total_found/len(dtdh)*100:.1f}%)")
print(f"   ⚠️  Vẫn thiếu:     {total_miss} ({total_miss/len(dtdh)*100:.1f}%)")

# ── 6. Chuyển đổi dữ liệu sang chuẩn ERP ────────────────────────
print("\n5. Chuẩn hoá dữ liệu sang format ERP...")

loai_in_map = {0: 'khong_in', 1: 'flexo', 2: 'ky_thuat_so'}

def extract_paper_code(val):
    if pd.isna(val) or str(val).strip() in ('nan', ''):
        return np.nan
    return str(val).strip().split('.')[0]

df_out = pd.DataFrame()

# Thông tin báo giá
df_out['Mã KH']           = dtdh['ma_kh']
df_out['Nguồn map KH']    = dtdh['ma_kh_source']   # cột debug
df_out['Ngày báo giá']    = pd.to_datetime(dtdh['NgayGH'], errors='coerce').dt.strftime('%d/%m/%Y')
df_out['Mã hàng']         = dtdh['MaAMIS']
df_out['Tên hàng']        = dtdh['TenHang']
df_out['ĐVT']             = dtdh['DVT']
df_out['Số lượng']        = dtdh['SoLuong']
df_out['Giá bán đồng']    = dtdh['GiaBan']
df_out['Đơn giá m2']      = dtdh['DonGiaM2']

# Kết cấu hộp
df_out['Loại thùng']      = dtdh['LoaiThung']
df_out['Số lớp']          = dtdh['Lop']
df_out['Tổ hợp sóng']    = dtdh['THS']
df_out['Dài']             = dtdh['Dai']
df_out['Rộng']            = dtdh['Rong']
df_out['Cao']             = dtdh['Cao']
df_out['Khổ TT']          = dtdh['KhoTT']
df_out['Dài TT']          = dtdh['DaiTT']
df_out['Diện tích']       = dtdh['DienTich']

# Kết cấu giấy (mã ký hiệu + định lượng)
df_out['Mặt']             = dtdh['Mat_Giay'].apply(extract_paper_code)
df_out['Mặt ĐL']          = dtdh['Mat_DL']
df_out['Sóng 1']          = dtdh['SB_Giay'].apply(extract_paper_code)
df_out['Sóng 1 ĐL']       = dtdh['SB_DL']
df_out['Mặt 1']           = dtdh['MB_Giay'].apply(extract_paper_code)
df_out['Mặt 1 ĐL']        = dtdh['MB_DL']
df_out['Sóng 2']          = dtdh['SC_Giay'].apply(extract_paper_code)
df_out['Sóng 2 ĐL']       = dtdh['SC_DL']
df_out['Mặt 2']           = dtdh['MC_Giay'].apply(extract_paper_code)
df_out['Mặt 2 ĐL']        = dtdh['MC_DL']
df_out['Sóng 3']          = dtdh['SE_Giay'].apply(extract_paper_code)
df_out['Sóng 3 ĐL']       = dtdh['SE_DL']
df_out['Mặt 3']           = dtdh['ME_Giay'].apply(extract_paper_code)
df_out['Mặt 3 ĐL']        = dtdh['ME_DL']

# Gia công / in ấn
df_out['Loại in']         = dtdh['LoaiIn'].map(loai_in_map).fillna('khong_in')
df_out['Số màu']          = dtdh['SoMau'].fillna(0).astype(int)
df_out['Ghim']            = dtdh['Ghim'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Dán']             = dtdh['Dan'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Chắp xà']         = dtdh['CHAPXA'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Độ phủ']          = dtdh['DoPhu'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Độ khô']          = dtdh['DoKho'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Bồi']             = dtdh['isBoi'].map({True: 1, False: 0, 1: 1, 0: 0}).fillna(0).astype(int)
df_out['Bế lỗ']           = dtdh['isBeLo'].fillna(0).astype(int)
df_out['Chống thấm']      = dtdh['isChongTham']
df_out['Cán màng']        = dtdh['isCanMan']

# Chi phí & ngày tháng
df_out['Tiền vận chuyển'] = dtdh['TienVC']
df_out['Tiền bản in']     = dtdh['TienBangIn']
df_out['Tiền khuôn']      = dtdh['TienKhuon']
df_out['Ngày giao hàng']  = pd.to_datetime(dtdh['NgayGH'], errors='coerce').dt.strftime('%d/%m/%Y')
df_out['Ghi chú']         = dtdh['GhiChu']
df_out['Tình trạng cũ']   = dtdh['TinhTrang']

# ── 7. Thống kê chi tiết theo mã KH ──────────────────────────────
print("\n6. Tạo bảng thống kê theo KH...")
df_stats = (
    df_out.groupby('Mã KH')
    .agg(
        so_dong=('Tên hàng', 'count'),
        san_pham_unique=('Tên hàng', 'nunique'),
        ngay_dau=('Ngày báo giá', 'min'),
        ngay_cuoi=('Ngày báo giá', 'max'),
    )
    .reset_index()
    .sort_values('so_dong', ascending=False)
)
# Gắn thêm tên KH từ DB
ma_kh_to_ten = dict(zip(df_kh_db['ma_kh'], df_kh_db['ten_viet_tat']))
df_stats['Tên khách hàng'] = df_stats['Mã KH'].map(ma_kh_to_ten)
print(f"   → {len(df_stats)} khách hàng có dữ liệu")
print("   Top 15 KH:")
print(df_stats.head(15)[['Mã KH','Tên khách hàng','so_dong','san_pham_unique']].to_string())

# ── 8. Ghi file ──────────────────────────────────────────────────
print(f"\n7. Ghi file: {output_path}")

df_ready   = df_out[df_out['Mã KH'].notna()].copy()
df_missing = df_out[df_out['Mã KH'].isna()].copy()

with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    df_ready.drop(columns=['Nguồn map KH']).to_excel(
        writer, sheet_name='Sẵn sàng import', index=False)
    df_missing.drop(columns=['Nguồn map KH']).to_excel(
        writer, sheet_name='Thiếu mã KH', index=False)
    df_out.to_excel(writer, sheet_name='Tất cả (có debug)', index=False)
    df_stats.rename(columns={
        'so_dong': 'Số dòng', 'san_pham_unique': 'SP Unique',
        'ngay_dau': 'Ngày đầu', 'ngay_cuoi': 'Ngày cuối'
    }).to_excel(writer, sheet_name='Thống kê KH', index=False)

print(f"\n{'='*60}")
print(f"✅ HOÀN THÀNH!")
print(f"  📄 Sẵn sàng import : {len(df_ready):>6} dòng ({len(df_ready)/len(df_out)*100:.1f}%)")
print(f"  ⚠️  Thiếu mã KH     : {len(df_missing):>6} dòng ({len(df_missing)/len(df_out)*100:.1f}%)")
print(f"  📊 Khách hàng       : {len(df_stats):>6} KH duy nhất")
print(f"\n  File: {output_path}")
print(f"{'='*60}")
