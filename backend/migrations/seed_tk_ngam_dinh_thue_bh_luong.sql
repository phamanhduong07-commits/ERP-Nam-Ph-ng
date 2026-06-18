INSERT INTO tai_khoan_ngam_dinh (ma_loai, ten_loai, nhom, so_tk, updated_at)
VALUES
  ('thue_gtgt_phai_nop',      'Thue GTGT phai nop',          'thue',    '3331', NOW()),
  ('bao_hiem_xa_hoi',         'Bao hiem xa hoi phai nop',    'thue',    '3383', NOW()),
  ('phai_tra_nguoi_lao_dong', 'Phai tra nguoi lao dong',     'chi_phi', '334',  NOW())
ON CONFLICT (ma_loai) DO NOTHING;
