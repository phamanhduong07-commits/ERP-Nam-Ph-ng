import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Statistic, Table, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, CarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, DeliveryReportRow } from '../../api/reports'
import { exportToExcel } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLORS: Record<string, string> = {
  cho_xuat: 'blue',
  dang_van_chuyen: 'orange',
  da_giao: 'green',
  huy: 'red',
}
const STATUS_LABELS: Record<string, string> = {
  cho_xuat: 'Chờ xuất',
  dang_van_chuyen: 'Đang VC',
  da_giao: 'Đã giao',
  huy: 'Huỷ',
}

export default function DeliveryReportPage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))

  const { data, isLoading } = useQuery({
    queryKey: ['report-delivery', tuNgay, denNgay],
    queryFn: () => reportsApi.getDeliveryReport({ tu_ngay: tuNgay, den_ngay: denNgay }),
    enabled: !!(tuNgay && denNgay),
  })

  const handleExcel = () => {
    if (!data) return
    exportToExcel(`VanChuyen_${dayjs().format('YYYYMMDD')}`, [
      {
        name: 'Chi tiết giao hàng',
        headers: ['Số phiếu', 'Ngày xuất', 'Số đơn', 'Khách hàng', 'Kho xuất',
          'Xe vận chuyển', 'Người nhận', 'Địa chỉ giao', 'Tổng SL', 'Trạng thái'],
        rows: data.rows.map(r => [
          r.so_phieu, r.ngay_xuat, r.so_don ?? '', r.ten_khach ?? '',
          r.ten_kho ?? '', r.xe_van_chuyen ?? '', r.nguoi_nhan ?? '',
          r.dia_chi_giao ?? '', r.tong_so_luong, STATUS_LABELS[r.trang_thai] || r.trang_thai,
        ]),
        colWidths: [16, 12, 16, 22, 14, 16, 18, 28, 10, 12],
      },
      {
        name: 'Tổng hợp theo xe',
        headers: ['Xe vận chuyển', 'Số chuyến', 'Tổng SL'],
        rows: data.by_xe.map(r => [r.xe, r.so_chuyen, r.tong_so_luong]),
        colWidths: [20, 14, 14],
      },
    ])
  }

  const columns: ColumnsType<DeliveryReportRow> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140,
      render: v => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 110 },
    { title: 'Đơn hàng', dataIndex: 'so_don', width: 130, render: v => v || '—' },
    { title: 'Khách hàng', dataIndex: 'ten_khach', ellipsis: true, render: v => v || '—' },
    { title: 'Kho xuất', dataIndex: 'ten_kho', width: 130, render: v => v || '—' },
    { title: 'Xe vận chuyển', dataIndex: 'xe_van_chuyen', width: 140,
      render: v => v ? <><CarOutlined style={{ marginRight: 4, color: '#fa8c16' }} />{v}</> : '—' },
    { title: 'Người nhận', dataIndex: 'nguoi_nhan', width: 130, render: v => v || '—' },
    { title: 'Địa chỉ giao', dataIndex: 'dia_chi_giao', ellipsis: true, render: v => v || '—' },
    { title: 'Tổng SL', dataIndex: 'tong_so_luong', width: 100, align: 'right',
      render: v => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</Text> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{STATUS_LABELS[v] || v}</Tag> },
  ]

  const byXeColumns = [
    { title: 'Xe vận chuyển', dataIndex: 'xe', key: 'xe' },
    { title: 'Số chuyến', dataIndex: 'so_chuyen', key: 'so_chuyen', align: 'center' as const,
      render: (v: number) => <Text strong>{v}</Text> },
    { title: 'Tổng số lượng', dataIndex: 'tong_so_luong', key: 'tong_so_luong', align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo vận chuyển giao hàng</Title>
        <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!data}
          style={{ color: '#217346', borderColor: '#217346' }}>Xuất Excel</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <RangePicker format="DD/MM/YYYY"
          value={[dayjs(tuNgay), dayjs(denNgay)]}
          onChange={v => { if (v?.[0] && v?.[1]) { setTuNgay(v[0].format('YYYY-MM-DD')); setDenNgay(v[1].format('YYYY-MM-DD')) } }}
        />
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small"><Statistic title="Tổng chuyến" value={data?.summary.tong_chuyen ?? 0} /></Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Đã giao xong" value={data?.summary.da_giao ?? 0}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Tổng SL xuất" value={data?.summary.tong_sl ?? 0}
              formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card size="small" title="Chi tiết phiếu giao hàng" styles={{ body: { padding: 0 } }}>
            <Table<DeliveryReportRow>
              columns={columns}
              dataSource={data?.rows ?? []}
              rowKey="delivery_id"
              loading={isLoading}
              size="small"
              pagination={{ pageSize: 20 }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" title="Tổng hợp theo xe">
            <Table
              columns={byXeColumns}
              dataSource={data?.by_xe ?? []}
              rowKey="xe"
              loading={isLoading}
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
