import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Tabs, Table, Select, Typography, Space, Tag, Spin, Row, Col, Statistic } from 'antd'
import { useAuthStore } from '../../store/auth'
import { cd2Api, type KhoRow } from '../../api/cd2'
import { warehouseApi, type TonKhoTPRow } from '../../api/warehouse'
import client from '../../api/client'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

const SALE_ADMIN_ROLES = ['SALE_ADMIN', 'TRUONG_PHONG_SALE_ADMIN']

export default function BaoCaoPhoiTpPage() {
  const user = useAuthStore(s => s.user)
  const isSaleAdmin = SALE_ADMIN_ROLES.includes(user?.role ?? '')
  // Quyền toàn cục (từ role)
  const canViewAllNv = user?.permissions?.includes('report.xnt_all_nv') ?? false
  // NV cụ thể được phép xem (từ quyền bổ sung có target_user_id)
  const allowedNvIds = user?.allowed_nv_ids?.['report.xnt_all_nv'] ?? []
  const hasAnyAccess = canViewAllNv || allowedNvIds.length > 0
  // Lock về chính mình nếu là SALE_ADMIN và không có quyền nào
  const isLocked = isSaleAdmin && !hasAnyAccess

  const [filterNvId, setFilterNvId] = useState<number | undefined>(
    isLocked ? user?.id : undefined
  )

  const { data: nvListRaw = [] } = useQuery<{ id: number; ho_ten: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => client.get<{ id: number; ho_ten: string }[]>('/users/dropdown').then(r => r.data),
    enabled: !isLocked,
  })

  // Lọc danh sách NV theo quyền: toàn cục → tất cả, có target → chỉ NV được phép + chính mình
  const nvList = canViewAllNv
    ? nvListRaw
    : nvListRaw.filter(u => u.id === user?.id || allowedNvIds.includes(u.id))

  // Tab 1: Phôi sóng
  const { data: phoiData = [], isLoading: phoiLoading } = useQuery<KhoRow[]>({
    queryKey: ['bao-cao-phoi', filterNvId],
    queryFn: () => cd2Api.getTonKhoLsx({ nv_theo_doi_id: filterNvId }).then(r => r.data),
    refetchOnMount: 'always',
  })

  // Tab 2: Thành phẩm
  const { data: tpData = [], isLoading: tpLoading } = useQuery<TonKhoTPRow[]>({
    queryKey: ['bao-cao-tp', filterNvId],
    queryFn: () => warehouseApi.getTonKhoTpLsx({ nv_theo_doi_id: filterNvId }).then(r => r.data),
    refetchOnMount: 'always',
  })

  const phoiCols = [
    { title: 'Số lệnh', dataIndex: 'so_lenh', width: 130, fixed: 'left' as const },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 160 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', width: 200, ellipsis: true },
    { title: 'Kho', dataIndex: 'ten_phan_xuong', width: 130 },
    {
      title: 'Nhập', dataIndex: 'tong_nhap', width: 90,
      render: (v: number) => v.toLocaleString('vi-VN'),
      align: 'right' as const,
    },
    {
      title: 'Xuất', dataIndex: 'tong_xuat', width: 90,
      render: (v: number) => v.toLocaleString('vi-VN'),
      align: 'right' as const,
    },
    {
      title: 'Tồn kho', dataIndex: 'ton_kho', width: 100,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#1677ff' : '#d4380d' }}>
          {v.toLocaleString('vi-VN')}
        </Text>
      ),
      align: 'right' as const,
      sorter: (a: KhoRow, b: KhoRow) => b.ton_kho - a.ton_kho,
    },
    {
      title: 'Đang in',
      dataIndex: 'phieu_in_hien_tai',
      width: 100,
      render: (v: KhoRow['phieu_in_hien_tai']) =>
        v ? <Tag color="processing">{v.so_phieu}</Tag> : null,
    },
  ]
  const { displayColumns: displayPhoiCols, settingsButton: phoiSettingsButton } = useColumnPrefs('reports-bao-cao-phoi-tp', phoiCols, { nonHideable: ['so_lenh'] })

  const tpCols = [
    { title: 'Số lệnh', dataIndex: 'so_lenh', width: 130, fixed: 'left' as const },
    { title: 'Số đơn', dataIndex: 'so_don', width: 130 },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 160 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', width: 200, ellipsis: true },
    { title: 'Kho', dataIndex: 'ten_phan_xuong', width: 130 },
    {
      title: 'KH', dataIndex: 'sl_ke_hoach', width: 90,
      render: (v: number) => v?.toLocaleString('vi-VN'),
      align: 'right' as const,
    },
    {
      title: 'Nhập', dataIndex: 'tong_nhap', width: 90,
      render: (v: number) => v?.toLocaleString('vi-VN'),
      align: 'right' as const,
    },
    {
      title: 'Xuất', dataIndex: 'tong_xuat', width: 90,
      render: (v: number) => v?.toLocaleString('vi-VN'),
      align: 'right' as const,
    },
    {
      title: 'Tồn kho', dataIndex: 'ton_kho', width: 100,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#1677ff' : '#d4380d' }}>
          {v?.toLocaleString('vi-VN')}
        </Text>
      ),
      align: 'right' as const,
      sorter: (a: TonKhoTPRow, b: TonKhoTPRow) => b.ton_kho - a.ton_kho,
    },
  ]
  const { displayColumns: displayTpCols } = useColumnPrefs('reports-bao-cao-phoi-tp-tp', tpCols, { nonHideable: ['so_lenh'] })

  const totalPhoiTon = phoiData.reduce((s, r) => s + (r.ton_kho || 0), 0)
  const totalTpTon = tpData.reduce((s, r) => s + (r.ton_kho || 0), 0)

  return (
    <Card>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Tồn kho Phôi & Thành phẩm</Title>
          <Text type="secondary">Theo dõi tồn kho theo nhân viên phụ trách</Text>
        </Col>
        <Col>
          {!isLocked && (
            <Space>
              <Text>Nhân viên:</Text>
              <Select
                allowClear
                placeholder="Tất cả NV"
                style={{ width: 200 }}
                value={filterNvId}
                onChange={v => setFilterNvId(v)}
                options={nvList.map(u => ({ value: u.id, label: u.ho_ten }))}
              />
            </Space>
          )}
          {isLocked && (
            <Tag color="blue">Hiển thị: {user?.ho_ten}</Tag>
          )}
          {phoiSettingsButton}
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng tồn phôi sóng"
              value={totalPhoiTon}
              suffix="tấm"
              valueStyle={{ color: '#1677ff' }}
              loading={phoiLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng tồn thành phẩm"
              value={totalTpTon}
              suffix="thùng"
              valueStyle={{ color: '#52c41a' }}
              loading={tpLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Số LSX phôi có tồn" value={phoiData.filter(r => r.ton_kho > 0).length} suffix="LSX" loading={phoiLoading} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Số LSX TP có tồn" value={tpData.filter(r => r.ton_kho > 0).length} suffix="LSX" loading={tpLoading} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'phoi',
            label: `Phôi sóng (${phoiData.length})`,
            children: phoiLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : (
              <Table
                dataSource={phoiData}
                columns={displayPhoiCols}
                rowKey={r => `${r.production_order_id}-${r.warehouse_id}`}
                size="small"
                scroll={{ x: 1000 }}
                pagination={{ pageSize: 50, showTotal: t => `${t} bản ghi` }}
              />
            ),
          },
          {
            key: 'tp',
            label: `Thành phẩm (${tpData.length})`,
            children: tpLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : (
              <Table
                dataSource={tpData}
                columns={displayTpCols}
                rowKey={r => `${r.production_order_id}-${r.warehouse_id}`}
                size="small"
                scroll={{ x: 1100 }}
                pagination={{ pageSize: 50, showTotal: t => `${t} bản ghi` }}
              />
            ),
          },
        ]}
      />
    </Card>
  )
}
