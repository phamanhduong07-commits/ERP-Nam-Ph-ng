-- migrate_003.sql
-- Liên kết dòng đơn hàng về dòng báo giá gốc
-- Cho phép truy vết quy cách sản phẩm xuyên suốt từ báo giá → đơn → lệnh SX → BOM

-- 1. Thêm cột quote_item_id vào sales_order_items
ALTER TABLE sales_order_items
    ADD COLUMN IF NOT EXISTS quote_item_id INTEGER REFERENCES quote_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_soi_quote_item_id ON sales_order_items(quote_item_id);

-- 2. Backfill: khớp dòng đơn hàng với dòng báo giá gốc
--    Điều kiện: cùng product_id, và đơn hàng được tạo từ báo giá (ghi_chu chứa số BG)
--    Chỉ fill những row chưa có quote_item_id và có product_id khớp
UPDATE sales_order_items soi
JOIN sales_orders so ON soi.order_id = so.id
JOIN quotes q ON so.ghi_chu LIKE CONCAT('Lập từ báo giá ', q.so_bao_gia, '%')
JOIN quote_items qi ON qi.quote_id = q.id
    AND qi.product_id = soi.product_id
    AND qi.product_id IS NOT NULL
SET soi.quote_item_id = qi.id
WHERE soi.quote_item_id IS NULL
  AND soi.product_id IS NOT NULL;
