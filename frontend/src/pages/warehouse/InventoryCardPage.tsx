import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Row, Select, Space, Table, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { warehousesApi, type Warehouse } from '../../api/warehouses'
import { warehouseApi, type GiaoDich } from '../../api/warehouse'
import { exportToExcel, printToPdf, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const LOAI_GD_LABEL: Record<string, string> = {
  NHAP_MUA:        'Nhập mua',
  XUAT_SX:         'Xuất SX',
  NHAP_SX:         'Nhập SX',
  XUAT_BAN:        'Xuất bán',
  CHUYEN_KHO_XUAT: 'Chuyển kho (xuất)',
  CHUYEN_KHO_NHAP: 'Chuyển kho (nhập)',
  DIEU_CHINH_TANG: 'Điều chỉnh tăng',
  DIEU_CHINH_GIAM: 'Điều chỉnh giảm',
  XOA_NHAP_MUA:    '(Hủy nhập mua)',
  XOA_XUAT_SX:     '(Hủy xuất SX)',
  XOA_NHAP_SX:     '(Hủy nhập SX)',
  XOA_XUAT_BAN:    '(Hủy xuất bán)',
  XOA_CHUYEN_XUAT: '(Hủy chuyển xuất)',
  XOA_CHUYEN_NHAP: '(Hủy chuyển nhập)',
}

const NHAP_TYPES = new Set(['NHAP_MUA', 'NHAP_SX', 'CHUYEN_KHO_NHAP', 'DIEU_CHINH_TANG'])
const XUAT_TYPES = new Set(['XUAT_SX', 'XUAT_BAN', 'CHUYEN_KHO_XUAT', 'DIEU_CHINH_GIAM'])

function fmtQ(v: number) {
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function fmtVND(v: number) {
  return Number(v).toLocaleString('vi-VN')
}

export default function InventoryCardPage() {
  const today = dayjs()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.startOf('month'), today])
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [fetched, setFetched] = useState(false)

  const { data: whs } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: rows = [], isLoading, refetch } = useQuery<GiaoDich[]>({
    queryKey: ['giao-dich', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), warehouseId],
    queryFn: () =>
      warehouseApi.getGiaoDich({
        tu_ngay: range[0].format('YYYY-MM-DD'),
        den_ngay: range[1].format('YYYY-MM-DD'),
        warehouse_id: warehouseId,
        limit: 1000,
      }).then(r => r.data),
    enabled: fetched,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      r.ten_hang?.toLowerCase().includes(q) || r.ma_hang?.toLowerCase().includes(q),
    )
  }, [rows, search])

  const handleView = () => {
    setFetched(true)
    refetch()
  }

  const handleExcel = () => {
    exportToExcel(`the_kho_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}`, [{
      name: 'Thẻ kho',
      headers: ['Ngày', 'Mã hàng', 'Tên hàng', 'Kho', 'Loại GD', 'SL nhập', 'SL xuất', 'Tồn kho', 'Đơn giá', 'Giá trị', 'Ghi chú'],
      rows: filtered.map(r => [
        r.ngay_giao_dich ? dayjs(r.ngay_giao_dich).format('DD/MM/YYYY') : '',
        r.ma_hang,
        r.ten_hang,
        r.ten_kho,
        LOAI_GD_LABEL[r.loai_giao_dich] ?? r.loai_giao_dich,
        NHAP_TYPES.has(r.loai_giao_dich) ? r.so_luong : '',
        XUAT_TYPES.has(r.loai_giao_dich) ? r.so_luong : '',
        r.ton_sau_giao_dich,
        r.don_gia,
        r.gia_tri,
        r.ghi_chu ?? '',
      ]),
      colWidths: [12, 14, 28, 14, 18, 12, 12, 12, 14, 16, 20],
    }])
  }

  const handlePrint = () => {
    const body = buildHtmlTable(
      [
        { header: 'Ngày' }, { header: 'Mã hàng' }, { header: 'Tên hàng' }, { header: 'Kho' },
        { header: 'Loại GD' }, { header: 'Nhập' }, { header: 'Xuất' }, { header: 'Tồn kho' },
      ],
      filtered.map(r => [
        r.ngay_giao_dich ? dayjs(r.ngay_giao_dich).format('DD/MM/YYYY') : '',
        r.ma_hang,
        r.ten_hang,
        r.ten_kho,
        LOAI_GD_LABEL[r.loai_giao_dich] ?? r.loai_giao_dich,
        NHAP_TYPES.has(r.loai_giao_dich) ? fmtQ(r.so_luong) : '',
        XUAT_TYPES.has(r.loai_giao_dich) ? fmtQ(r.so_luong) : '',
        fmtQ(r.ton_sau_giao_dich),
      ]),
    )
    printToPdf(
      `Thẻ kho / Lịch sử XNT — ${range[0].format('DD/MM/YYYY')} đến ${range[1].format('DD/MM/YYYY')}`,
      body,
      false,
    )
  }

  const columns: ColumnsType<GiaoDich> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay_giao_dich',
      width: 100,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 120, ellipsis: true },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Kho', dataIndex: 'ten_kho', width: 120, ellipsis: true },
    {
      title: 'Loại GD',
      dataIndex: 'loai_giao_dich',
      width: 160,
      render: v => {
        const label = LOAI_GD_LABEL[v] ?? v
        const isHuy = v?.startsWith('XOA_')
        const isNhap = NHAP_TYPES.has(v)
        return <Tag color={isHuy ? 'default' : isNhap ? 'blue' : 'volcano'} style={{ fontSize: 11 }}>{label}</Tag>
      },
    },
    {
      title: 'SL nhập',
      width: 100,
      align: 'right',
      render: (_, r) => NHAP_TYPES.has(r.loai_giao_dich) ? (
        <Text style={{ color: '#1b168e' }}>{fmtQ(r.so_luong)}</Text>
      ) : '',
    },
    {
      title: 'SL xuất',
      width: 100,
      align: 'right',
      render: (_, r) => XUAT_TYPES.has(r.loai_giao_dich) ? (
        <Text type="danger">{fmtQ(r.so_luong)}</Text>
      ) : '',
    },
    {
      title: 'Tồn kho',
      dataIndex: 'ton_sau_giao_dich',
      width: 110,
      align: 'right',
      render: v => <Text strong>{fmtQ(v)}</Text>,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 120,
      align: 'right',
      render: v => Number(v) > 0 ? fmtVND(v) : '',
    },
    {
      title: 'Giá trị',
      dataIndex: 'gia_tri',
      width: 130,
      align: 'right',
      render: v => Number(v) > 0 ? fmtVND(v) : '',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: v => v ?? '',
    },
  ]

  const totalNhap = filtered.filter(r => NHAP_TYPES.has(r.loai_giao_dich)).reduce((s, r) => s + r.so_luong, 0)
  const totalXuat = filtered.filter(r => XUAT_TYPES.has(r.loai_giao_dich)).reduce((s, r) => s + r.so_luong, 0)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Thẻ kho / Lịch sử nhập xuất tồn</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!filtered.length}>Excel</Button>
          <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!filtered.length}>In PDF</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={range}
            onChange={v => v && setRange([v[0]!, v[1]!])}
          />
          <Select
            style={{ width: 200 }}
            placeholder="Tất cả kho"
            allowClear
            value={warehouseId}
            onChange={v => setWarehouseId(v)}
            options={(whs ?? []).map((w: Warehouse) => ({ value: w.id, label: `${w.ma_kho} — ${w.ten_kho}` }))}
          />
          <Input
            style={{ width: 220 }}
            placeholder="Tìm mã/tên hàng..."
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={isLoading} onClick={handleView}>
            Xem thẻ kho
          </Button>
        </Space>
      </Card>

      {fetched && (
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Tổng nhập kỳ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1b168e' }}>{fmtQ(totalNhap)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Tổng xuất kỳ</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#cf1322' }}>{fmtQ(totalXuat)}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>Số giao dịch</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{filtered.length}</div>
            </Card>
          </Col>
        </Row>
      )}

      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={filtered}
        loading={isLoading}
        pagination={{ pageSize: 50, showTotal: t => `${t} giao dịch` }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: fetched ? 'Không có giao dịch' : 'Chọn khoảng thời gian và nhấn Xem thẻ kho' }}
      />
    </div>
  )
}
