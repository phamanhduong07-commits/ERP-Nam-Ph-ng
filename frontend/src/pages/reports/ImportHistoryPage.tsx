import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic,
  Table, Tag, Tooltip, Typography,
} from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { importLogsApi, ImportLogItem } from '../../api/reports'
import { exportToExcel } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const LOAI_OPTIONS = [
  { value: 'khach_hang', label: 'Khách hàng' },
  { value: 'nha_cung_cap', label: 'Nhà cung cấp' },
  { value: 'san_pham', label: 'Sản phẩm' },
  { value: 'vat_tu_giay', label: 'Vật tư giấy' },
  { value: 'vat_tu_khac', label: 'Vật tư khác' },
  { value: 'phieu_nhap_kho', label: 'Phiếu nhập kho' },
  { value: 'phieu_xuat_kho', label: 'Phiếu xuất kho' },
  { value: 'phieu_kiem_ke', label: 'Phiếu kiểm kê' },
  { value: 'bao_gia', label: 'Báo giá' },
  { value: 'don_hang', label: 'Đơn hàng' },
  { value: 'cong_no_dau_ky', label: 'Công nợ đầu kỳ' },
  { value: 'ton_kho_dau_ky', label: 'Tồn kho đầu kỳ' },
  { value: 'khac', label: 'Khác' },
]

const STATUS_CONFIG = {
  success: { label: 'Thành công', color: 'green' },
  partial: { label: 'Một phần', color: 'orange' },
  failed: { label: 'Thất bại', color: 'red' },
}

export default function ImportHistoryPage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))
  const [filterLoai, setFilterLoai] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const pageSize = 50

  const { data, isLoading } = useQuery({
    queryKey: ['import-logs', tuNgay, denNgay, filterLoai, page],
    queryFn: () => importLogsApi.list({
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      loai_du_lieu: filterLoai,
      page,
      page_size: pageSize,
    }),
  })

  const handleExcel = () => {
    if (!data) return
    exportToExcel(`LichSuImport_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Lịch sử import',
      headers: ['ID', 'Thời gian', 'Người import', 'Loại dữ liệu', 'File',
        'Thành công', 'Lỗi', 'Bỏ qua', 'Trạng thái', 'Chi tiết lỗi'],
      rows: data.items.map(r => [
        r.id,
        r.thoi_gian ? dayjs(r.thoi_gian).format('DD/MM/YYYY HH:mm') : '',
        r.ten_nguoi_import ?? '',
        LOAI_OPTIONS.find(o => o.value === r.loai_du_lieu)?.label ?? r.loai_du_lieu,
        r.ten_file ?? '',
        r.so_dong_thanh_cong,
        r.so_dong_loi,
        r.so_dong_bo_qua,
        STATUS_CONFIG[r.trang_thai]?.label ?? r.trang_thai,
        r.chi_tiet_loi ?? '',
      ]),
      colWidths: [6, 16, 18, 18, 28, 10, 8, 8, 12, 40],
    }])
  }

  const columns: ColumnsType<ImportLogItem> = [
    { title: 'Thời gian', dataIndex: 'thoi_gian', width: 150,
      render: v => v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—' },
    { title: 'Người import', dataIndex: 'ten_nguoi_import', width: 150,
      render: v => v || '—' },
    { title: 'Loại dữ liệu', dataIndex: 'loai_du_lieu', width: 160,
      render: v => LOAI_OPTIONS.find(o => o.value === v)?.label ?? v },
    { title: 'File', dataIndex: 'ten_file', ellipsis: true,
      render: v => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : '—' },
    { title: 'Thành công', dataIndex: 'so_dong_thanh_cong', width: 100, align: 'right',
      render: v => <Text style={{ color: '#52c41a', fontWeight: 600 }}>{v}</Text> },
    { title: 'Lỗi', dataIndex: 'so_dong_loi', width: 80, align: 'right',
      render: v => v > 0 ? <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>{v}</Text> : <Text type="secondary">0</Text> },
    { title: 'Bỏ qua', dataIndex: 'so_dong_bo_qua', width: 80, align: 'right',
      render: v => v > 0 ? <Text style={{ color: '#fa8c16' }}>{v}</Text> : <Text type="secondary">0</Text> },
    { title: 'Kết quả', dataIndex: 'trang_thai', width: 110,
      render: v => {
        const cfg = STATUS_CONFIG[v as keyof typeof STATUS_CONFIG] || { label: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      }
    },
    { title: 'Chi tiết lỗi', dataIndex: 'chi_tiet_loi', ellipsis: true, width: 200,
      render: v => v ? (
        <Tooltip title={v} overlayStyle={{ maxWidth: 400 }}>
          <Text style={{ fontSize: 11, color: '#ff4d4f', cursor: 'pointer' }}>{v}</Text>
        </Tooltip>
      ) : '—' },
  ]

  // Tính tổng thống kê từ trang hiện tại
  const totalSuccess = data?.items.reduce((s, r) => s + r.so_dong_thanh_cong, 0) ?? 0
  const totalErr = data?.items.reduce((s, r) => s + r.so_dong_loi, 0) ?? 0

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Lịch sử import dữ liệu</Title>
        <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!data?.items.length}
          style={{ color: '#217346', borderColor: '#217346' }}>Xuất Excel</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker format="DD/MM/YYYY"
            value={[dayjs(tuNgay), dayjs(denNgay)]}
            onChange={v => { if (v?.[0] && v?.[1]) { setTuNgay(v[0].format('YYYY-MM-DD')); setDenNgay(v[1].format('YYYY-MM-DD')); setPage(1) } }}
          />
          <Select placeholder="Tất cả loại dữ liệu" allowClear style={{ width: 200 }}
            value={filterLoai} onChange={v => { setFilterLoai(v); setPage(1) }}
            options={LOAI_OPTIONS}
          />
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small"><Statistic title="Số lần import" value={data?.total ?? 0} /></Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Tổng dòng thành công" value={totalSuccess}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Tổng dòng lỗi" value={totalErr}
              valueStyle={{ color: totalErr > 0 ? '#ff4d4f' : '#666' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<ImportLogItem>
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: t => `Tổng: ${t} bản ghi`,
          }}
          scroll={{ x: 1100 }}
          rowClassName={r => r.trang_thai === 'failed' ? 'ant-table-row-danger' : ''}
        />
      </Card>
    </div>
  )
}
