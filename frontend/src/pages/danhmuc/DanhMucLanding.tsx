import { Link } from 'react-router-dom';
import { Row, Col, Typography } from 'antd';
import { useAuthStore } from '../../store/auth';

const { Title, Text } = Typography;

type LinkItem = {
  label: string;
  to: string;
  permissions?: string[];
};

type Group = {
  title: string;
  links: LinkItem[];
};

const COLUMNS: Group[][] = [
  [
    {
      title: 'Đối tượng',
      links: [
        { label: 'Khách hàng', to: '/master/customers', permissions: ['master.customers.view', 'master.customers.manage', 'customer.view'] },
        { label: 'Nhà cung cấp', to: '/master/suppliers', permissions: ['master.suppliers.view', 'master.suppliers.manage'] },
        { label: 'Tài khoản hệ thống', to: '/master/users', permissions: ['master.users.view', 'master.users.manage', 'team.manage_permissions'] },
      ],
    },
    {
      title: 'Chi phí & Giá',
      links: [
        { label: 'Chi phí gián tiếp', to: '/master/indirect-costs', permissions: ['master.other.manage'] },
        { label: 'Phí gia công / Tỷ lệ lãi', to: '/master/addon-rates', permissions: ['master.other.manage'] },
        { label: 'Giá giấy tem offset', to: '/master/tem-paper-prices', permissions: ['master.other.manage'] },
        { label: 'Giá dịch vụ offset', to: '/master/offset-addon-prices', permissions: ['master.other.manage'] },
      ],
    },
    {
      title: 'Ngân hàng',
      links: [
        { label: 'Tài khoản ngân hàng', to: '/master/bank-accounts', permissions: ['accounting.manage', 'accounting.view'] },
      ],
    },
  ],
  [
    {
      title: 'Vật tư, Hàng hóa',
      links: [
        { label: 'Hàng hóa', to: '/master/products', permissions: ['master.products.view', 'master.products.manage', 'customer.view'] },
        { label: 'Nhóm nguyên liệu', to: '/master/material-groups', permissions: ['master.materials.view', 'master.materials.manage'] },
        { label: 'Nguyên liệu giấy', to: '/master/paper-materials', permissions: ['master.materials.view', 'master.materials.manage'] },
        { label: 'Nguyên liệu khác', to: '/master/other-materials', permissions: ['master.materials.view', 'master.materials.manage'] },
        { label: 'Kết cấu thông dụng', to: '/danhmuc/cau-truc', permissions: ['master.materials.view', 'master.materials.manage'] },
      ],
    },
    {
      title: 'Kho & Vị trí',
      links: [
        { label: 'Danh mục kho', to: '/master/warehouses', permissions: ['inventory.view', 'master.other.view', 'master.other.manage'] },
        { label: 'Vị trí kho', to: '/master/vi-tri', permissions: ['inventory.view', 'master.other.view', 'master.other.manage'] },
      ],
    },
    {
      title: 'Địa lý',
      links: [
        { label: 'Đơn vị tính', to: '/master/don-vi-tinh', permissions: ['master.other.view', 'master.other.manage'] },
        { label: 'Tỉnh/Thành phố', to: '/master/tinh-thanh', permissions: ['master.other.view', 'master.other.manage'] },
        { label: 'Phường/Xã', to: '/master/phuong-xa', permissions: ['master.other.view', 'master.other.manage'] },
      ],
    },
  ],
  [
    {
      title: 'Tổ chức',
      links: [
        { label: 'Pháp nhân', to: '/danhmuc/phap-nhan', permissions: ['master.other.manage'] },
        { label: 'Phân xưởng', to: '/master/phan-xuong', permissions: ['master.other.manage'] },
      ],
    },
    {
      title: 'Vận chuyển',
      links: [
        { label: 'Xe', to: '/master/xe', permissions: ['master.other.view', 'master.other.manage'] },
        { label: 'Tài xế', to: '/master/tai-xe', permissions: ['master.other.view', 'master.other.manage'] },
        { label: 'Lô xe', to: '/master/lo-xe', permissions: ['master.other.view', 'master.other.manage'] },
        { label: 'Đơn giá vận chuyển', to: '/master/don-gia-van-chuyen', permissions: ['master.other.view', 'master.other.manage'] },
      ],
    },
    {
      title: 'Hệ thống',
      links: [
        { label: 'Phân quyền', to: '/master/roles', permissions: ['permission.view', 'permission.manage'] },
        { label: 'Biểu mẫu in', to: '/master/print-templates', permissions: ['master.other.view', 'master.other.manage', 'sales_order.view'] },
        { label: 'Lịch sử Import', to: '/reports/import-history', permissions: ['master.import', 'sales.import'] },
      ],
    },
  ],
];

function canSee(permissions: string[] | undefined, role: string, userPermissions: string[]): boolean {
  if (role === 'ADMIN') return true;
  if (!permissions || permissions.length === 0) return true;
  return permissions.some(p => userPermissions.includes(p));
}

export default function DanhMucLanding() {
  const user = useAuthStore(state => state.user);
  const role = user?.role ?? '';
  const userPermissions: string[] = user?.permissions ?? [];

  return (
    <div style={{ background: '#f0f4fa', minHeight: '100vh', padding: 24 }}>
      <style>{`
        .danhmuc-link {
          display: block;
          line-height: 2;
          color: #1677ff;
          font-size: 13px;
          text-decoration: none;
          transition: color 0.15s ease;
        }
        .danhmuc-link:hover {
          color: #1b168e;
          text-decoration: underline;
        }
      `}</style>

      <Title level={4} style={{ marginBottom: 16 }}>
        Danh mục
      </Title>

      <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
        <Row gutter={[32, 0]}>
          {COLUMNS.map((groups, colIndex) => (
            <Col span={8} key={colIndex}>
              {groups.map((group) => {
                const visibleLinks = group.links.filter(item => canSee(item.permissions, role, userPermissions));
                if (visibleLinks.length === 0) return null;
                return (
                  <div key={group.title} style={{ marginBottom: 28 }}>
                    <Text
                      strong
                      style={{
                        fontSize: 14,
                        color: '#262626',
                        display: 'block',
                        marginBottom: 8,
                      }}
                    >
                      {group.title}
                    </Text>
                    {visibleLinks.map((item) => (
                      <Link key={item.to} to={item.to} className="danhmuc-link">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
