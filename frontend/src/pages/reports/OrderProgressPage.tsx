import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic,
  Table, Tag, Progress, Typography,
} from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, OrderProgressRow } from '../../api/reports'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  moi: { label: 'Mới', color: 'blue' },
  dang_sx: { label: 'Đang SX', color: 'orange' },
  da_giao: { label: 'Đã giao', color: 'green' },
  huy: { label: 'Huỷ', color: 'red' },
}

export default function OrderProgressPage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))
  const [filterTT, setFilterTT] = useState<string | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['report-order-progress', tuNgay, denNgay, filterTT],
    queryFn: () => reportsApi.getOrderProgress({
      tu_ngay: tuNgay, den_ngay: denNgay,
      trang_thai: filterTT,
    }),
    enabled: !!(tuNgay && denNgay),
  })

  const handleExcel = () => {
    if (!data) return
    exportToExcel(`TienDoDonHang_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Tiến độ đơn hàng',
      headers: ['Số đơn', 'Ngày đặt', 'Ngày giao DK', 'Trạng thái', 'Khách hàng',
        'SL đặt', 'SL đã giao', 'Còn lại', 'Tỉ lệ (%)', 'Tổng tiền'],
      rows: data.rows.map(r => [
        r.so_don, r.ngay_don, r.ngay_giao_du_kien ?? '',
        r.trang_thai, r.ten_khach_hang ?? '',
        r.so_luong_dat, r.so_luong_da_giao, r.so_luong_con_lai,
        r.ty_le_giao, r.tong_tien,
      ]),
      colWidths: [16, 12, 14, 14, 22, 10, 12, 10, 10, 16],
    }])
  }

  const columns: ColumnsType<OrderProgressRow> = [
    { title: 'Số đơn', dataIndex: 'so_don', width: 140,
      render: v => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày đặt', dataIndex: 'ngay_don', width: 110 },
    { title: 'Ngày giao DK', dataIndex: 'ngay_giao_du_kien', width: 120, render: v => v || '—' },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = STATUS_LABELS[v] || { label: v, color: 'default' }; return <Tag color={s.color}>{s.label}</Tag> } },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true, render: v => v || '—' },
    { title: 'SL đặt', dataIndex: 'so_luong_dat', width: 100, align: 'right',
      render: v => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) },
    { title: 'Đã giao', dataIndex: 'so_luong_da_giao', width: 100, align: 'right',
      render: v => <Text strong style={{ color: '#52c41a' }}>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</Text> },
    { title: 'Còn lại', dataIndex: 'so_luong_con_lai', width: 100, align: 'right',
      render: v => v > 0 ? <Text style={{ color: '#fa8c16' }}>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</Text> : <Text type="secondary">0</Text> },
    {
      title: 'Tiến độ', dataIndex: 'ty_le_giao', width: 160,
      render: v => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={Math.min(v, 100)} size="small" style={{ flex: 1, marginBottom: 0 }}
            strokeColor={v >= 100 ? '#52c41a' : v >= 50 ? '#faad14' : '#ff4d4f'} />
          <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{v}%</Text>
        </div>
      ),
    },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 130, align: 'right',
      render: v => <Text strong>{fmtVND(v)} đ</Text> },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo tiến độ đơn hàng</Title>
        <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!data}
          style={{ color: '#217346', borderColor: '#217346' }}>Xuất Excel</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker format="DD/MM/YYYY"
            value={[dayjs(tuNgay), dayjs(denNgay)]}
            onChange={v => { if (v?.[0] && v?.[1]) { setTuNgay(v[0].format('YYYY-MM-DD')); setDenNgay(v[1].format('YYYY-MM-DD')) } }}
          />
          <Select placeholder="Tất cả trạng thái" allowClear style={{ width: 160 }}
            value={filterTT} onChange={setFilterTT}
            options={Object.entries(STATUS_LABELS).map(([v, s]) => ({ value: v, label: s.label }))}
          />
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Tổng đơn" value={data?.summary.so_don ?? 0} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Giao xong 100%" value={data?.summary.da_giao_xong ?? 0}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Chưa giao lần nào" value={data?.summary.chua_giao ?? 0}
              valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng giá trị" value={data?.summary.tong_tien ?? 0}
              formatter={v => fmtVND(Number(v))} suffix=" đ" valueStyle={{ color: '#1b168e' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<OrderProgressRow>
          columns={columns}
          dataSource={data?.rows ?? []}
          rowKey="sales_order_id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 30, showSizeChanger: true }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}
