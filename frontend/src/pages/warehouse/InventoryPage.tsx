import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Col, Row, Select, Input, Spin, Table, Tag, Typography, Space, Statistic,
} from 'antd'
import { DatabaseOutlined, WarningOutlined } from '@ant-design/icons'
import { warehouseApi, TonKho } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'

const { Title, Text } = Typography

export default function InventoryPage() {
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [loai, setLoai] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: tonKho = [], isLoading } = useQuery({
    queryKey: ['ton-kho', phanXuongId, warehouseId, loai],
    queryFn: () => warehouseApi.getTonKho({ phan_xuong_id: phanXuongId, warehouse_id: warehouseId, loai }).then(r => r.data),
    refetchInterval: 60_000,
  })

  const filteredWarehouses = phanXuongId
    ? warehouses.filter((w: any) => w.phan_xuong_id === phanXuongId)
    : warehouses

  const filtered = search
    ? tonKho.filter(r => r.ten_hang.toLowerCase().includes(search.toLowerCase()))
    : tonKho

  const thieu = filtered.filter(r => r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0)
  const tongGiaTri = filtered.reduce((s, r) => s + r.gia_tri_ton, 0)

  const columns = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v: string, r: TonKho) => (
        <Space>
          <Text strong>{v}</Text>
          {r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 && (
            <WarningOutlined style={{ color: '#ff4d4f' }} />
          )}
        </Space>
      ),
    },
    { title: 'Kho', dataIndex: 'ten_kho', width: 160 },
    {
      title: 'Tồn kho',
      dataIndex: 'ton_luong',
      width: 120,
      align: 'right' as const,
      render: (v: number, r: TonKho) => (
        <Text strong style={{ color: v < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? '#ff4d4f' : '#1677ff' }}>
          {v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'ton_toi_thieu',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Đơn giá BQ',
      dataIndex: 'don_gia_binh_quan',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—',
    },
    {
      title: 'Giá trị tồn',
      dataIndex: 'gia_tri_ton',
      width: 140,
      align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: '#52c41a' }}>
          {v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ
        </Text>
      ),
    },
    {
      title: 'Cập nhật',
      dataIndex: 'cap_nhat_luc',
      width: 130,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <DatabaseOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Tồn kho</Title>
          </Space>
        </Col>
      </Row>

      {/* Thống kê nhanh */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic title="Tổng mặt hàng" value={filtered.length} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small">
            <Statistic
              title="Cần nhập thêm"
              value={thieu.length}
              valueStyle={{ color: thieu.length > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={thieu.length > 0 ? <WarningOutlined /> : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8}>
          <Card size="small">
            <Statistic
              title="Tổng giá trị tồn"
              value={tongGiaTri}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Tất cả xưởng"
              style={{ width: '100%' }}
              allowClear
              value={phanXuongId}
              onChange={v => { setPhanXuongId(v); setWarehouseId(undefined) }}
              options={phanXuongs.map((x: any) => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Tất cả kho"
              style={{ width: '100%' }}
              allowClear
              value={warehouseId}
              onChange={setWarehouseId}
              options={filteredWarehouses.filter((w: any) => w.trang_thai).map((w: any) => ({ value: w.id, label: w.ten_kho }))}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Loại vật tư"
              style={{ width: '100%' }}
              allowClear
              value={loai}
              onChange={setLoai}
              options={[
                { value: 'giay', label: 'Nguyên liệu giấy' },
                { value: 'khac', label: 'Nguyên liệu khác' },
              ]}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Input.Search
              placeholder="Tìm tên hàng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <Spin style={{ margin: 40, display: 'block' }} />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: 900 }}
            rowClassName={(r: TonKho) =>
              r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? 'ant-table-row-danger' : ''
            }
          />
        </Card>
      )}

      {thieu.length > 0 && (
        <Card
          size="small"
          style={{ marginTop: 12, borderColor: '#ffbb96', background: '#fff2e8' }}
          title={<Space><WarningOutlined style={{ color: '#fa541c' }} /><Text strong style={{ color: '#fa541c' }}>Cần nhập thêm ({thieu.length} mặt hàng)</Text></Space>}
        >
          <Row gutter={[8, 8]}>
            {thieu.map(r => (
              <Col key={r.id} xs={24} sm={12} md={8}>
                <Tag color="red" style={{ width: '100%', padding: '4px 8px' }}>
                  {r.ten_hang} — tồn: {r.ton_luong.toFixed(2)} / min: {r.ton_toi_thieu.toFixed(2)} {r.don_vi}
                </Tag>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  )
}
