-- ====================================================
-- MIGRATION: Tạo bảng Permissions và Role_Permissions
-- Date: 2026-05-05
-- ====================================================

-- Bảng lưu danh sách các quyền
CREATE TABLE IF NOT EXISTS permissions (
    id          SERIAL PRIMARY KEY,
    ma_quyen    VARCHAR(100) NOT NULL UNIQUE,
    ten_quyen   VARCHAR(255) NOT NULL,
    mo_ta       TEXT,
    nhom        VARCHAR(50),  -- 'sales', 'production', 'inventory', 'finance', 'admin', etc.
    trang_thai  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Bảng liên kết giữa Roles và Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id              SERIAL PRIMARY KEY,
    role_id         INTEGER      NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   INTEGER      NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Thêm index cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_permissions_ma_quyen ON permissions(ma_quyen);
CREATE INDEX IF NOT EXISTS idx_permissions_nhom ON permissions(nhom);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- ====================================================
-- SEED DATA: Danh sách quyền mặc định
-- ====================================================

-- Quyền Quản lý Khách hàng
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('customer.view', 'Xem danh sách khách hàng', 'Có thể xem danh sách tất cả khách hàng', 'sales', TRUE),
('customer.create', 'Tạo khách hàng', 'Có thể tạo khách hàng mới', 'sales', TRUE),
('customer.edit', 'Sửa khách hàng', 'Có thể chỉnh sửa thông tin khách hàng', 'sales', TRUE),
('customer.delete', 'Xóa khách hàng', 'Có thể xóa khách hàng', 'sales', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Đơn hàng
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('sales_order.view', 'Xem đơn hàng', 'Có thể xem danh sách đơn hàng', 'sales', TRUE),
('sales_order.create', 'Tạo đơn hàng', 'Có thể tạo đơn hàng mới', 'sales', TRUE),
('sales_order.edit', 'Sửa đơn hàng', 'Có thể chỉnh sửa đơn hàng', 'sales', TRUE),
('sales_order.approve', 'Duyệt đơn hàng', 'Có thể duyệt đơn hàng', 'sales', TRUE),
('sales_order.cancel', 'Hủy đơn hàng', 'Có thể hủy đơn hàng', 'sales', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Lệnh Sản xuất
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('production_order.view', 'Xem lệnh sản xuất', 'Có thể xem danh sách lệnh sản xuất', 'production', TRUE),
('production_order.create', 'Tạo lệnh sản xuất', 'Có thể tạo lệnh sản xuất mới', 'production', TRUE),
('production_order.edit', 'Sửa lệnh sản xuất', 'Có thể chỉnh sửa lệnh sản xuất', 'production', TRUE),
('production_order.start', 'Bắt đầu sản xuất', 'Có thể bắt đầu sản xuất', 'production', TRUE),
('production_order.complete', 'Hoàn thành sản xuất', 'Có thể đánh dấu lệnh là hoàn thành', 'production', TRUE),
('production_order.cancel', 'Hủy lệnh sản xuất', 'Có thể hủy lệnh sản xuất', 'production', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Kho
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('inventory.view', 'Xem kho', 'Có thể xem tồn kho', 'inventory', TRUE),
('inventory.import', 'Nhập kho', 'Có thể nhập hàng vào kho', 'inventory', TRUE),
('inventory.export', 'Xuất kho', 'Có thể xuất hàng từ kho', 'inventory', TRUE),
('inventory.adjust', 'Điều chỉnh kho', 'Có thể điều chỉnh số lượng kho', 'inventory', TRUE),
('inventory.transfer', 'Chuyển kho', 'Có thể chuyển hàng giữa các kho', 'inventory', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Sản phẩm
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('product.view', 'Xem sản phẩm', 'Có thể xem danh sách sản phẩm', 'master_data', TRUE),
('product.create', 'Tạo sản phẩm', 'Có thể tạo sản phẩm mới', 'master_data', TRUE),
('product.edit', 'Sửa sản phẩm', 'Có thể chỉnh sửa sản phẩm', 'master_data', TRUE),
('product.delete', 'Xóa sản phẩm', 'Có thể xóa sản phẩm', 'master_data', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Người dùng
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('user.view', 'Xem người dùng', 'Có thể xem danh sách người dùng', 'admin', TRUE),
('user.create', 'Tạo người dùng', 'Có thể tạo người dùng mới', 'admin', TRUE),
('user.edit', 'Sửa người dùng', 'Có thể chỉnh sửa người dùng', 'admin', TRUE),
('user.delete', 'Xóa người dùng', 'Có thể xóa người dùng', 'admin', TRUE),
('user.reset_password', 'Reset mật khẩu', 'Có thể reset mật khẩu người dùng', 'admin', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Quản lý Quyền
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('permission.view', 'Xem quyền', 'Có thể xem danh sách quyền', 'admin', TRUE),
('permission.manage', 'Quản lý quyền', 'Có thể gán/xóa quyền cho vai trò', 'admin', TRUE),
('role.view', 'Xem vai trò', 'Có thể xem danh sách vai trò', 'admin', TRUE),
('role.create', 'Tạo vai trò', 'Có thể tạo vai trò mới', 'admin', TRUE),
('role.edit', 'Sửa vai trò', 'Có thể chỉnh sửa vai trò', 'admin', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- Quyền Báo cáo
INSERT INTO permissions (ma_quyen, ten_quyen, mo_ta, nhom, trang_thai) VALUES
('report.view', 'Xem báo cáo', 'Có thể xem báo cáo', 'reports', TRUE),
('report.export', 'Xuất báo cáo', 'Có thể xuất báo cáo', 'reports', TRUE),
('report.schedule', 'Lên lịch báo cáo', 'Có thể lên lịch báo cáo định kỳ', 'reports', TRUE)
ON CONFLICT (ma_quyen) DO NOTHING;

-- ====================================================
-- SEED DATA: Gán quyền cho các Vai trò mặc định
-- ====================================================

-- BGD (Ban Giám Đốc) - có tất cả quyền
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'bgd'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Trưởng phòng - quản lý bộ phận của mình
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'truong_phong'
AND p.ma_quyen IN (
    'customer.view', 'customer.create', 'customer.edit',
    'sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve',
    'production_order.view', 'production_order.create', 'production_order.edit',
    'inventory.view', 'inventory.import', 'inventory.export',
    'product.view', 'report.view', 'report.export'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Giám sát - quản lý quy trình
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'giam_sat'
AND p.ma_quyen IN (
    'sales_order.view',
    'production_order.view', 'production_order.create', 'production_order.edit', 'production_order.start', 'production_order.complete',
    'inventory.view', 'inventory.adjust',
    'product.view', 'report.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Tổ trưởng
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'to_truong'
AND p.ma_quyen IN (
    'sales_order.view',
    'production_order.view', 'production_order.start', 'production_order.complete',
    'inventory.view', 'inventory.export',
    'product.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Nhân viên - quyền cơ bản
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'nhan_vien'
AND p.ma_quyen IN (
    'sales_order.view',
    'production_order.view',
    'inventory.view',
    'product.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Nhân viên theo dõi (SA) - theo dõi đơn hàng
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.ma_vai_tro = 'nhan_vien_theo_doi'
AND p.ma_quyen IN (
    'customer.view',
    'sales_order.view', 'sales_order.create', 'sales_order.edit',
    'production_order.view',
    'inventory.view',
    'product.view', 'report.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
