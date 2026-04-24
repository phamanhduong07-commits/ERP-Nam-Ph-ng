-- ============================================================
-- MIGRATION 005 — Thêm thông số kỹ thuật vào production_order_items
-- Database: MySQL 8.x
-- Lệnh SX kế thừa đầy đủ kết cấu giấy từ đơn hàng / báo giá
-- NOTE: ensure_schema() trong database.py tự động chạy khi khởi động
-- ============================================================

ALTER TABLE production_order_items
    ADD COLUMN IF NOT EXISTS loai_thung       VARCHAR(50)   NULL,
    ADD COLUMN IF NOT EXISTS dai              DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS rong             DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS cao              DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS so_lop           SMALLINT      NULL,
    ADD COLUMN IF NOT EXISTS to_hop_song      VARCHAR(20)   NULL,
    ADD COLUMN IF NOT EXISTS mat              VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS mat_dl           DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS song_1           VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS song_1_dl        DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS mat_1            VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS mat_1_dl         DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS song_2           VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS song_2_dl        DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS mat_2            VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS mat_2_dl         DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS song_3           VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS song_3_dl        DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS mat_3            VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS mat_3_dl         DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS loai_in          VARCHAR(30)   NULL,
    ADD COLUMN IF NOT EXISTS so_mau           SMALLINT      NULL,
    ADD COLUMN IF NOT EXISTS kho_tt           DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS dai_tt           DECIMAL(8,2)  NULL,
    ADD COLUMN IF NOT EXISTS dien_tich        DECIMAL(12,4) NULL,
    ADD COLUMN IF NOT EXISTS gia_ban_muc_tieu DECIMAL(18,2) NULL;
