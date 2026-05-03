import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Col, DatePicker, Drawer, Row, Select, Space, Table, Tag, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { productionOrdersApi } from '../../api/productionOrders'
import type { PhieuNhapPhoiSongListItem, PhieuNhapPhoiSongItem } from '../../api/productionOrders'
import { warehousesApi } from '../../api/warehouses'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'

export default function PhieuNhapPhoiSongPage() {
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [filterWarehouseId, setFilterWarehouseId] = useState<number | undefined>()
  const [detail, setDetail] = useState<PhieuNhapPhoiSongListItem | null>(null)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['phieu-nhap-phoi-song-all', dateRange, filterWarehouseId],
    queryFn: () =>
      productionOrdersApi.listAllPhieu({
        tu_ngay: dateRange?.[0],
        den_ngay: dateRange?.[1],
        warehouse_id: filterWarehouseId,
      }).then(r => r.data),
    staleTime: 30_000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 120_000,
  })

  const phoiWhOptions = useMemo(
    () =>
      warehouses
        .filter(w => w.loai_kho === 'PHOI' && w.trang_thai)
        .map(w => ({ value: w.id, label: w.ten_kho })),
    [warehouses],
  )

  const totalTam = rows.reduce((s, r) => s + r.tong_so_tam, 0)
  const totalThung = rows.reduce((s, r) => s + r.tong_so_luong_thuc_te, 0)
  const totalLoi = rows.reduce((s, r) => s + r.tong_so_luong_loi, 0)

  const columns: ColumnsType<PhieuNhapPhoiSongListItem> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 95,
      render: fmtDate,
    },
    {
      title: 'Ca',
      dataIndex: 'ca',
      width: 65,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Giờ',
      width: 105,
      render: (_, r) =>
        r.gio_bat_dau || r.gio_ket_thuc
          ? <Text style={{ fontSize: 11 }}>{r.gio_bat_dau ?? '?'} – {r.gio_ket_thuc ?? '?'}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 150,
      render: (v: string | null) =>
        v ? <Text strong style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Kho',
      dataIndex: 'ten_kho',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Thùng nhập',
      dataIndex: 'tong_so_luong_thuc_te',
      width: 95,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Lỗi',
      dataIndex: 'tong_so_luong_loi',
      width: 70,
      align: 'right' as const,
      render: (v: number) =>
        v > 0
          ? <Text style={{ color: '#cf1322', fontSize: 12 }}>{fmtN(v)}</Text>
          : <Text type="secondary">0</Text>,
    },
    {
      title: 'Tấm nhập kho',
      dataIndex: 'tong_so_tam',
      width: 105,
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: '#389e0d' }}>{fmtN(v)}</Text>
      ),
    },
    {
      title: 'Người tạo',
      dataIndex: 'created_by_name',
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v ?? '',
    },
  ]

  const detailColumns: ColumnsType<PhieuNhapPhoiSongItem> = [
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null) =>
        <Text strong style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'KH (thùng)',
      dataIndex: 'so_luong_ke_hoach',
      width: 90,
      align: 'right' as const,
      render: (v: number) => <Text type="secondary">{fmtN(v)}</Text>,
    },
    {
      title: 'Thực tế',
      dataIndex: 'so_luong_thuc_te',
      width: 80,
      align: 'right' as const,
      render: (v: number | null) =>
        <Text strong style={{ color: '#1677ff' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Lỗi',
      dataIndex: 'so_luong_loi',
      width: 65,
      align: 'right' as const,
      render: (v: number | null) =>
        (v ?? 0) > 0
          ? <Text style={{ color: '#cf1322' }}>{fmtN(v)}</Text>
          : <Text type="secondary">0</Text>,
    },
    {
      title: 'Khổ',
      dataIndex: 'chieu_kho',
      width: 60,
      align: 'right' as const,
      render: (v: number | null) => v != null ? v : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt',
      dataIndex: 'chieu_cat',
      width: 60,
      align: 'right' as const,
      render: (v: number | null) => v != null ? v : <Text type="secondary">—</Text>,
    },
    {
      title: 'Số tấm',
      dataIndex: 'so_tam',
      width: 70,
      align: 'right' as const,
      render: (v: number | null) =>
        <Text strong style={{ color: '#389e0d' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v ?? '',
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Phiếu nhập phôi sóng</Title>
      </div>

      {/* Filters */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={10}>
          <RangePicker
            size="small"
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            onChange={v =>
              setDateRange(v ? [v[0]!.format('YYYY-MM-DD'), v[1]!.format('YYYY-MM-DD')] : null)
            }
          />
        </Col>
        <Col xs={24} sm={7}>
          <Select
            size="small"
            style={{ width: '100%' }}
            placeholder="Kho phôi"
            allowClear
            options={phoiWhOptions}
            value={filterWarehouseId}
            onChange={v => setFilterWarehouseId(v)}
          />
        </Col>
        <Col xs={24} sm={4}>
          <Button size="small" onClick={() => { setDateRange(null); setFilterWarehouseId(undefined) }}>
            Xoá lọc
          </Button>
        </Col>
      </Row>

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {rows.length} phiếu · Tổng{' '}
            <Text strong style={{ color: '#1677ff' }}>{fmtN(totalThung)} thùng</Text>
            {' '}· Lỗi{' '}
            <Text style={{ color: '#cf1322' }}>{fmtN(totalLoi)}</Text>
            {' '}· Nhập kho{' '}
            <Text strong style={{ color: '#389e0d' }}>{fmtN(totalTam)} tấm</Text>
          </Text>
        </Col>
      </Row>

      <Table<PhieuNhapPhoiSongListItem>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 50, showTotal: t => `${t} phiếu`, showSizeChanger: false }}
        scroll={{ x: 1200 }}
        onRow={row => ({
          onClick: () => setDetail(row),
          style: { cursor: 'pointer' },
        })}
        rowClassName={() => 'hoverable-row'}
      />

      {/* Drawer chi tiết */}
      <Drawer
        title={
          <Space>
            <Text strong>{detail?.so_phieu}</Text>
            {detail?.ca && <Tag color="blue">{detail.ca}</Tag>}
            <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(detail?.ngay)}</Text>
          </Space>
        }
        open={!!detail}
        onClose={() => setDetail(null)}
        width={680}
      >
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* Thông tin phiếu */}
            <Row gutter={16}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Lệnh SX</Text>
                <div><Text strong>{detail.so_lenh ?? '—'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Kho nhập</Text>
                <div><Text>{detail.ten_kho ?? '—'}</Text></div>
              </Col>
              <Col span={12} style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Giờ làm việc</Text>
                <div>
                  <Text>
                    {detail.gio_bat_dau && detail.gio_ket_thuc
                      ? `${detail.gio_bat_dau} – ${detail.gio_ket_thuc}`
                      : '—'}
                  </Text>
                </div>
              </Col>
              <Col span={12} style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Người tạo</Text>
                <div><Text>{detail.created_by_name ?? '—'}</Text></div>
              </Col>
              {detail.ghi_chu && (
                <Col span={24} style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Ghi chú</Text>
                  <div><Text>{detail.ghi_chu}</Text></div>
                </Col>
              )}
            </Row>

            {/* Tổng kết */}
            <Row gutter={16} style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 6 }}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Tổng thùng nhập</div>
                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{fmtN(detail.tong_so_luong_thuc_te)}</Text>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Phôi lỗi</div>
                <Text strong style={{ color: '#cf1322', fontSize: 16 }}>{fmtN(detail.tong_so_luong_loi)}</Text>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888' }}>Tấm nhập kho</div>
                <Text strong style={{ color: '#389e0d', fontSize: 16 }}>{fmtN(detail.tong_so_tam)}</Text>
              </Col>
            </Row>

            {/* Bảng chi tiết items */}
            <Table<PhieuNhapPhoiSongItem>
              rowKey="id"
              size="small"
              dataSource={detail.items}
              columns={detailColumns}
              pagination={false}
              scroll={{ x: 560 }}
              summary={() => detail.items.length > 1 ? (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong style={{ fontSize: 12 }}>Tổng</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text type="secondary">{fmtN(detail.items.reduce((s, i) => s + i.so_luong_ke_hoach, 0))}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong style={{ color: '#1677ff' }}>
                      {fmtN(detail.items.reduce((s, i) => s + (i.so_luong_thuc_te ?? 0), 0))}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text style={{ color: '#cf1322' }}>
                      {fmtN(detail.items.reduce((s, i) => s + (i.so_luong_loi ?? 0), 0))}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: '#389e0d' }}>
                      {fmtN(detail.items.reduce((s, i) => s + (i.so_tam ?? 0), 0))}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} />
                </Table.Summary.Row>
              ) : null}
            />
          </Space>
        )}
      </Drawer>
    </div>
  )
}
