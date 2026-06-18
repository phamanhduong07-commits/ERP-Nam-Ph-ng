-- Migration: thêm ma_loai_tk_no vào khoan_muc_chi_phi
-- ma_loai_tk_no tham chiếu TaiKhoanNgamDinh.ma_loai (không FK cứng, tra cứu lúc runtime)
-- Chạy lệnh này trên PostgreSQL trước khi restart backend

ALTER TABLE khoan_muc_chi_phi
    ADD COLUMN IF NOT EXISTS ma_loai_tk_no VARCHAR(60);
