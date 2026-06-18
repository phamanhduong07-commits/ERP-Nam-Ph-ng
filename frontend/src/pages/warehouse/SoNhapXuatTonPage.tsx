import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Spin, Table, Typography, message,
} from 'antd'
import { FileExcelOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { warehouseApi, type SoNhapXuatTonRow } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

function fmtNum(v: number) {
  return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

export default function SoNhapXuatTonPage() {
  const today = dayjs()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.startOf('month'), today])
  const [warehouseId, setWarehouseId] = useState<number | undefined>()
  const [loaiNvl, setLoaiNvl] = useState<string>('all')
  const [enabled, setEnabled] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 300_000,
  })

  const params = {
    tu_ngay: range[0].format('YYYY-MM-DD'),
    den_ngay: range[1].format('YYYY-MM-DD'),
    warehouse_id: warehouseId,
    loai_nvl: loaiNvl,
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ['so-nhap-xuat-ton', params],
    queryFn: () => warehouseApi.getSoNhapXuatTon(params).then(r => r.data),
    enabled,
  })

  function handleSearch() {
    setEnabled(true)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await warehouseApi.exportSoNhapXuatTon(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `so_nhap_xuat_ton_${params.tu_ngay}_${params.den_ngay}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Không thể xuất Excel')
    } finally {
      setExporting(false)
    }
  }

  const totals = data.reduce(
    (acc, r) => ({
      ton_dau: acc.ton_dau + r.ton_dau,
      gia_tri_dau: acc.gia_tri_dau + r.gia_tri_dau,
      so_luong_nhap: acc.so_luong_nhap + r.so_luong_nhap,
      gia_tri_nhap: acc.gia_tri_nhap + r.gia_tri_nhap,
      so_luong_xuat: acc.so_luong_xuat + r.so_luong_xuat,
      gia_tri_xuat: acc.gia_tri_xuat + r.gia_tri_xuat,
      ton_cuoi: acc.ton_cuoi + r.ton_cuoi,
      gia_tri_cuoi: acc.gia_tri_cuoi + r.gia_tri_cuoi,
    }),
    { ton_dau: 0, gia_tri_dau: 0, so_luong_nhap: 0, gia_tri_nhap: 0, so_luong_xuat: 0, gia_tri_xuat: 0, ton_cuoi: 0, gia_tri_cuoi: 0 },
  )

  const columns: ColumnsType<SoNhapXuatTonRow> = [
    {
      title: 'Mã hàng',
      dataIndex: 'ma_hang',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'ĐVT',
      dataIndex: 'don_vi',
      width: 55,
      align: 'center' as const,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 110,
      align: 'right' as const,
      render: (v: number) => v ? fmtNum(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tồn đầu (kg)',
      dataIndex: 'ton_dau',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text>{fmtNum(v)}</Text>,
    },
    {
      title: 'GT đầu (đ)',
      dataIndex: 'gia_tri_dau',
      width: 120,
      align: 'right' as const,
      render: (v: number) => fmtNum(v),
    },
    {
      title: 'SL nhập',
      dataIndex: 'so_luong_nhap',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#389e0d' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'GT nhập (đ)',
      dataIndex: 'gia_tri_nhap',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#389e0d' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'SL xuất',
      dataIndex: 'so_luong_xuat',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#cf1322' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'GT xuất (đ)',
      dataIndex: 'gia_tri_xuat',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#cf1322' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'Tồn cuối (kg)',
      dataIndex: 'ton_cuoi',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'GT cuối (đ)',
      dataIndex: 'gia_tri_cuoi',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{fmtNum(v)}</Text>,
    },
    {
      title: 'Kho',
      dataIndex: 'warehouse_name',
      width: 150,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Sổ nhập xuất tồn nguyên vật liệu</Title>
        </Col>
        <Col>
          <Button
            icon={<FileExcelOutlined />}
            style={{ color: '#217346', borderColor: '#217346' }}
            loading={exporting}
            disabled={!data.length}
            onClick={handleExport}
          >
            Xuất Excel
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} sm={10}>
            <RangePicker
              style={{ width: '100%' }}
              value={range}
              onChange={v => v && setRange([v[0]!, v[1]!])}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={7}>
            <Select
              placeholder="Tất cả kho"
              style={{ width: '100%' }}
              allowClear
              value={warehouseId}
              onChange={setWarehouseId}
              options={(warehouses ?? []).filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={24} sm={5}>
            <Select
              style={{ width: '100%' }}
              value={loaiNvl}
              onChange={setLoaiNvl}
              options={[
                { value: 'all', label: 'Tất cả NVL' },
                { value: 'giay_cuon', label: 'Giấy cuộn' },
                { value: 'nvl_khac', label: 'NVL khác' },
              ]}
            />
          </Col>
          <Col xs={24} sm={2}>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} style={{ width: '100%' }}>
              Xem
            </Button>
          </Col>
        </Row>
      </Card>

      {isLoading ? (
        <Spin style={{ margin: 60, display: 'block', textAlign: 'center' }} />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table<SoNhapXuatTonRow>
            dataSource={data}
            columns={columns}
            rowKey={(r, i) => `${r.warehouse_id}-${r.paper_material_id ?? r.other_material_id ?? i}`}
            size="small"
            pagination={{ pageSize: 200, showSizeChanger: true, pageSizeOptions: ['100','200','500'], showTotal: t => `${t} dòng` }}
            scroll={{ x: 1400 }}
            locale={{ emptyText: enabled ? 'Không có dữ liệu trong kỳ này' : 'Chọn kỳ và bấm "Xem báo cáo"' }}
            summary={() => data.length > 0 ? (
              <Table.Summary.Row style={{ background: '#e6f4ff', fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={4} align="right">
                  <Text strong>Tổng cộng</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{fmtNum(totals.ton_dau)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{fmtNum(totals.gia_tri_dau)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text style={{ color: '#389e0d' }}>{fmtNum(totals.so_luong_nhap)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <Text style={{ color: '#389e0d' }}>{fmtNum(totals.gia_tri_nhap)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <Text style={{ color: '#cf1322' }}>{fmtNum(totals.so_luong_xuat)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <Text style={{ color: '#cf1322' }}>{fmtNum(totals.gia_tri_xuat)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right">
                  <Text strong style={{ color: '#1677ff' }}>{fmtNum(totals.ton_cuoi)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={11} align="right">
                  <Text strong style={{ color: '#1677ff' }}>{fmtNum(totals.gia_tri_cuoi)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={12} />
              </Table.Summary.Row>
            ) : null}
          />
        </Card>
      )}
    </div>
  )
}
