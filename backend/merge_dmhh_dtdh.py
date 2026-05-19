"""
Script link DMHH.xlsx + DTDONHANG.xlsx → tạo file chuẩn cho import vào ERP

Logic liên kết:
- DMHH.MaHH        = "{MaKH}_{QuyCach}"    → trích ma_kh = phần trước "_" đầu tiên
- DTDONHANG.MaAMIS = "{MaKH}-{SoThuTu}"    → trích ma_kh = phần trước "-" đầu tiên
- Khi cả hai cùng có tiền tố = ma_kh thì link được khách hàng

Đầu ra: file Excel chuẩn ERP với các cột:
  - Ngày báo giá, Mã KH, Tên hàng, ĐVT, Số lượng
  - Số lớp, Tổ hợp sóng, Dài, Rộng, Cao, Khổ TT, Dài TT, Diện tích
  - Mặt / Sóng 1 / Mặt 1 / Sóng 2 / Mặt 2 / Sóng 3 / Mặt 3 + ĐL tương ứng
  - Loại in, Số màu, Ghim, Dán, Chắp xà, Độ phủ, Độ khô, Bồi, Bế lỗ
  - Giá bán đồng, Đơn giá m2, Ghi chú, Ngày giao hàng, Mã AMIS
"""

import pandas as pd
import numpy as np
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

dmhh_path    = r"C:\Users\TUF\Desktop\New folder\DMHH.xlsx"
dtdh_path    = r"C:\Users\TUF\Downloads\DTDONHANG.xlsx"
output_path  = r"C:\Users\TUF\Desktop\New folder\import_bao_gia_ERP.xlsx"

# ── 1. Đọc 2 file ──────────────────────────────────────────────
print("Đọc DMHH.xlsx ...")
dmhh = pd.read_excel(dmhh_path, sheet_name='Sheet2')
dmhh['ma_kh'] = dmhh['MaHH'].astype(str).str.split('_').str[0].str.strip()
print(f"  DMHH: {len(dmhh)} dòng, {dmhh['ma_kh'].nunique()} mã KH duy nhất")

print("Đọc DTDONHANG.xlsx ...")
dtdh = pd.read_excel(dtdh_path, sheet_name='Sheet2')
# Trích mã KH từ MaAMIS (VD: HOV-296 → HOV)
dtdh['ma_kh_amis'] = dtdh['MaAMIS'].astype(str).str.split('-').str[0].str.strip()
dtdh['ma_kh_amis'] = dtdh['ma_kh_amis'].replace('nan', np.nan)
print(f"  DTDONHANG: {len(dtdh)} dòng, {dtdh['ma_kh_amis'].nunique()} mã KH từ MaAMIS")

# ── 2. Tạo bảng tra mã KH: MaHH → ma_kh (dùng DMHH) ──────────
# Với DTDONHANG.TenHang → tìm trong DMHH.TenHH để lấy MaHH → ma_kh
dmhh_name_to_mahh = dict(zip(
    dmhh['TenHH'].astype(str).str.strip(),
    dmhh['MaHH'].astype(str)
))
dmhh_mahh_to_makH = dict(zip(
    dmhh['MaHH'].astype(str),
    dmhh['ma_kh']
))

# ── 3. Map mã KH vào DTDONHANG ──────────────────────────────────
def get_ma_kh(row):
    # Ưu tiên 1: lấy từ MaAMIS (HOV-296 → HOV)
    if pd.notna(row.get('ma_kh_amis')) and row['ma_kh_amis'] not in ('nan', ''):
        return row['ma_kh_amis']
    # Ưu tiên 2: tra tên hàng trong DMHH
    ten = str(row.get('TenHang', '')).strip()
    mahh = dmhh_name_to_mahh.get(ten)
    if mahh:
        return dmhh_mahh_to_makH.get(mahh, np.nan)
    return np.nan

print("\nĐang gắn mã KH vào DTDONHANG (có thể mất 30-60 giây)...")
dtdh['ma_kh'] = dtdh.apply(get_ma_kh, axis=1)

has_kh     = dtdh['ma_kh'].notna().sum()
missing_kh = dtdh['ma_kh'].isna().sum()
print(f"  Có mã KH: {has_kh} dòng ({has_kh/len(dtdh)*100:.1f}%)")
print(f"  Thiếu mã KH: {missing_kh} dòng ({missing_kh/len(dtdh)*100:.1f}%)")

# ── 4. Chuyển đổi LoaiIn (0/1/2 → text ERP) ─────────────────────
loai_in_map = {0: 'khong_in', 1: 'flexo', 2: 'ky_thuat_so'}
dtdh['LoaiIn_ERP'] = dtdh['LoaiIn'].map(loai_in_map).fillna('khong_in')

# ── 5. Trích mã ký hiệu giấy (bỏ phần sau dấu chấm thứ 2) ───────
def extract_paper_code(val):
    """LM.TW.TWLM.170.130 → LM   (chỉ giữ phần đầu = ma_ky_hieu)"""
    if pd.isna(val) or str(val).strip() == 'nan':
        return np.nan
    parts = str(val).strip().split('.')
    return parts[0] if parts else np.nan

def extract_paper_dl_from_col(df, col_giay, col_dl):
    """Lấy định lượng từ cột _DL sẵn có."""
    return df[col_dl].where(df[col_giay].notna())

# ── 6. Xây dựng bảng đầu ra chuẩn ERP ──────────────────────────
print("\nTạo file output...")

df_out = pd.DataFrame()

# Header báo giá
df_out['Mã KH']          = dtdh['ma_kh']
df_out['Ngày báo giá']   = dtdh['NgayGH'].dt.strftime('%d/%m/%Y')
df_out['Ngày hết hạn']   = ''  # để trống, ERP tự +30 ngày
df_out['Mã hàng']        = dtdh['MaAMIS']
df_out['Tên hàng']       = dtdh['TenHang']
df_out['ĐVT']            = dtdh['DVT']
df_out['Số lượng']       = dtdh['SoLuong']

# Kết cấu hộp
df_out['Loại thùng']     = dtdh['LoaiThung']
df_out['Số lớp']         = dtdh['Lop']
df_out['Tổ hợp sóng']   = dtdh['THS']
df_out['Dài']            = dtdh['Dai']
df_out['Rộng']           = dtdh['Rong']
df_out['Cao']            = dtdh['Cao']
df_out['Khổ TT']         = dtdh['KhoTT']
df_out['Dài TT']         = dtdh['DaiTT']
df_out['Diện tích']      = dtdh['DienTich']

# Kết cấu giấy – chỉ giữ mã ký hiệu + định lượng
df_out['Mặt']            = dtdh['Mat_Giay'].apply(extract_paper_code)
df_out['Mặt ĐL']         = dtdh['Mat_DL']
df_out['Sóng 1']         = dtdh['SB_Giay'].apply(extract_paper_code)
df_out['Sóng 1 ĐL']      = dtdh['SB_DL']
df_out['Mặt 1']          = dtdh['MB_Giay'].apply(extract_paper_code)
df_out['Mặt 1 ĐL']       = dtdh['MB_DL']
df_out['Sóng 2']         = dtdh['SC_Giay'].apply(extract_paper_code)
df_out['Sóng 2 ĐL']      = dtdh['SC_DL']
df_out['Mặt 2']          = dtdh['MC_Giay'].apply(extract_paper_code)
df_out['Mặt 2 ĐL']       = dtdh['MC_DL']
df_out['Sóng 3']         = dtdh['SE_Giay'].apply(extract_paper_code)
df_out['Sóng 3 ĐL']      = dtdh['SE_DL']
df_out['Mặt 3']          = dtdh['ME_Giay'].apply(extract_paper_code)
df_out['Mặt 3 ĐL']       = dtdh['ME_DL']

# In ấn & gia công
df_out['Loại in']        = dtdh['LoaiIn_ERP']
df_out['Số màu']         = dtdh['SoMau'].fillna(0).astype(int)
df_out['Ghim']           = dtdh['Ghim'].map({True: 1, False: 0})
df_out['Dán']            = dtdh['Dan'].map({True: 1, False: 0})
df_out['Chắp xà']        = dtdh['CHAPXA'].map({True: 1, False: 0})
df_out['Độ phủ']         = dtdh['DoPhu'].map({True: 1, False: 0})
df_out['Độ khô']         = dtdh['DoKho'].map({True: 1, False: 0})
df_out['Bồi']            = dtdh['isBoi'].map({True: 1, False: 0})
df_out['Bế lỗ']          = dtdh['isBeLo'].fillna(0).astype(int)
df_out['Chống thấm']     = dtdh['isChongTham']
df_out['Cán màng']       = dtdh['isCanMan']

# Giá
df_out['Giá bán đồng']   = dtdh['GiaBan']
df_out['Đơn giá m2']     = dtdh['DonGiaM2']
df_out['Tiền vận chuyển']= dtdh['TienVC']
df_out['Tiền bản in']    = dtdh['TienBangIn']
df_out['Tiền khuôn']     = dtdh['TienKhuon']

# Thông tin bổ sung
df_out['Ngày giao hàng'] = dtdh['NgayGH'].dt.strftime('%d/%m/%Y')
df_out['Ghi chú']        = dtdh['GhiChu']
df_out['Tình trạng cũ']  = dtdh['TinhTrang']

# ── 7. Thống kê ──────────────────────────────────────────────────
print(f"\nThống kê đầu ra:")
print(f"  Tổng dòng: {len(df_out)}")
print(f"  Có đủ mã KH + Ngày + Tên hàng + Số lượng: "
      f"{(df_out['Mã KH'].notna() & df_out['Tên hàng'].notna() & df_out['Số lượng'].notna()).sum()}")

# Top 10 mã KH có nhiều dòng nhất
print("\nTop 10 mã KH (nhiều đơn nhất):")
print(df_out['Mã KH'].value_counts().head(10))

# ── 8. Ghi file Excel ────────────────────────────────────────────
print(f"\nGhi file: {output_path}")
with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    # Sheet 1: Tất cả dòng (kể cả thiếu mã KH)
    df_out.to_excel(writer, sheet_name='Tất cả dòng', index=False)
    
    # Sheet 2: Chỉ dòng có mã KH (ready to import)
    df_ready = df_out[df_out['Mã KH'].notna()].copy()
    df_ready.to_excel(writer, sheet_name='Sẵn sàng import', index=False)
    
    # Sheet 3: Dòng thiếu mã KH (cần xử lý thủ công)
    df_missing = df_out[df_out['Mã KH'].isna()].copy()
    df_missing.to_excel(writer, sheet_name='Thiếu mã KH', index=False)

print(f"\n✅ HOÀN THÀNH!")
print(f"  📄 Sheet 'Tất cả dòng':       {len(df_out)} dòng")
print(f"  ✅ Sheet 'Sẵn sàng import':   {len(df_ready)} dòng ({len(df_ready)/len(df_out)*100:.1f}%)")
print(f"  ⚠️  Sheet 'Thiếu mã KH':       {len(df_missing)} dòng ({len(df_missing)/len(df_out)*100:.1f}%)")
print(f"\nFile đã lưu tại: {output_path}")
