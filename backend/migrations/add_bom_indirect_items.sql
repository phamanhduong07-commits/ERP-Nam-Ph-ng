-- Migration: thêm bảng chi tiết chi phí gián tiếp (hoạch toán)
-- Chạy lệnh này trong MySQL trước khi khởi động lại backend

CREATE TABLE IF NOT EXISTS production_bom_indirect_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    bom_id      INT NOT NULL,
    ten         VARCHAR(50) NOT NULL COMMENT 'Bột, Điện, Gas, Kẽm, Lương, Máy, Nhà xưởng, Sut/GT, Vận chuyển...',
    don_gia_m2  DECIMAL(10, 2) NOT NULL COMMENT 'Đơn giá đ/m²',
    dien_tich   DECIMAL(12, 6) NOT NULL COMMENT 'Diện tích m²/thùng',
    thanh_tien  DECIMAL(18, 2) NOT NULL COMMENT 'Thành tiền = don_gia_m2 * dien_tich',
    CONSTRAINT fk_bom_indirect_bom FOREIGN KEY (bom_id)
        REFERENCES production_boms(id) ON DELETE CASCADE,
    INDEX idx_bom_indirect_bom_id (bom_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Chi tiết chi phí gián tiếp theo từng khoản mục — dữ liệu hoạch toán';
