import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Typography,
} from 'antd'
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { reportsApi, InventoryMovementRow } from '../../api/reports'
import { warehousesApi, Warehouse } from '../../api/warehouses'
import { exportToExcel, printToPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function fmtQ(v: number) {
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

export default function InventoryReportPage() {
  const today = dayjs()
  const [tuNgay, setTuNgay] = useState(today.startOf('month').format('YYYY-MM-DD'))
  const [denNgay, setDenNgay] = useState(today.format('YYYY-MM-DD'))
  const [warehouseId, setWarehouseId] = useState<number | undefined>()

  const { data: whs } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-inventory', tuNgay, denNgay, warehouseId],
    queryFn: () => reportsApi.getInventoryMovement({ tu_ngay: tuNgay, den_ngay: denNgay, warehouse_id: warehouseId }),
    enabled: !!(tuNgay && denNgay),
  })

  const rows = data?.rows ?? []

  const handleExcel = () => {
    exportToExcel(`xnt-kho-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Xuất nhập tồn',
      headers: ['Kho', 'Hàng hóa', 'ĐVT', 'Tồn đầu kỳ', 'Nhập trong kỳ', 'Xuất trong kỳ', 'Tồn cuối kỳ', 'Giá trị tồn'],
      rows: rows.map(r => [r.ten_kho, r.ten_hang, r.don_vi, r.ton_dau_ky, r.nhap_trong_ky, r.xuat_trong_ky, r.ton_cuoi_ky, r.gia_tri_ton]),
    }])
  }

  const handlePrint = () => {
    const body = buildHtmlTable(
      [{ header: 'Kho' }, { header: 'Hàng hóa' }, { header: 'ĐVT' }, { header: 'Tồn đầu' }, { header: 'Nhập' }, { header: 'Xuất' }, { header: 'Tồn cuối' }],
      rows.map(r => [r.ten_kho, r.ten_hang, r.don_vi, fmtQ(r.ton_dau_ky), fmtQ(r.nhap_trong_ky), fmtQ(r.xuat_trong_ky), fmtQ(r.ton_cuoi_ky)]),
    )
    printToPdf(`Báo cáo XNT kho ${tuNgay} → ${denNgay}`, body)
  }

  const columns: ColumnsType<InventoryMovementRow> = [
    { title: 'Kho', dataIndex: 'ten_kho', width: 120, ellipsis: true },
    { title: 'Hàng hóa', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 60, align: 'center' },
    {
      title: 'Tồn đầu kỳ', dataIndex: 'ton_dau_ky', width: 110, align: 'right',
      render: v => fmtQ(v),
    },
    {
      title: 'Nhập trong kỳ', dataIndex: 'nhap_trong_ky', width: 120, align: 'right',
      render: v => <Text style={{ color: '#1b168e' }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Xuất trong kỳ', dataIndex: 'xuat_trong_ky', width: 120, align: 'right',
      render: v => <Text style={{ color: v > 0 ? '#cf1322' : undefined }}>{fmtQ(v)}</Text>,
    },
    {
      title: 'Tồn cuối kỳ', dataIndex: 'ton_cuoi_ky', width: 110, align: 'right',
      render: v => <Text strong>{fmtQ(v)}</Text>,
    },
    {
      title: 'Giá trị tồn', dataIndex: 'gia_tri_ton', width: 130, align: 'right',
      render: v => fmtVND(v),
    },
  ]

  const summary = data?.summary

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Báo cáo Xuất-Nhập-Tồn kho</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel} disabled={!rows.length}>Excel</Button>
          <Button icon={<FilePdfOutlined />} onClick={handlePrint} disabled={!rows.length}>In</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            value={[dayjs(tuNgay), dayjs(denNgay)]}
            onChange={v => {
              if (v?.[0] && v?.[1]) {
                setTuNgay(v[0].format('YYYY-MM-DD'))
                setDenNgay(v[1].format('YYYY-MM-DD'))
              }
            }}
          />
          <Select
            style={{ width: 200 }}
            placeholder="Tất cả kho"
            allowClear
            value={warehouseId}
            onChange={v => setWarehouseId(v)}
            options={(whs ?? []).map((w: Warehouse) => ({ value: w.id, label: w.ten_kho }))}
          />
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Tổng nhập trong kỳ" value={summary?.tong_nhap ?? 0} formatter={v => fmtQ(Number(v))} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Tổng xuất trong kỳ" value={summary?.tong_xuat ?? 0} formatter={v => fmtQ(Number(v))} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Giá trị tồn hiện tại" value={summary?.tong_gia_tri_ton ?? 0} formatter={v => fmtVND(Number(v))} valueStyle={{ color: '#1b168e' }} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey={(r, i) => `${r.warehouse_id}-${r.ten_hang}-${i}`}
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 30, showTotal: t => `${t} mặt hàng` }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Text strong>{fmtQ(rows.reduce((s, r) => s + r.ton_dau_ky, 0))}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <Text strong style={{ color: '#1b168e' }}>{fmtQ(rows.reduce((s, r) => s + r.nhap_trong_ky, 0))}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <Text strong style={{ color: '#cf1322' }}>{fmtQ(rows.reduce((s, r) => s + r.xuat_trong_ky, 0))}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              <Text strong>{fmtQ(rows.reduce((s, r) => s + r.ton_cuoi_ky, 0))}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              <Text strong>{fmtVND(rows.reduce((s, r) => s + r.gia_tri_ton, 0))}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </div>
  )
}
