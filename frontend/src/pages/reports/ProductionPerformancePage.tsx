import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic,
  Table, Tag, Progress, Typography,
} from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, ProductionPerfRow } from '../../api/reports'
import { exportToExcel } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  moi: { label: 'Mới', color: 'blue' },
  dang_chay: { label: 'Đang chạy', color: 'orange' },
  hoan_thanh: { label: 'Hoàn thành', color: 'green' },
  huy: { label: 'Huỷ', color: 'red' },
}

export default function ProductionPerformancePage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))

  const { data, isLoading } = useQuery({
    queryKey: ['report-production-perf', tuNgay, denNgay],
    queryFn: () => reportsApi.getProductionPerformance({ tu_ngay: tuNgay, den_ngay: denNgay }),
    enabled: !!(tuNgay && denNgay),
  })

  const handleExcel = () => {
    if (!data) return
    exportToExcel(`NangSuatSX_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Năng suất SX',
      headers: ['Số lệnh', 'Ngày lệnh', 'Trạng thái', 'Khách hàng', 'Phân xưởng',
        'KH (Thùng)', 'Thực tế', 'Tỉ lệ (%)', 'Ngày KH xong', 'Ngày TT xong', 'Trễ (ngày)'],
      rows: data.rows.map(r => [
        r.so_lenh, r.ngay_lenh, r.trang_thai, r.ten_khach_hang ?? '',
        r.ten_phan_xuong ?? '', r.tong_ke_hoach, r.tong_hoan_thanh,
        r.ty_le_hoan_thanh, r.ngay_ke_hoach_xong ?? '', r.ngay_thuc_te_xong ?? '',
        r.tre_han ?? '',
      ]),
      colWidths: [16, 12, 14, 22, 16, 12, 12, 10, 14, 14, 12],
    }])
  }

  const columns: ColumnsType<ProductionPerfRow> = [
    { title: 'Số lệnh', dataIndex: 'so_lenh', width: 140,
      render: v => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày lệnh', dataIndex: 'ngay_lenh', width: 110 },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => { const s = STATUS_LABELS[v] || { label: v, color: 'default' }; return <Tag color={s.color}>{s.label}</Tag> } },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 160, render: v => v || '—' },
    { title: 'Phân xưởng', dataIndex: 'ten_phan_xuong', width: 130, render: v => v || '—' },
    { title: 'KH (Thùng)', dataIndex: 'tong_ke_hoach', width: 110, align: 'right',
      render: v => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) },
    { title: 'Thực tế', dataIndex: 'tong_hoan_thanh', width: 110, align: 'right',
      render: v => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</Text> },
    {
      title: 'Tỉ lệ', dataIndex: 'ty_le_hoan_thanh', width: 140,
      render: v => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={Math.min(v, 100)} size="small" style={{ flex: 1, marginBottom: 0 }}
            strokeColor={v >= 100 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f'} />
          <Text style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{v}%</Text>
        </div>
      ),
    },
    { title: 'KH xong', dataIndex: 'ngay_ke_hoach_xong', width: 110, render: v => v || '—' },
    { title: 'TT xong', dataIndex: 'ngay_thuc_te_xong', width: 110, render: v => v || '—' },
    { title: 'Trễ (ngày)', dataIndex: 'tre_han', width: 100, align: 'right',
      render: v => v != null
        ? <Text style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : '#666' }}>{v > 0 ? `+${v}` : v}</Text>
        : '—' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo năng suất sản xuất</Title>
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
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng lệnh" value={data?.summary.so_lenh ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Hoàn thành" value={data?.summary.hoan_thanh ?? 0}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Đang chạy" value={data?.summary.dang_chay ?? 0}
              valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="TB tỉ lệ HT" value={data?.summary.trung_binh_ty_le ?? 0}
              suffix="%" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<ProductionPerfRow>
          columns={columns}
          dataSource={data?.rows ?? []}
          rowKey="production_order_id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 30, showSizeChanger: true }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  )
}
