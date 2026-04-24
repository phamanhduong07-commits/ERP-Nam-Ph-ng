-- migrate_004.sql
-- Thêm thông số kỹ thuật sản phẩm vào dòng đơn hàng
-- Đơn hàng kế thừa đầy đủ dữ liệu từ báo giá (kích thước, kết cấu giấy, loại in)

-- 0. Đảm bảo quote_item_id đã tồn tại (idempotent từ migrate_003)
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS quote_item_id INTEGER REFERENCES quote_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_soi_quote_item_id ON sales_order_items(quote_item_id);

-- 1. Thêm cột thông số kỹ thuật
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS loai_thung  VARCHAR(50)    NULL,
    ADD COLUMN IF NOT EXISTS dai         DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS rong        DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS cao         DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS so_lop      SMALLINT       NULL,
    ADD COLUMN IF NOT EXISTS to_hop_song VARCHAR(20)    NULL,
    ADD COLUMN IF NOT EXISTS mat         VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS mat_dl      DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS song_1      VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS song_1_dl   DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS mat_1       VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS mat_1_dl    DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS song_2      VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS song_2_dl   DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS mat_2       VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS mat_2_dl    DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS song_3      VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS song_3_dl   DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS mat_3       VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS mat_3_dl    DECIMAL(8,2)   NULL,
    ADD COLUMN IF NOT EXISTS loai_in     VARCHAR(30)    NULL,
    ADD COLUMN IF NOT EXISTS so_mau      SMALLINT       NULL;

-- 2. Backfill: lấy dữ liệu từ quote_items cho các dòng đã có quote_item_id
UPDATE sales_order_items soi
JOIN quote_items qi ON soi.quote_item_id = qi.id
SET soi.loai_thung  = qi.loai_thung,
    soi.dai         = qi.dai,
    soi.rong        = qi.rong,
    soi.cao         = qi.cao,
    soi.so_lop      = qi.so_lop,
    soi.to_hop_song = qi.to_hop_song,
    soi.mat         = qi.mat,
    soi.mat_dl      = qi.mat_dl,
    soi.song_1      = qi.song_1,
    soi.song_1_dl   = qi.song_1_dl,
    soi.mat_1       = qi.mat_1,
    soi.mat_1_dl    = qi.mat_1_dl,
    soi.song_2      = qi.song_2,
    soi.song_2_dl   = qi.song_2_dl,
    soi.mat_2       = qi.mat_2,
    soi.mat_2_dl    = qi.mat_2_dl,
    soi.song_3      = qi.song_3,
    soi.song_3_dl   = qi.song_3_dl,
    soi.mat_3       = qi.mat_3,
    soi.mat_3_dl    = qi.mat_3_dl,
    soi.loai_in     = qi.loai_in,
    soi.so_mau      = qi.so_mau
WHERE soi.quote_item_id IS NOT NULL;
