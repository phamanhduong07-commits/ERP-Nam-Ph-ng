-- ============================================================
-- MIGRATION 002 — Bổ sung cột còn thiếu cho quote_items
-- Database: MySQL 8.x
-- ADD COLUMN IF NOT EXISTS an toàn, không lỗi nếu cột đã có
-- ============================================================

-- Nhận dạng sản phẩm
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS product_id     INT NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS loai           VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS ma_amis        VARCHAR(50) NULL;

-- Kích thước / loại thùng
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS loai_thung     VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS kho_tt         DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS dai_tt         DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS dien_tich      DECIMAL(12,4) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS khong_ct       TINYINT(1) NOT NULL DEFAULT 0;

-- Tổ hợp sóng + lớp giấy
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS to_hop_song    VARCHAR(20) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat            VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_dl         DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_1         VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_1_dl      DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_1          VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_1_dl       DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_2         VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_2_dl      DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_2          VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_2_dl       DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_3         VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS song_3_dl      DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_3          VARCHAR(30) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS mat_3_dl       DECIMAL(8,2) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS lay_gia_moi_nl TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS don_gia_m2     DECIMAL(18,6) NULL;

-- In ấn — các flag boolean
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS do_kho         TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS chap_xa        TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS do_phu         TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS boi            TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS be_lo          TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS c_tham         VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS can_man        VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS so_c_be        VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS may_in         VARCHAR(100) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS loai_lan       VARCHAR(50) NULL;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS ban_ve_kt      VARCHAR(500) NULL;
