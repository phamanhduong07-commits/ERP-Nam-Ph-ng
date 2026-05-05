-- =======================================================
--  ERP NAM PHƯƠNG - POSTGRESQL DATABASE SCHEMA
--  Công ty TNHH SX TM Nam Phương
--  Sản xuất thùng carton từ giấy cuộn
-- =======================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =======================================================
-- SCHEMA 1: PHÂN QUYỀN & NGƯỜI DÙNG
-- =======================================================

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    ma_vai_tro  VARCHAR(50)  NOT NULL UNIQUE,
    ten_vai_tro VARCHAR(100) NOT NULL,
    mo_ta       TEXT,
    trang_thai  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(100) NOT NULL UNIQUE,
    ho_ten       VARCHAR(150) NOT NULL,
    email        VARCHAR(150) UNIQUE,
    so_dien_thoai VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role_id      INTEGER      NOT NULL REFERENCES roles(id),
    phan_xuong   VARCHAR(50),          -- BB (Bế bế), In, CK (cơ khí), v.v.
    trang_thai   BOOLEAN      NOT NULL DEFAULT TRUE,
    lan_dang_nhap_cuoi TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INTEGER      REFERENCES users(id),
    hanh_dong   VARCHAR(20)  NOT NULL,  -- INSERT, UPDATE, DELETE
    bang        VARCHAR(100) NOT NULL,
    ban_ghi_id  VARCHAR(50),
    du_lieu_cu  JSONB,
    du_lieu_moi JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 2: DANH MỤC (MASTER DATA)
-- =======================================================

-- Kho
CREATE TABLE warehouses (
    id          SERIAL PRIMARY KEY,
    ma_kho      VARCHAR(20)  NOT NULL UNIQUE,
    ten_kho     VARCHAR(150) NOT NULL,
    dia_chi     TEXT,
    loai_kho    VARCHAR(30)  NOT NULL CHECK (loai_kho IN ('NVL','TP','BTP','VAT_TU')),
    -- NVL=Nguyên vật liệu, TP=Thành phẩm, BTP=Bán thành phẩm
    trang_thai  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Nhóm nguyên liệu
CREATE TABLE material_groups (
    id          SERIAL PRIMARY KEY,
    ma_nhom     VARCHAR(50)  NOT NULL UNIQUE,
    ten_nhom    VARCHAR(150) NOT NULL,
    la_nhom_giay BOOLEAN     NOT NULL DEFAULT FALSE,
    bo_phan     VARCHAR(50),           -- In, BB, CK
    phan_xuong  VARCHAR(50),
    trang_thai  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Nhà cung cấp
CREATE TABLE suppliers (
    id              SERIAL PRIMARY KEY,
    ma_ncc          VARCHAR(20)  NOT NULL UNIQUE,
    ten_viet_tat    VARCHAR(100) NOT NULL,
    ten_don_vi      VARCHAR(255),
    dia_chi         TEXT,
    dien_thoai      VARCHAR(50),
    fax             VARCHAR(50),
    di_dong         VARCHAR(50),
    ma_so_thue      VARCHAR(30),
    nguoi_dai_dien  VARCHAR(150),
    phan_loai       VARCHAR(50),       -- Giấy cuộn, Vật tư, v.v.
    ma_ncc_amis     VARCHAR(50),
    ghi_chu         TEXT,
    trang_thai      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Khách hàng
CREATE TABLE customers (
    id                  SERIAL PRIMARY KEY,
    ma_kh               VARCHAR(20)  NOT NULL UNIQUE,
    ten_viet_tat        VARCHAR(100) NOT NULL,
    ten_don_vi          VARCHAR(255),
    dia_chi             TEXT,
    dia_chi_giao_hang   TEXT,
    dien_thoai          VARCHAR(50),
    fax                 VARCHAR(50),
    ma_so_thue          VARCHAR(30),
    nguoi_dai_dien      VARCHAR(150),
    nguoi_lien_he       VARCHAR(150),
    so_dien_thoai_lh    VARCHAR(50),
    nv_phu_trach_id     INTEGER REFERENCES users(id),
    no_tran             NUMERIC(18,2) DEFAULT 0,  -- Hạn mức công nợ
    so_ngay_no          INTEGER DEFAULT 0,
    xep_loai            VARCHAR(20),              -- A, B, C
    la_khach_vip        BOOLEAN NOT NULL DEFAULT FALSE,
    hoa_don_ngay        INTEGER DEFAULT 0,         -- Số ngày xuất HĐ sau giao hàng
    tpid                VARCHAR(20),
    qhid                VARCHAR(20),
    pxid                VARCHAR(20),
    ghi_chu             TEXT,
    trang_thai          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nguyên liệu giấy (giấy cuộn)
CREATE TABLE paper_materials (
    id                  SERIAL PRIMARY KEY,
    ma_chinh            VARCHAR(50)  NOT NULL UNIQUE,  -- mã chính, vd: AN.N.H-NAN.250.110
    ma_amis             VARCHAR(50),
    ma_nhom_id          INTEGER      NOT NULL REFERENCES material_groups(id),
    ten                 VARCHAR(255) NOT NULL,
    ten_viet_tat        VARCHAR(100),
    dvt                 VARCHAR(20)  NOT NULL DEFAULT 'Kg',
    kho                 NUMERIC(8,2),          -- Khổ giấy (cm), vd: 110, 140, 175
    ma_ky_hieu          VARCHAR(20),           -- Mã ký hiệu sóng, vd: 11 (B-flute), 12 (C-flute)
    dinh_luong          NUMERIC(8,2),          -- Định lượng tiêu chuẩn (gsm)
    ma_nsx_id           INTEGER REFERENCES suppliers(id),
    -- Tiêu chuẩn chất lượng
    tieu_chuan_dinh_luong NUMERIC(5,2),        -- % dung sai định lượng
    do_buc_tieu_chuan   NUMERIC(8,2),          -- kPa
    do_nen_vong_tc      NUMERIC(8,2),          -- N/m
    ty_le_khoi_chuan    NUMERIC(8,4),
    do_cobb_tieu_chuan  NUMERIC(8,2),
    do_day_tieu_chuan   NUMERIC(8,4),          -- mm
    -- Giá
    gia_mua             NUMERIC(18,2) DEFAULT 0,
    gia_ban             NUMERIC(18,2) DEFAULT 0,
    -- Tồn kho
    ton_toi_thieu       NUMERIC(12,3) DEFAULT 0,
    ton_toi_da          NUMERIC(12,3),
    la_cuon             BOOLEAN NOT NULL DEFAULT TRUE,
    su_dung             BOOLEAN NOT NULL DEFAULT TRUE,
    khong_tinh_nxt      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nguyên vật liệu khác (keo, dây đai, mực in, v.v.)
CREATE TABLE other_materials (
    id              SERIAL PRIMARY KEY,
    ma_chinh        VARCHAR(50)  NOT NULL UNIQUE,
    ma_amis         VARCHAR(50),
    ten             VARCHAR(255) NOT NULL,
    dvt             VARCHAR(20)  NOT NULL DEFAULT 'Kg',
    ma_nhom_id      INTEGER      NOT NULL REFERENCES material_groups(id),
    gia_mua         NUMERIC(18,2) DEFAULT 0,
    ton_toi_thieu   NUMERIC(12,3) DEFAULT 0,
    ton_toi_da      NUMERIC(12,3),
    phan_xuong      VARCHAR(50),
    ma_ncc_id       INTEGER REFERENCES suppliers(id),
    khong_tinh_nxt  BOOLEAN NOT NULL DEFAULT FALSE,
    ghi_chu         TEXT,
    trang_thai      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hàng hoá thành phẩm (thùng carton)
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    ma_amis         VARCHAR(50)  NOT NULL UNIQUE,  -- Mã AMIS
    ma_hang         VARCHAR(50),                    -- Mã theo hệ thống cũ, vd: A&M_32*19*41_3L
    ten_hang        VARCHAR(255) NOT NULL,
    -- Thông số kỹ thuật
    dai             NUMERIC(8,2),                  -- Chiều dài (cm)
    rong            NUMERIC(8,2),                  -- Chiều rộng (cm)
    cao             NUMERIC(8,2),                  -- Chiều cao (cm)
    so_lop          SMALLINT     NOT NULL DEFAULT 3 CHECK (so_lop IN (3,5,7)),
    so_mau          SMALLINT     DEFAULT 0,         -- Số màu in
    ghim            BOOLEAN      NOT NULL DEFAULT FALSE,
    dan             BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Phân loại
    dvt             VARCHAR(20)  NOT NULL DEFAULT 'Thùng',
    phan_xuong      VARCHAR(50),                   -- BB, In, v.v.
    loai            VARCHAR(50),                   -- loại sản phẩm
    -- Khách hàng mặc định (nhiều sản phẩm làm riêng cho 1 KH)
    ma_kh_id        INTEGER REFERENCES customers(id),
    -- Giá
    gia_ban         NUMERIC(18,2) DEFAULT 0,
    gia_mua         NUMERIC(18,2) DEFAULT 0,       -- Giá gia công nếu có
    ton_toi_thieu   NUMERIC(12,3) DEFAULT 0,
    ton_toi_da      NUMERIC(12,3),
    khong_tinh_nxt  BOOLEAN NOT NULL DEFAULT FALSE,
    ghi_chu         TEXT,
    trang_thai      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 3: ĐỊNH MỨC SẢN XUẤT (BOM)
-- =======================================================

-- Đầu BOM (1 sản phẩm - 1 BOM version)
CREATE TABLE bom_headers (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER      NOT NULL REFERENCES products(id),
    phien_ban       INTEGER      NOT NULL DEFAULT 1,
    mo_ta           TEXT,
    hieu_luc_tu     DATE,
    hieu_luc_den    DATE,
    trang_thai      VARCHAR(20)  NOT NULL DEFAULT 'hoat_dong'
                    CHECK (trang_thai IN ('nhap','hieu_luc','het_han','hoat_dong')),
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, phien_ban)
);

-- Định mức giấy cuộn (nguyên liệu chính)
CREATE TABLE bom_paper_lines (
    id                  SERIAL PRIMARY KEY,
    bom_id              INTEGER      NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
    paper_material_id   INTEGER      NOT NULL REFERENCES paper_materials(id),
    -- Vị trí lớp: liner_ngoai, song, liner_giua, liner_trong, v.v.
    vi_tri_lop          VARCHAR(50)  NOT NULL,
    dinh_luong_tt        NUMERIC(8,2), -- gsm thực tế dùng
    kho_su_dung         NUMERIC(8,2), -- khổ cắt sử dụng (cm)
    -- Lượng tiêu hao lý thuyết (tính từ kích thước thùng + sóng)
    so_luong_lt         NUMERIC(12,6) NOT NULL,  -- kg / thùng
    ty_le_hao_hut       NUMERIC(5,2)  DEFAULT 0, -- %
    so_luong_dinh_muc   NUMERIC(12,6) NOT NULL,  -- kg / thùng (sau hao hụt)
    ghi_chu             TEXT
);

-- Định mức vật tư khác (keo, dây đai, mực, v.v.)
CREATE TABLE bom_other_material_lines (
    id                  SERIAL PRIMARY KEY,
    bom_id              INTEGER      NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
    other_material_id   INTEGER      NOT NULL REFERENCES other_materials(id),
    so_luong_dinh_muc   NUMERIC(12,6) NOT NULL,
    dvt                 VARCHAR(20),
    ty_le_hao_hut       NUMERIC(5,2) DEFAULT 0,
    ghi_chu             TEXT
);

-- Cấu hình chi phí gián tiếp
CREATE TABLE indirect_cost_configs (
    id              SERIAL PRIMARY KEY,
    ten             VARCHAR(150) NOT NULL,
    loai_chi_phi    VARCHAR(50)  NOT NULL, -- NHAN_CONG, MAY_MOC, QUAN_LY
    gia_tri         NUMERIC(18,2) NOT NULL,
    dvt             VARCHAR(20)  NOT NULL DEFAULT 'VND/thung',
    phan_xuong      VARCHAR(50),
    hieu_luc_tu     DATE,
    hieu_luc_den    DATE,
    trang_thai      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cấu hình tỷ lệ hao hụt theo loại sóng / loại giấy
CREATE TABLE waste_rate_configs (
    id              SERIAL PRIMARY KEY,
    ten             VARCHAR(150) NOT NULL,
    ma_ky_hieu      VARCHAR(20),    -- loại sóng
    so_lop          SMALLINT,
    ty_le_hao_hut   NUMERIC(5,2) NOT NULL,  -- %
    ap_dung_cho     VARCHAR(50),    -- GIAY, VAT_TU
    hieu_luc_tu     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 4: BÁN HÀNG
-- =======================================================

CREATE TABLE sales_orders (
    id              SERIAL PRIMARY KEY,
    so_don          VARCHAR(30)  NOT NULL UNIQUE,  -- Số đơn hàng tự sinh
    ngay_don        DATE         NOT NULL DEFAULT CURRENT_DATE,
    customer_id     INTEGER      NOT NULL REFERENCES customers(id),
    nv_kinh_doanh_id INTEGER     REFERENCES users(id),
    trang_thai      VARCHAR(30)  NOT NULL DEFAULT 'moi'
                    CHECK (trang_thai IN (
                        'moi','da_duyet','dang_sx','da_xuat','hoan_thanh','huy'
                    )),
    ngay_giao_hang  DATE,
    dia_chi_giao    TEXT,
    ghi_chu         TEXT,
    tong_tien       NUMERIC(18,2) DEFAULT 0,
    created_by      INTEGER REFERENCES users(id),
    approved_by     INTEGER REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER      NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id      INTEGER      REFERENCES products(id),          -- nullable: cho phép mặt hàng custom từ báo giá
    ten_hang        VARCHAR(255) NOT NULL DEFAULT '',              -- tên hàng (copy từ báo giá hoặc sản phẩm)
    so_luong        NUMERIC(12,3) NOT NULL CHECK (so_luong > 0),
    dvt             VARCHAR(20)  NOT NULL DEFAULT 'Thùng',
    don_gia         NUMERIC(18,2) NOT NULL DEFAULT 0,
    thanh_tien      NUMERIC(18,2) GENERATED ALWAYS AS (so_luong * don_gia) STORED,
    ghi_chu_san_pham TEXT,
    -- Yêu cầu in ấn / đặc thù
    yeu_cau_in      TEXT,
    ngay_giao_hang  DATE,        -- ngày giao riêng từng dòng nếu khác nhau
    so_luong_da_xuat NUMERIC(12,3) DEFAULT 0,
    trang_thai_dong VARCHAR(20)  DEFAULT 'cho_sx'
                    CHECK (trang_thai_dong IN ('cho_sx','dang_sx','da_xuat','huy'))
);


-- =======================================================
-- SCHEMA 5: MUA HÀNG
-- =======================================================

CREATE TABLE purchase_orders (
    id              SERIAL PRIMARY KEY,
    so_po           VARCHAR(30)  NOT NULL UNIQUE,
    ngay_po         DATE         NOT NULL DEFAULT CURRENT_DATE,
    supplier_id     INTEGER      NOT NULL REFERENCES suppliers(id),
    trang_thai      VARCHAR(30)  NOT NULL DEFAULT 'moi'
                    CHECK (trang_thai IN ('moi','da_duyet','da_gui_ncc','dang_giao','hoan_thanh','huy')),
    ngay_du_kien_nhan DATE,
    dieu_khoan_tt   VARCHAR(50),   -- COD, NET30, v.v.
    tong_tien       NUMERIC(18,2) DEFAULT 0,
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    approved_by     INTEGER REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id                  SERIAL PRIMARY KEY,
    po_id               INTEGER      NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    -- NVL có thể là giấy hoặc vật tư khác
    paper_material_id   INTEGER REFERENCES paper_materials(id),
    other_material_id   INTEGER REFERENCES other_materials(id),
    CHECK (
        (paper_material_id IS NOT NULL AND other_material_id IS NULL) OR
        (paper_material_id IS NULL AND other_material_id IS NOT NULL)
    ),
    so_luong            NUMERIC(12,3) NOT NULL,
    dvt                 VARCHAR(20)   NOT NULL DEFAULT 'Kg',
    don_gia             NUMERIC(18,2) NOT NULL DEFAULT 0,
    thanh_tien          NUMERIC(18,2) GENERATED ALWAYS AS (so_luong * don_gia) STORED,
    so_luong_da_nhan    NUMERIC(12,3) DEFAULT 0,
    ghi_chu             TEXT
);

-- Phiếu nhập kho (từ mua hàng hoặc trả hàng từ SX)
CREATE TABLE goods_receipts (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(30)  NOT NULL UNIQUE,
    ngay_nhap       DATE         NOT NULL DEFAULT CURRENT_DATE,
    po_id           INTEGER REFERENCES purchase_orders(id),
    supplier_id     INTEGER      NOT NULL REFERENCES suppliers(id),
    warehouse_id    INTEGER      NOT NULL REFERENCES warehouses(id),
    loai_nhap       VARCHAR(30)  NOT NULL DEFAULT 'MUA_HANG'
                    CHECK (loai_nhap IN ('MUA_HANG','TRA_SX','DIEU_CHINH','CHUYEN_KHO')),
    tong_gia_tri    NUMERIC(18,2) DEFAULT 0,
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipt_items (
    id                  SERIAL PRIMARY KEY,
    receipt_id          INTEGER      NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id          INTEGER REFERENCES purchase_order_items(id),
    paper_material_id   INTEGER REFERENCES paper_materials(id),
    other_material_id   INTEGER REFERENCES other_materials(id),
    CHECK (
        (paper_material_id IS NOT NULL AND other_material_id IS NULL) OR
        (paper_material_id IS NULL AND other_material_id IS NOT NULL)
    ),
    so_luong            NUMERIC(12,3) NOT NULL,
    dvt                 VARCHAR(20)   NOT NULL DEFAULT 'Kg',
    don_gia             NUMERIC(18,2) NOT NULL DEFAULT 0,
    thanh_tien          NUMERIC(18,2) GENERATED ALWAYS AS (so_luong * don_gia) STORED,
    -- Kiểm tra chất lượng
    dinh_luong_thuc_te  NUMERIC(8,2),
    do_am               NUMERIC(5,2),
    ket_qua_kiem_tra    VARCHAR(20)  DEFAULT 'DAT'
                        CHECK (ket_qua_kiem_tra IN ('DAT','KHONG_DAT','CHO_KIEM_TRA')),
    ghi_chu             TEXT
);

-- Quản lý từng cuộn giấy vật lý
CREATE TABLE paper_rolls (
    id                  SERIAL PRIMARY KEY,
    ma_cuon             VARCHAR(30)  NOT NULL UNIQUE,  -- Mã cuộn, vd: 26D00304
    paper_material_id   INTEGER      NOT NULL REFERENCES paper_materials(id),
    receipt_item_id     INTEGER REFERENCES goods_receipt_items(id),
    warehouse_id        INTEGER      NOT NULL REFERENCES warehouses(id),
    -- Thông số
    kho                 NUMERIC(8,2) NOT NULL,  -- Khổ thực tế (cm)
    dinh_luong          NUMERIC(8,2),           -- gsm thực tế
    trong_luong_ban_dau NUMERIC(10,3) NOT NULL, -- Kg khi nhập
    trong_luong_hien_tai NUMERIC(10,3) NOT NULL,-- Kg còn lại
    don_gia             NUMERIC(18,2) DEFAULT 0,
    -- Trạng thái
    trang_thai          VARCHAR(20)  NOT NULL DEFAULT 'kho'
                        CHECK (trang_thai IN ('kho','dang_dung','het','tralai')),
    ngay_nhap           DATE,
    ngay_xuat_gan_nhat  DATE,
    ghi_chu             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 6: SẢN XUẤT
-- =======================================================

CREATE TABLE production_orders (
    id              SERIAL PRIMARY KEY,
    so_lsx          VARCHAR(30)  NOT NULL UNIQUE,  -- Số lệnh sản xuất
    ngay_tao        DATE         NOT NULL DEFAULT CURRENT_DATE,
    ngay_bat_dau    DATE,
    ngay_hoan_thanh DATE,
    sales_order_id  INTEGER REFERENCES sales_orders(id),
    product_id      INTEGER      NOT NULL REFERENCES products(id),
    bom_id          INTEGER      NOT NULL REFERENCES bom_headers(id),
    so_luong_ke_hoach NUMERIC(12,3) NOT NULL,
    so_luong_thuc_te  NUMERIC(12,3) DEFAULT 0,
    so_luong_dat      NUMERIC(12,3) DEFAULT 0,
    so_luong_loi      NUMERIC(12,3) DEFAULT 0,
    phan_xuong       VARCHAR(50),
    trang_thai       VARCHAR(30)  NOT NULL DEFAULT 'moi'
                     CHECK (trang_thai IN (
                         'moi','da_duyet','dang_sx','hoan_thanh','huy'
                     )),
    ghi_chu          TEXT,
    created_by       INTEGER REFERENCES users(id),
    approved_by      INTEGER REFERENCES users(id),
    approved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phiếu xuất NVL cho sản xuất
CREATE TABLE material_issues (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(30)  NOT NULL UNIQUE,
    ngay_xuat       DATE         NOT NULL DEFAULT CURRENT_DATE,
    production_order_id INTEGER  NOT NULL REFERENCES production_orders(id),
    warehouse_id    INTEGER      NOT NULL REFERENCES warehouses(id),
    trang_thai      VARCHAR(20)  NOT NULL DEFAULT 'nhap'
                    CHECK (trang_thai IN ('nhap','da_xuat','huy')),
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE material_issue_items (
    id                  SERIAL PRIMARY KEY,
    issue_id            INTEGER      NOT NULL REFERENCES material_issues(id) ON DELETE CASCADE,
    paper_material_id   INTEGER REFERENCES paper_materials(id),
    other_material_id   INTEGER REFERENCES other_materials(id),
    paper_roll_id       INTEGER REFERENCES paper_rolls(id),  -- cuộn giấy cụ thể
    CHECK (
        (paper_material_id IS NOT NULL AND other_material_id IS NULL) OR
        (paper_material_id IS NULL AND other_material_id IS NOT NULL)
    ),
    so_luong_ke_hoach   NUMERIC(12,3) NOT NULL,
    so_luong_thuc_xuat  NUMERIC(12,3) DEFAULT 0,
    dvt                 VARCHAR(20)   NOT NULL DEFAULT 'Kg',
    don_gia             NUMERIC(18,2) DEFAULT 0,
    ghi_chu             TEXT
);

-- Sản lượng thực tế (nhập kho thành phẩm từ SX)
CREATE TABLE production_outputs (
    id                  SERIAL PRIMARY KEY,
    so_phieu            VARCHAR(30)  NOT NULL UNIQUE,
    ngay_nhap           DATE         NOT NULL DEFAULT CURRENT_DATE,
    production_order_id INTEGER      NOT NULL REFERENCES production_orders(id),
    warehouse_id        INTEGER      NOT NULL REFERENCES warehouses(id),
    so_luong_nhap       NUMERIC(12,3) NOT NULL,
    so_luong_loi        NUMERIC(12,3) DEFAULT 0,
    don_gia_xuat_xuong  NUMERIC(18,2) DEFAULT 0,
    ghi_chu             TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 7: KHO - TỒN KHO
-- =======================================================

-- Tổng hợp tồn kho theo NVL/TP và kho
CREATE TABLE inventory_balances (
    id                  SERIAL PRIMARY KEY,
    warehouse_id        INTEGER      NOT NULL REFERENCES warehouses(id),
    -- Loại hàng tồn
    paper_material_id   INTEGER REFERENCES paper_materials(id),
    other_material_id   INTEGER REFERENCES other_materials(id),
    product_id          INTEGER REFERENCES products(id),
    CHECK (
        (paper_material_id IS NOT NULL)::INT +
        (other_material_id IS NOT NULL)::INT +
        (product_id IS NOT NULL)::INT = 1
    ),
    ton_luong           NUMERIC(14,3) NOT NULL DEFAULT 0,
    gia_tri_ton         NUMERIC(18,2) NOT NULL DEFAULT 0,
    don_gia_binh_quan   NUMERIC(18,6) DEFAULT 0,  -- FIFO hoặc bình quân gia quyền
    cap_nhat_luc        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, paper_material_id, other_material_id, product_id)
);

-- Sổ chi tiết giao dịch kho (ledger)
CREATE TABLE inventory_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    ngay_giao_dich      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    warehouse_id        INTEGER      NOT NULL REFERENCES warehouses(id),
    paper_material_id   INTEGER REFERENCES paper_materials(id),
    other_material_id   INTEGER REFERENCES other_materials(id),
    product_id          INTEGER REFERENCES products(id),
    paper_roll_id       INTEGER REFERENCES paper_rolls(id),
    loai_giao_dich      VARCHAR(30)  NOT NULL
                        CHECK (loai_giao_dich IN (
                            'NHAP_MUA','XUAT_SX','TRA_SX','NHAP_SX',
                            'XUAT_BAN','DIEU_CHINH','CHUYEN_KHO_NHAP','CHUYEN_KHO_XUAT'
                        )),
    so_luong            NUMERIC(14,3) NOT NULL,  -- dương = nhập, âm = xuất
    don_gia             NUMERIC(18,6) DEFAULT 0,
    gia_tri             NUMERIC(18,2) DEFAULT 0,
    ton_sau_giao_dich   NUMERIC(14,3) DEFAULT 0,
    -- Tham chiếu chứng từ nguồn
    chung_tu_loai       VARCHAR(50),  -- GOODS_RECEIPT, MATERIAL_ISSUE, PRODUCTION_OUTPUT, v.v.
    chung_tu_id         INTEGER,
    ghi_chu             TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- SCHEMA 8: XUẤT KHO / GIAO HÀNG
-- =======================================================

CREATE TABLE delivery_orders (
    id              SERIAL PRIMARY KEY,
    so_phieu_xuat   VARCHAR(30)  NOT NULL UNIQUE,
    ngay_xuat       DATE         NOT NULL DEFAULT CURRENT_DATE,
    sales_order_id  INTEGER      NOT NULL REFERENCES sales_orders(id),
    customer_id     INTEGER      NOT NULL REFERENCES customers(id),
    warehouse_id    INTEGER      NOT NULL REFERENCES warehouses(id),
    dia_chi_giao    TEXT,
    nguoi_nhan      VARCHAR(150),
    xe_van_chuyen   VARCHAR(50),
    trang_thai      VARCHAR(20)  NOT NULL DEFAULT 'nhap'
                    CHECK (trang_thai IN ('nhap','da_xuat','da_giao','huy')),
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_order_items (
    id              SERIAL PRIMARY KEY,
    delivery_id     INTEGER      NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
    so_item_id      INTEGER      NOT NULL REFERENCES sales_order_items(id),
    product_id      INTEGER      NOT NULL REFERENCES products(id),
    so_luong        NUMERIC(12,3) NOT NULL,
    dvt             VARCHAR(20)  NOT NULL DEFAULT 'Thùng',
    ghi_chu         TEXT
);


-- =======================================================
-- SCHEMA 9: KẾ TOÁN
-- =======================================================

-- Hệ thống tài khoản kế toán (theo VAS)
CREATE TABLE chart_of_accounts (
    id              SERIAL PRIMARY KEY,
    so_tk           VARCHAR(20)  NOT NULL UNIQUE,  -- Số tài khoản, vd: 131, 331
    ten_tk          VARCHAR(255) NOT NULL,
    loai_tk         VARCHAR(20)  NOT NULL
                    CHECK (loai_tk IN ('TSNO','TSCÓ','VONSH','DOANHTHU','CHIPHI')),
    cap             SMALLINT     NOT NULL DEFAULT 1,
    so_tk_cha       VARCHAR(20)  REFERENCES chart_of_accounts(so_tk),
    trang_thai      BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Bút toán kế toán
CREATE TABLE journal_entries (
    id              SERIAL PRIMARY KEY,
    so_but_toan     VARCHAR(30)  NOT NULL UNIQUE,
    ngay_but_toan   DATE         NOT NULL DEFAULT CURRENT_DATE,
    dien_giai       TEXT         NOT NULL,
    loai_but_toan   VARCHAR(30)  NOT NULL,  -- NHAP_KHO, XUAT_KHO, BAN_HANG, THU_TIEN, v.v.
    tong_no         NUMERIC(18,2) DEFAULT 0,
    tong_co         NUMERIC(18,2) DEFAULT 0,
    chung_tu_loai   VARCHAR(50),
    chung_tu_id     INTEGER,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_entry_lines (
    id              SERIAL PRIMARY KEY,
    entry_id        INTEGER      NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    so_tk           VARCHAR(20)  NOT NULL REFERENCES chart_of_accounts(so_tk),
    dien_giai       TEXT,
    so_tien_no      NUMERIC(18,2) NOT NULL DEFAULT 0,
    so_tien_co      NUMERIC(18,2) NOT NULL DEFAULT 0,
    CHECK (so_tien_no >= 0 AND so_tien_co >= 0),
    CHECK (NOT (so_tien_no > 0 AND so_tien_co > 0))
);

-- Hoá đơn bán hàng
CREATE TABLE invoices (
    id              SERIAL PRIMARY KEY,
    so_hoa_don      VARCHAR(30)  NOT NULL UNIQUE,
    ngay_hoa_don    DATE         NOT NULL DEFAULT CURRENT_DATE,
    han_thanh_toan  DATE,
    customer_id     INTEGER      NOT NULL REFERENCES customers(id),
    delivery_id     INTEGER REFERENCES delivery_orders(id),
    sales_order_id  INTEGER REFERENCES sales_orders(id),
    tong_tien_hang  NUMERIC(18,2) NOT NULL DEFAULT 0,
    tong_chiet_khau NUMERIC(18,2) DEFAULT 0,
    tong_thue_vat   NUMERIC(18,2) DEFAULT 0,
    tong_thanh_toan NUMERIC(18,2) NOT NULL DEFAULT 0,
    da_thanh_toan   NUMERIC(18,2) DEFAULT 0,
    con_no          NUMERIC(18,2) GENERATED ALWAYS AS (tong_thanh_toan - da_thanh_toan) STORED,
    trang_thai      VARCHAR(20)  NOT NULL DEFAULT 'moi'
                    CHECK (trang_thai IN ('moi','da_gui','da_tt_mot_phan','da_tt_du','qua_han')),
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phiếu thu / thanh toán
CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(30)  NOT NULL UNIQUE,
    ngay_tt         DATE         NOT NULL DEFAULT CURRENT_DATE,
    loai            VARCHAR(10)  NOT NULL CHECK (loai IN ('THU','CHI')),
    invoice_id      INTEGER REFERENCES invoices(id),
    po_id           INTEGER REFERENCES purchase_orders(id),
    customer_id     INTEGER REFERENCES customers(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    so_tien         NUMERIC(18,2) NOT NULL,
    hinh_thuc_tt    VARCHAR(30)  NOT NULL DEFAULT 'CHUYEN_KHOAN'
                    CHECK (hinh_thuc_tt IN ('TIEN_MAT','CHUYEN_KHOAN','SEC')),
    so_tham_chieu   VARCHAR(100),  -- Số chuyển khoản, séc
    ghi_chu         TEXT,
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =======================================================
-- INDEXES (TỐI ƯU TRUY VẤN)
-- =======================================================

-- Users & Auth
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role_id);

-- Customers & Suppliers
CREATE INDEX idx_customers_ma ON customers(ma_kh);
CREATE INDEX idx_customers_ten ON customers USING gin(to_tsvector('simple', unaccent(ten_don_vi)));
CREATE INDEX idx_suppliers_ma ON suppliers(ma_ncc);

-- Products
CREATE INDEX idx_products_ma_amis ON products(ma_amis);
CREATE INDEX idx_products_ma_kh ON products(ma_kh_id);
CREATE INDEX idx_products_ten ON products USING gin(to_tsvector('simple', unaccent(ten_hang)));

-- Paper materials
CREATE INDEX idx_paper_materials_ma ON paper_materials(ma_chinh);
CREATE INDEX idx_paper_materials_nhom ON paper_materials(ma_nhom_id);
CREATE INDEX idx_paper_materials_kho ON paper_materials(kho);

-- Paper rolls
CREATE INDEX idx_paper_rolls_ma_cuon ON paper_rolls(ma_cuon);
CREATE INDEX idx_paper_rolls_material ON paper_rolls(paper_material_id);
CREATE INDEX idx_paper_rolls_warehouse ON paper_rolls(warehouse_id);
CREATE INDEX idx_paper_rolls_trang_thai ON paper_rolls(trang_thai);

-- Sales Orders
CREATE INDEX idx_so_ngay ON sales_orders(ngay_don DESC);
CREATE INDEX idx_so_customer ON sales_orders(customer_id);
CREATE INDEX idx_so_trang_thai ON sales_orders(trang_thai);
CREATE INDEX idx_soi_order ON sales_order_items(order_id);
CREATE INDEX idx_soi_product ON sales_order_items(product_id);

-- Purchase Orders
CREATE INDEX idx_po_ngay ON purchase_orders(ngay_po DESC);

-- Additional indexes for performance
CREATE INDEX idx_customers_ma_kh ON customers(ma_kh);
CREATE INDEX idx_sales_orders_so_don ON sales_orders(so_don);
CREATE INDEX idx_paper_materials_ma_chinh ON paper_materials(ma_chinh);
CREATE INDEX idx_other_materials_ma_chinh ON other_materials(ma_chinh);
CREATE INDEX idx_products_ma_chinh ON products(ma_chinh);

-- Indexes for created_at ranges
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX idx_sales_orders_created_at ON sales_orders(created_at DESC);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at DESC);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_trang_thai ON purchase_orders(trang_thai);

-- Production Orders
CREATE INDEX idx_lsx_ngay ON production_orders(ngay_tao DESC);
CREATE INDEX idx_lsx_product ON production_orders(product_id);
CREATE INDEX idx_lsx_so_id ON production_orders(sales_order_id);
CREATE INDEX idx_lsx_trang_thai ON production_orders(trang_thai);

-- Inventory
CREATE INDEX idx_inv_bal_warehouse ON inventory_balances(warehouse_id);
CREATE INDEX idx_inv_tx_ngay ON inventory_transactions(ngay_giao_dich DESC);
CREATE INDEX idx_inv_tx_warehouse ON inventory_transactions(warehouse_id);
CREATE INDEX idx_inv_tx_loai ON inventory_transactions(loai_giao_dich);
CREATE INDEX idx_inv_tx_chung_tu ON inventory_transactions(chung_tu_loai, chung_tu_id);

-- Invoices & Payments
CREATE INDEX idx_invoice_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_ngay ON invoices(ngay_hoa_don DESC);
CREATE INDEX idx_invoice_trang_thai ON invoices(trang_thai);
CREATE INDEX idx_payment_ngay ON payments(ngay_tt DESC);

-- Audit logs
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_bang ON audit_logs(bang);
CREATE INDEX idx_audit_ngay ON audit_logs(created_at DESC);


-- =======================================================
-- DỮ LIỆU KHỞI TẠO (SEED DATA)
-- =======================================================

-- Vai trò mặc định
INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta) VALUES
('ADMIN',       'Quản trị hệ thống',    'Toàn quyền truy cập'),
('GIAM_DOC',    'Giám đốc',             'Xem toàn bộ, duyệt cấp cao'),
('KE_TOAN',     'Kế toán',              'Module kế toán, công nợ, thanh toán'),
('KINH_DOANH',  'Kinh doanh',           'Đơn hàng, khách hàng, giao hàng'),
('KHO',         'Thủ kho',              'Nhập xuất kho, tồn kho'),
('SAN_XUAT',    'Quản lý sản xuất',     'Lệnh SX, BOM, sản lượng'),
('MUA_HANG',    'Mua hàng',             'Đơn mua, nhà cung cấp'),
('CONG_NHAN',   'Công nhân',            'Xem lệnh SX, nhập sản lượng');

-- Tài khoản admin mặc định (password: Admin@123 - phải đổi ngay)
INSERT INTO users (username, ho_ten, email, password_hash, role_id) VALUES
('admin', 'Quản trị viên', 'admin@namphuong.vn',
 '$2b$12$placeholder_change_immediately', 1);

-- Kho mặc định
INSERT INTO warehouses (ma_kho, ten_kho, loai_kho) VALUES
('KNVL01',  'Kho NVL - Long An',        'NVL'),
('KNVL02',  'Kho NVL - Hóc Môn',        'NVL'),
('KTP01',   'Kho Thành Phẩm',           'TP'),
('KVT01',   'Kho Vật Tư',               'VAT_TU');

-- Hệ thống tài khoản kế toán cơ bản (theo VAS)
INSERT INTO chart_of_accounts (so_tk, ten_tk, loai_tk, cap) VALUES
('131',  'Phải thu khách hàng',          'TSNO',      1),
('331',  'Phải trả người bán',           'TSCÓ',      1),
('511',  'Doanh thu bán hàng',           'DOANHTHU',  1),
('632',  'Giá vốn hàng bán',             'CHIPHI',    1),
('641',  'Chi phí bán hàng',             'CHIPHI',    1),
('642',  'Chi phí quản lý doanh nghiệp', 'CHIPHI',    1),
('111',  'Tiền mặt',                     'TSNO',      1),
('112',  'Tiền gửi ngân hàng',           'TSNO',      1),
('152',  'Nguyên liệu, vật liệu',        'TSNO',      1),
('155',  'Thành phẩm',                   'TSNO',      1),
('156',  'Hàng hoá',                     'TSNO',      1),
('621',  'Chi phí NVL trực tiếp',        'CHIPHI',    1),
('622',  'Chi phí nhân công trực tiếp',  'CHIPHI',    1),
('627',  'Chi phí sản xuất chung',       'CHIPHI',    1),
('154',  'Chi phí SX dở dang',           'TSNO',      1);
