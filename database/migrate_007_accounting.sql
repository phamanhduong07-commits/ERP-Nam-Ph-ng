-- =============================================================
-- MIGRATE 007: Module Kế Toán Công Nợ (thay thế AMIS)
-- Thay invoices + payments đơn giản hóa bằng cấu trúc đầy đủ
-- Áp dụng: psql -U postgres -d erp_nam_phuong -f migrate_007_accounting.sql
-- =============================================================

-- 1. XÓA bảng đơn giản hóa cũ (chưa có data thật, chưa implement Python)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;


-- =============================================================
-- 2. SEED HỆ THỐNG TÀI KHOẢN VAS (chart_of_accounts)
-- =============================================================

INSERT INTO chart_of_accounts (so_tk, ten_tk, loai_tk, cap, so_tk_cha) VALUES
-- Tài sản ngắn hạn
('111',  'Tiền mặt',                          'TSNO',     1, NULL),
('1111', 'Tiền Việt Nam',                      'TSNO',     2, '111'),
('112',  'Tiền gửi ngân hàng',                'TSNO',     1, NULL),
('1121', 'Tiền gửi VND',                       'TSNO',     2, '112'),
('131',  'Phải thu của khách hàng',           'TSNO',     1, NULL),
('133',  'Thuế GTGT được khấu trừ',           'TSNO',     1, NULL),
('1331', 'Thuế GTGT được khấu trừ của HHDV', 'TSNO',     2, '133'),
('136',  'Phải thu nội bộ',                   'TSNO',     1, NULL),
('138',  'Phải thu khác',                      'TSNO',     1, NULL),
('152',  'Nguyên liệu, vật liệu',             'TSNO',     1, NULL),
('153',  'Công cụ, dụng cụ',                  'TSNO',     1, NULL),
('155',  'Thành phẩm',                         'TSNO',     1, NULL),
('156',  'Hàng hóa',                           'TSNO',     1, NULL),
('331',  'Phải trả cho người bán',            'TSCÓ',    1, NULL),
('333',  'Thuế và các khoản phải nộp NN',    'TSCÓ',    1, NULL),
('3331', 'Thuế GTGT phải nộp',               'TSCÓ',    2, '333'),
('3332', 'Thuế TTĐB',                          'TSCÓ',    2, '333'),
('334',  'Phải trả người lao động',           'TSCÓ',    1, NULL),
('338',  'Phải trả, phải nộp khác',          'TSCÓ',    1, NULL),
-- Vốn chủ sở hữu
('411',  'Vốn đầu tư của chủ sở hữu',        'VONSH',    1, NULL),
('421',  'Lợi nhuận sau thuế chưa phân phối','VONSH',    1, NULL),
-- Doanh thu
('511',  'Doanh thu bán hàng và cung cấp DV','DOANHTHU', 1, NULL),
('515',  'Doanh thu hoạt động tài chính',     'DOANHTHU', 1, NULL),
-- Chi phí
('621',  'Chi phí nguyên liệu, vật liệu TT', 'CHIPHI',   1, NULL),
('622',  'Chi phí nhân công trực tiếp',       'CHIPHI',   1, NULL),
('627',  'Chi phí sản xuất chung',            'CHIPHI',   1, NULL),
('632',  'Giá vốn hàng bán',                  'CHIPHI',   1, NULL),
('635',  'Chi phí tài chính',                 'CHIPHI',   1, NULL),
('641',  'Chi phí bán hàng',                  'CHIPHI',   1, NULL),
('642',  'Chi phí quản lý doanh nghiệp',      'CHIPHI',   1, NULL),
('811',  'Chi phí khác',                       'CHIPHI',   1, NULL),
('911',  'Xác định kết quả kinh doanh',       'CHIPHI',   1, NULL)
ON CONFLICT (so_tk) DO NOTHING;


-- =============================================================
-- 3. HÓA ĐƠN BÁN HÀNG (GTGT) — thay AMIS, đủ fields chuẩn VAS
-- =============================================================

CREATE TABLE sales_invoices (
    id              SERIAL PRIMARY KEY,
    so_hoa_don      VARCHAR(50) UNIQUE,         -- số thứ tự HĐ, tự động: HDYYYYMM-XXXX
    mau_so          VARCHAR(50),                -- mẫu số HĐ (01GTKT0/001, 01GTKT0/002...)
    ky_hieu         VARCHAR(50),                -- ký hiệu HĐ (AA/24E, AB/24E...)
    ngay_hoa_don    DATE NOT NULL DEFAULT CURRENT_DATE,
    han_tt          DATE,                       -- hạn thanh toán
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    delivery_id     INTEGER REFERENCES delivery_orders(id),
    sales_order_id  INTEGER REFERENCES sales_orders(id),
    -- Snapshot thông tin KH tại thời điểm phát hành (không đổi dù KH thay đổi)
    ten_don_vi      VARCHAR(500),               -- tên đơn vị mua
    dia_chi         TEXT,
    ma_so_thue      VARCHAR(50),
    nguoi_mua_hang  VARCHAR(200),
    hinh_thuc_tt    VARCHAR(20) DEFAULT 'CK'
                    CHECK (hinh_thuc_tt IN ('TM','CK','TM+CK')),
    -- Tài chính
    tong_tien_hang  NUMERIC(18,2) NOT NULL DEFAULT 0,
    ty_le_vat       NUMERIC(5,2) DEFAULT 10,   -- % VAT: 0, 5, 8, 10
    tien_vat        NUMERIC(18,2) NOT NULL DEFAULT 0,
    tong_cong       NUMERIC(18,2) NOT NULL DEFAULT 0,  -- = tong_tien_hang + tien_vat
    da_thanh_toan   NUMERIC(18,2) NOT NULL DEFAULT 0,
    con_lai         NUMERIC(18,2) GENERATED ALWAYS AS (tong_cong - da_thanh_toan) STORED,
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'nhap'
                    CHECK (trang_thai IN ('nhap','da_phat_hanh','da_tt_mot_phan','da_tt_du','qua_han','huy')),
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_invoices_customer   ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_trang_thai ON sales_invoices(trang_thai);
CREATE INDEX idx_sales_invoices_han_tt     ON sales_invoices(han_tt);
CREATE INDEX idx_sales_invoices_ngay       ON sales_invoices(ngay_hoa_don DESC);
CREATE INDEX idx_sales_invoices_so_don     ON sales_invoices(sales_order_id);
CREATE INDEX idx_sales_invoices_delivery   ON sales_invoices(delivery_id);


-- =============================================================
-- 4. HÓA ĐƠN MUA HÀNG (từ NCC)
-- =============================================================

CREATE TABLE purchase_invoices (
    id              SERIAL PRIMARY KEY,
    so_hoa_don      VARCHAR(50),                -- số HĐ của NCC (nhập tay)
    mau_so          VARCHAR(50),
    ky_hieu         VARCHAR(50),
    ngay_lap        DATE NOT NULL DEFAULT CURRENT_DATE,  -- ngày nhận/ghi vào hệ thống
    ngay_hoa_don    DATE,                       -- ngày ghi trên HĐ (có thể khác ngày nhận)
    han_tt          DATE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    po_id           INTEGER REFERENCES purchase_orders(id),
    gr_id           INTEGER REFERENCES goods_receipts(id),
    -- Snapshot NCC
    ten_don_vi      VARCHAR(500),
    ma_so_thue      VARCHAR(50),
    -- Tài chính
    thue_suat       NUMERIC(5,2) DEFAULT 10,
    tong_tien_hang  NUMERIC(18,2) NOT NULL DEFAULT 0,
    tien_thue       NUMERIC(18,2) NOT NULL DEFAULT 0,
    tong_thanh_toan NUMERIC(18,2) NOT NULL DEFAULT 0,
    da_thanh_toan   NUMERIC(18,2) NOT NULL DEFAULT 0,
    con_lai         NUMERIC(18,2) GENERATED ALWAYS AS (tong_thanh_toan - da_thanh_toan) STORED,
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'nhap'
                    CHECK (trang_thai IN ('nhap','da_tt_mot_phan','da_tt_du','qua_han','huy')),
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_invoices_supplier   ON purchase_invoices(supplier_id);
CREATE INDEX idx_purchase_invoices_trang_thai ON purchase_invoices(trang_thai);
CREATE INDEX idx_purchase_invoices_han_tt     ON purchase_invoices(han_tt);
CREATE INDEX idx_purchase_invoices_ngay       ON purchase_invoices(ngay_lap DESC);
CREATE INDEX idx_purchase_invoices_po         ON purchase_invoices(po_id);
CREATE INDEX idx_purchase_invoices_gr         ON purchase_invoices(gr_id);


-- =============================================================
-- 5. PHIẾU THU (thu tiền từ khách hàng)
-- =============================================================

CREATE TABLE cash_receipts (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(30) NOT NULL UNIQUE,  -- PT-YYYYMM-XXXX
    ngay_phieu      DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    sales_invoice_id INTEGER REFERENCES sales_invoices(id),  -- HĐ liên quan (nếu có)
    hinh_thuc_tt    VARCHAR(20) NOT NULL DEFAULT 'CK'
                    CHECK (hinh_thuc_tt IN ('TM','CK','TM+CK')),
    so_tai_khoan    VARCHAR(100),               -- số TK ngân hàng nhận
    so_tham_chieu   VARCHAR(100),               -- số chứng từ CK / số séc
    dien_giai       TEXT,                       -- nội dung thu (hiển thị trong bút toán)
    so_tien         NUMERIC(18,2) NOT NULL CHECK (so_tien > 0),
    -- Tài khoản kế toán VAS (mặc định, KE_TOAN có thể ghi đè)
    tk_no           VARCHAR(20) NOT NULL DEFAULT '112'
                    REFERENCES chart_of_accounts(so_tk),    -- Nợ: 111 (TM) hoặc 112 (CK)
    tk_co           VARCHAR(20) NOT NULL DEFAULT '131'
                    REFERENCES chart_of_accounts(so_tk),    -- Có: 131 (Phải thu KH)
    trang_thai      VARCHAR(20) NOT NULL DEFAULT 'cho_duyet'
                    CHECK (trang_thai IN ('cho_duyet','da_duyet','huy')),
    nguoi_duyet_id  INTEGER REFERENCES users(id),
    ngay_duyet      TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_receipts_customer ON cash_receipts(customer_id);
CREATE INDEX idx_cash_receipts_invoice  ON cash_receipts(sales_invoice_id);
CREATE INDEX idx_cash_receipts_ngay     ON cash_receipts(ngay_phieu DESC);
CREATE INDEX idx_cash_receipts_tt       ON cash_receipts(trang_thai);


-- =============================================================
-- 6. PHIẾU CHI (thanh toán cho nhà cung cấp)
-- =============================================================

CREATE TABLE cash_payments (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(30) NOT NULL UNIQUE,  -- PC-YYYYMM-XXXX
    ngay_phieu      DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
    hinh_thuc_tt    VARCHAR(20) NOT NULL DEFAULT 'CK'
                    CHECK (hinh_thuc_tt IN ('TM','CK','TM+CK')),
    so_tai_khoan    VARCHAR(100),               -- số TK ngân hàng chuyển từ
    so_tham_chieu   VARCHAR(100),
    dien_giai       TEXT,
    so_tien         NUMERIC(18,2) NOT NULL CHECK (so_tien > 0),
    -- Tài khoản kế toán VAS
    tk_no           VARCHAR(20) NOT NULL DEFAULT '331'
                    REFERENCES chart_of_accounts(so_tk),    -- Nợ: 331 (Phải trả NCC)
    tk_co           VARCHAR(20) NOT NULL DEFAULT '112'
                    REFERENCES chart_of_accounts(so_tk),    -- Có: 111/112
    trang_thai      VARCHAR(20) NOT NULL DEFAULT 'cho_chot'
                    CHECK (trang_thai IN ('cho_chot','da_chot','da_duyet','huy')),
    nguoi_duyet_id  INTEGER REFERENCES users(id),
    ngay_duyet      TIMESTAMPTZ,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_payments_supplier ON cash_payments(supplier_id);
CREATE INDEX idx_cash_payments_invoice  ON cash_payments(purchase_invoice_id);
CREATE INDEX idx_cash_payments_ngay     ON cash_payments(ngay_phieu DESC);
CREATE INDEX idx_cash_payments_tt       ON cash_payments(trang_thai);


-- =============================================================
-- 7. SỔ CÔNG NỢ — BÚT TOÁN PHÁT SINH (tương tự General Ledger đơn giản)
-- Ghi nhận mỗi phát sinh tăng/giảm công nợ để tính số dư đầu/cuối kỳ
-- =============================================================

CREATE TABLE debt_ledger_entries (
    id                SERIAL PRIMARY KEY,
    ngay              DATE NOT NULL,
    loai              VARCHAR(10) NOT NULL CHECK (loai IN ('tang_no','giam_no')),
    -- tang_no: phát sinh nợ thêm (HĐ bán/mua)
    -- giam_no: giảm nợ (phiếu thu/chi)
    doi_tuong         VARCHAR(20) NOT NULL CHECK (doi_tuong IN ('khach_hang','nha_cung_cap')),
    customer_id       INTEGER REFERENCES customers(id),
    supplier_id       INTEGER REFERENCES suppliers(id),
    chung_tu_loai     VARCHAR(50),  -- 'hoa_don_ban' | 'phieu_thu' | 'hoa_don_mua' | 'phieu_chi'
    chung_tu_id       INTEGER,      -- ID của chứng từ tương ứng
    so_tien           NUMERIC(18,2) NOT NULL CHECK (so_tien > 0),
    ghi_chu           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        (doi_tuong = 'khach_hang'    AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (doi_tuong = 'nha_cung_cap'  AND supplier_id IS NOT NULL AND customer_id IS NULL)
    )
);

CREATE INDEX idx_debt_ledger_customer ON debt_ledger_entries(customer_id, ngay);
CREATE INDEX idx_debt_ledger_supplier ON debt_ledger_entries(supplier_id, ngay);
CREATE INDEX idx_debt_ledger_ngay     ON debt_ledger_entries(ngay DESC);
CREATE INDEX idx_debt_ledger_chung_tu ON debt_ledger_entries(chung_tu_loai, chung_tu_id);


-- =============================================================
-- 8. SỐ DƯ ĐẦU KỲ (để nhập từ AMIS khi chuyển đổi hệ thống)
-- =============================================================

CREATE TABLE opening_balances (
    id              SERIAL PRIMARY KEY,
    ky_mo_so        DATE NOT NULL,              -- ngày bắt đầu theo dõi trên ERP
    doi_tuong       VARCHAR(20) NOT NULL CHECK (doi_tuong IN ('khach_hang','nha_cung_cap')),
    customer_id     INTEGER REFERENCES customers(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    so_du_dau_ky    NUMERIC(18,2) NOT NULL DEFAULT 0,  -- số dư còn nợ tại thời điểm chuyển
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (ky_mo_so, doi_tuong, customer_id),
    UNIQUE (ky_mo_so, doi_tuong, supplier_id),
    CHECK (
        (doi_tuong = 'khach_hang'    AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (doi_tuong = 'nha_cung_cap'  AND supplier_id IS NOT NULL AND customer_id IS NULL)
    )
);
