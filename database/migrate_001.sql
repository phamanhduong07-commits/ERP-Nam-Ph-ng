-- ============================================================
-- MIGRATION 001 — Cập nhật sales_order_items + thêm bảng mới
-- Database: MySQL 8.x
-- Chạy lệnh này 1 lần trên database đang có
-- ============================================================

-- 1. Cho phép product_id = NULL (mặt hàng custom từ báo giá)
--    MySQL: dùng MODIFY COLUMN thay vì ALTER COLUMN ... DROP NOT NULL
ALTER TABLE sales_order_items
    MODIFY COLUMN product_id INT NULL;

-- 2. Thêm cột ten_hang (tên hàng copy từ báo giá hoặc sản phẩm)
--    IF NOT EXISTS hỗ trợ từ MySQL 8.0.3+
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS ten_hang VARCHAR(255) NOT NULL DEFAULT '';

-- 3. Backfill ten_hang từ products cho các row đã có product_id
--    MySQL dùng JOIN trong UPDATE (khác PostgreSQL)
UPDATE sales_order_items soi
JOIN products p ON soi.product_id = p.id
SET soi.ten_hang = p.ten_hang
WHERE soi.ten_hang = '';
