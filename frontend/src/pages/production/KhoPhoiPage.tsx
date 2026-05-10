import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Col, Drawer, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Spin,
  Statistic, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import { InboxOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { cd2Api } from '../../api/cd2'
import type { KhoRow } from '../../api/cd2'
import { TRANG_THAI_LABELS as CD2_LABELS } from '../../api/cd2'
import { warehousesApi } from '../../api/warehouses'
import type { Warehouse } from '../../api/warehouses'
import { warehouseApi } from '../../api/warehouse'
import type { TonKho, PhanXuong } from '../../api/warehouse'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtCurrency = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + ' đ' : '—'

export default function KhoPhoiPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [pushingKey, setPushingKey] = useState<string | null>(null)
  const [chuyenRows, setChuyenRows] = useState<KhoRow[]>([])
  const [chuyenQtys, setChuyenQtys] = useState<Record<number, number>>({})
  const [chuyenSrcId, setChuyenSrcId] = useState<number | null>(null)
  const [chuyenDstId, setChuyenDstId] = useState<number | null>(null)
  const [chuyenLoading, setChuyenLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [activeXuong, setActiveXuong] = useState<string>('all')

  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterPhapNhan, setFilterPhapNhan] = useState<string | null>(null)
  const [filterLoai, setFilterLoai] = useState<'co_in' | 'khong_in' | null>(null)
  const [filterTonKho, setFilterTonKho] = useState<'co_ton' | null>(null)

  // Drawer chi tiết kho
  const [detailWhId, setDetailWhId] = useState<number | null>(null)
  const { data: tonKhoDetail = [], isFetching: detailFetching } = useQuery<TonKho[]>({
    queryKey: ['ton-kho-detail', detailWhId],
    queryFn: () => warehouseApi.getTonKho({ warehouse_id: detailWhId! }).then(r => r.data),
    enabled: !!detailWhId,
    staleTime: 30_000,
  })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ton-kho-lsx'],
    queryFn: () => cd2Api.getTonKhoLsx().then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  })

  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 120_000,
  })

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const findPhoiKho = (phanXuongId: number | null) =>
    allWarehouses.find((w: Warehouse) => w.phan_xuong_id === phanXuongId && w.loai_kho === 'PHOI' && w.trang_thai)

  // Sub-tab items: Tất cả + từng xưởng
  const xuongTabItems = useMemo(() => {
    const allCount = (data ?? []).length
    const allTab = { key: 'all', label: `Tất cả (${allCount})` }
    const xuongTabs = phanXuongList.map(x => {
      const count = (data ?? []).filter(r => r.phan_xuong_id === x.id).length
      const label = x.ten_xuong.startsWith('Xưởng ') 
        ? x.ten_xuong.replace('Xưởng ', 'Kho phôi ') 
        : `Kho phôi ${x.ten_xuong}`
      return { key: String(x.id), label: `${label} (${count})` }
    })
    return [allTab, ...xuongTabs]
  }, [phanXuongList, data])

  const phapNhanOptions = useMemo(() => {
    const seen = new Set<string>()
    return (data ?? [])
      .filter(r => r.ten_phap_nhan_sx)
      .filter(r => { const k = r.ten_phap_nhan_sx!; if (seen.has(k)) return false; seen.add(k); return true })
      .map(r => ({ value: r.ten_phap_nhan_sx!, label: r.ten_phap_nhan_sx! }))
  }, [data])

  const filteredData = useMemo(() => {
    const q = filterSearch.toLowerCase()
    const xuongId = activeXuong !== 'all' ? Number(activeXuong) : null
    return (data ?? []).filter(r => {
      if (xuongId && r.phan_xuong_id !== xuongId) return false
      if (q && !r.so_lenh.toLowerCase().includes(q) && !(r.ten_khach_hang ?? '').toLowerCase().includes(q) && !(r.ten_hang ?? '').toLowerCase().includes(q)) return false
      if (filterPhapNhan && r.ten_phap_nhan_sx !== filterPhapNhan) return false
      if (filterLoai === 'co_in' && !r.co_in) return false
      if (filterLoai === 'khong_in' && r.co_in) return false
      if (filterTonKho === 'co_ton' && r.ton_kho <= 0) return false
      return true
    })
  }, [data, filterSearch, filterPhapNhan, activeXuong, filterLoai, filterTonKho])

  const handleDay = async (row: KhoRow, target: 'in' | 'sau_in') => {
    const key = `${row.production_order_id}-${target}`
    setPushingKey(key)
    try {
      await cd2Api.createFromLenhSx(row.production_order_id, target)
      message.success(`Đã đẩy ${row.so_lenh} sang ${target === 'in' ? 'Chờ in' : 'Chờ định hình'}`)
      qc.invalidateQueries({ queryKey: ['ton-kho-lsx'] })
      navigate('/production/cd2')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi đẩy sang CD2')
    } finally {
      setPushingKey(null)
    }
  }

  const openChuyenKho = (rows: KhoRow[]) => {
    if (!rows.length) return
    setChuyenRows(rows)
    setChuyenQtys(Object.fromEntries(rows.map(r => [r.production_order_id, r.ton_kho])))
    setChuyenSrcId(rows[0].warehouse_id)
    const defaultDst = findPhoiKho(rows[0].phan_xuong_id)
    setChuyenDstId(defaultDst?.id ?? null)
  }

  const handleChuyenKho = async () => {
    if (!chuyenRows.length || !chuyenSrcId || !chuyenDstId) {
      message.error('Vui lòng chọn kho nguồn và kho đích')
      return
    }
    if (chuyenSrcId === chuyenDstId) {
      message.error('Kho nguồn và kho đích không được trùng nhau')
      return
    }
    const dstWh = allWarehouses.find((w: Warehouse) => w.id === chuyenDstId)
    const totalQty = Object.values(chuyenQtys).reduce((s, v) => s + (v || 0), 0)
    setChuyenLoading(true)
    try {
      await warehouseApi.createPhieuChuyen({
        warehouse_xuat_id: chuyenSrcId,
        warehouse_nhap_id: chuyenDstId,
        ngay: dayjs().format('YYYY-MM-DD'),
        ghi_chu: `Chuyển phôi ${chuyenRows.map(r => r.so_lenh).join(', ')} → ${chuyenRows[0].ten_phan_xuong ?? ''}`,
        items: chuyenRows
          .filter(r => (chuyenQtys[r.production_order_id] ?? 0) > 0)
          .map(r => ({
            paper_material_id: null,
            other_material_id: null,
            production_order_id: r.production_order_id,
            ten_hang: r.ten_hang || 'Phôi sóng',
            don_vi: 'Tấm',
            so_luong: chuyenQtys[r.production_order_id],
            don_gia: 0,
          })),
      })
      message.success(`Đã chuyển ${fmtN(totalQty)} tấm (${chuyenRows.length} LSX) → ${dstWh?.ten_kho ?? 'kho đích'}`)
      setChuyenRows([])
      setSelectedRowKeys([])
      qc.invalidateQueries({ queryKey: ['ton-kho-lsx'] })
      qc.invalidateQueries({ queryKey: ['phieu-chuyen'] })
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu chuyển kho')
    } finally {
      setChuyenLoading(false)
    }
  }

  const showXuongCol = activeXuong === 'all'

  const columns: ColumnsType<KhoRow> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan_sx',
      width: 110,
      render: (v: string | null) => v
        ? <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nơi sản xuất',
      dataIndex: 'order_ten_phan_xuong',
      width: 120,
      render: (v: string | null) => v
        ? (
          <Space size={2} direction="vertical">
            <Text style={{ fontSize: 12 }}>{v}</Text>
          </Space>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Kho hiện tại',
      dataIndex: 'ten_phan_xuong',
      width: 140,
      render: (v: string | null, row: KhoRow) => v
        ? (
          <Space size={4} wrap={false} align="center">
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{v}</Text>
            {row.cong_doan === 'cd2' && (
              <Tag color="orange" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>CD2</Tag>
            )}
          </Space>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 120,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'co_in',
      width: 80,
      align: 'center' as const,
      render: (v: boolean) => v
        ? <Tag color="blue" style={{ fontSize: 11 }}>Có in</Tag>
        : <Tag color="purple" style={{ fontSize: 11 }}>Không in</Tag>,
    },
    {
      title: 'Khổ',
      dataIndex: 'chieu_kho',
      width: 70,
      align: 'right' as const,
      render: (v: number | null) => v != null ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt',
      dataIndex: 'chieu_cat',
      width: 70,
      align: 'right' as const,
      render: (v: number | null) => v != null ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhập (tấm)',
      dataIndex: 'tong_nhap',
      width: 95,
      align: 'right' as const,
      render: (v: number) => fmtN(v),
    },
    {
      title: 'Xuất (tấm)',
      dataIndex: 'tong_xuat',
      width: 85,
      align: 'right' as const,
      render: (v: number) => v > 0 ? fmtN(v) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tồn (tấm)',
      dataIndex: 'ton_kho',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322' }}>
          {fmtN(v)}
        </Text>
      ),
    },
    {
      title: 'Phiếu in hiện tại',
      dataIndex: 'phieu_in_hien_tai',
      width: 150,
      render: (v: KhoRow['phieu_in_hien_tai']) => v
        ? (
          <Space direction="vertical" size={0}>
            <Text code style={{ fontSize: 11 }}>{v.so_phieu}</Text>
            <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>
              {CD2_LABELS[v.trang_thai] ?? v.trang_thai}
            </Tag>
          </Space>
        )
        : <Text type="secondary" style={{ fontSize: 11 }}>Chưa có</Text>,
    },
    {
      title: 'Thao tác',
      width: 260,
      render: (_, row: KhoRow) => {
        const isCD2 = row.cong_doan === 'cd2'
        const targetKho = isCD2 ? findPhoiKho(row.phan_xuong_id) : null
        const sourceKho = allWarehouses.find((w: Warehouse) => w.id === row.warehouse_id)
        const daChuyen = (row.tong_chuyen_phoi ?? 0) > 0
        const conTon = row.ton_kho > 0
        // Phôi đã chuyển sang kho CD2 → vẫn có thể đẩy vào queue
        const conPhoiTaiCD2 = isCD2 && daChuyen

        if (row.phieu_in_hien_tai) {
          return (
            <Space size={4} wrap>
              <Tag color="cyan" style={{ fontSize: 11 }}>Đã đẩy sang CD2</Tag>
              {isCD2 && conTon && (
                <Button size="small" icon={<SwapOutlined />} onClick={() => openChuyenKho([row])} style={{ fontSize: 11 }}>
                  Chuyển kho
                </Button>
              )}
            </Space>
          )
        }
        // Hết tồn kho gốc VÀ chưa chuyển sang CD2 → kết thúc
        if (!conTon && !conPhoiTaiCD2) {
          return <Text type="secondary" style={{ fontSize: 11 }}>Hết tồn kho</Text>
        }
        return (
          <Space size={4} wrap>
            {isCD2 && conTon && (
              <Tooltip
                title={sourceKho && targetKho
                  ? `${sourceKho.ten_kho} → ${targetKho.ten_kho}`
                  : targetKho ? '' : `Xưởng ${row.ten_phan_xuong} chưa có kho PHOI`}
              >
                <Button
                  size="small"
                  icon={<SwapOutlined />}
                  type={daChuyen ? 'default' : 'dashed'}
                  onClick={() => openChuyenKho([row])}
                  disabled={!row.warehouse_id}
                  style={daChuyen
                    ? { borderColor: '#52c41a', color: '#52c41a', fontSize: 11 }
                    : { borderColor: '#fa8c16', color: '#fa8c16', fontSize: 11 }}
                >
                  {daChuyen ? 'Chuyển thêm' : 'Chuyển kho'}
                </Button>
              </Tooltip>
            )}
            <Popconfirm
              title={`Đẩy ${row.so_lenh} → Chờ in?`}
              description={`${fmtN(row.ton_kho)} phôi sẽ được chuyển sang in`}
              onConfirm={() => handleDay(row, 'in')}
              okText="Đẩy" cancelText="Huỷ"
            >
              <Button
                size="small"
                type={row.co_in ? 'primary' : 'default'}
                icon={<SendOutlined />}
                loading={pushingKey === `${row.production_order_id}-in`}
              >
                Chờ in
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Đẩy ${row.so_lenh} → Chờ định hình?`}
              description={`${fmtN(row.ton_kho)} phôi sẽ bỏ qua in, sang định hình`}
              onConfirm={() => handleDay(row, 'sau_in')}
              okText="Đẩy" cancelText="Huỷ"
            >
              <Button
                size="small"
                type={!row.co_in ? 'primary' : 'default'}
                loading={pushingKey === `${row.production_order_id}-sau_in`}
                style={!row.co_in ? { background: '#722ed1', borderColor: '#722ed1' } : {}}
              >
                Định hình
              </Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const phoiWarehouseOptions = allWarehouses
    .filter((w: Warehouse) => w.loai_kho === 'PHOI' && w.trang_thai)
    .map((w: Warehouse) => ({ value: w.id, label: `${w.ten_kho} (${w.ma_kho})` }))

  const detailWh = detailWhId ? allWarehouses.find((w: Warehouse) => w.id === detailWhId) : null
  const totalGiaTri = tonKhoDetail.reduce((s, r) => s + (r.gia_tri_ton ?? 0), 0)
  const totalTonLuong = tonKhoDetail.reduce((s, r) => s + (r.ton_luong ?? 0), 0)

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <InboxOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Kho Phôi Sóng</Title>
          </Space>
        </Col>
        <Col>
          <Button size="small" onClick={() => refetch()}>Làm mới</Button>
        </Col>
      </Row>

      {/* Sub-tab xưởng */}
      <Tabs
        size="small"
        activeKey={activeXuong}
        onChange={key => { setActiveXuong(key); setSelectedRowKeys([]) }}
        items={xuongTabItems}
        style={{ marginBottom: 4 }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {isError && (
          <Alert
            type="error"
            showIcon
            message="Không tải được dữ liệu kho phôi sóng"
            description={error instanceof Error ? error.message : 'Vui lòng bấm Làm mới hoặc đăng nhập lại.'}
          />
        )}

        {/* Filter bar */}
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} sm={8}>
            <Input.Search
              size="small"
              placeholder="Tìm LSX / khách hàng / tên hàng..."
              allowClear
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select size="small" style={{ width: '100%' }} placeholder="Pháp nhân" allowClear
              value={filterPhapNhan}
              onChange={v => setFilterPhapNhan(v ?? null)}
              options={phapNhanOptions}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select size="small" style={{ width: '100%' }} placeholder="Loại" allowClear
              value={filterLoai}
              onChange={v => setFilterLoai(v ?? null)}
              options={[
                { value: 'co_in', label: 'Có in' },
                { value: 'khong_in', label: 'Không in' },
              ]}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select size="small" style={{ width: '100%' }} placeholder="Tồn kho" allowClear
              value={filterTonKho}
              onChange={v => setFilterTonKho(v ?? null)}
              options={[{ value: 'co_ton', label: 'Còn tồn' }]}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Button size="small" style={{ width: '100%' }} onClick={() => {
              setFilterSearch(''); setFilterPhapNhan(null)
              setFilterLoai(null); setFilterTonKho(null)
            }}>Xoá lọc</Button>
          </Col>
        </Row>

        <Row justify="space-between" align="middle">
          <Col>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredData.length} lệnh SX
              </Text>
              {selectedRowKeys.length > 0 && (
                <Button
                  size="small"
                  type="primary"
                  icon={<SwapOutlined />}
                  style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                  onClick={() => {
                    const rows = (data ?? []).filter(r =>
                      selectedRowKeys.includes(r.production_order_id) && r.cong_doan === 'cd2' && r.ton_kho > 0
                    )
                    if (!rows.length) { message.warning('Không có LSX nào hợp lệ để chuyển kho'); return }
                    openChuyenKho(rows)
                  }}
                >
                  Chuyển kho ({selectedRowKeys.length} LSX)
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        <Table<KhoRow>
          rowKey="production_order_id"
          size="small"
          loading={isLoading}
          dataSource={filteredData}
          columns={columns}
          pagination={{ pageSize: 50, showTotal: (t, r) => `${t} lệnh SX${r[0] !== 1 || r[1] !== (data ?? []).length ? ` (lọc từ ${(data ?? []).length})` : ''}`, showSizeChanger: false }}
          scroll={{ x: 1100 }}
          rowClassName={(row) => row.ton_kho <= 0 ? 'ant-table-row-disabled' : ''}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (row: KhoRow) => ({
              disabled: row.cong_doan !== 'cd2' || row.ton_kho <= 0,
            }),
          }}
          onRow={(row) => ({
            onClick: () => {
              // Nếu là CD2 và đã có phôi chuyển đến → show kho CD2
              // Ngược lại → show kho nguồn (CD1) nơi phôi đang chờ chuyển
              const daChuyen = (row.tong_chuyen_phoi ?? 0) > 0
              const whId = (row.cong_doan === 'cd2' && daChuyen)
                ? (findPhoiKho(row.phan_xuong_id)?.id ?? row.warehouse_id)
                : row.warehouse_id
              if (whId) setDetailWhId(whId)
            },
            style: { cursor: 'pointer' },
          })}
        />

        {/* Modal chuyển kho phôi sang xưởng CD2 */}
        <Modal
          open={chuyenRows.length > 0}
          onCancel={() => { setChuyenRows([]); setSelectedRowKeys([]) }}
          onOk={handleChuyenKho}
          okText="Tạo phiếu chuyển kho"
          cancelText="Huỷ"
          confirmLoading={chuyenLoading}
          title={
            <Space>
              <SwapOutlined style={{ color: '#fa8c16' }} />
              <span>Chuyển kho phôi — {chuyenRows.length} lệnh SX</span>
            </Space>
          }
          width={600}
        >
          {chuyenRows.length > 0 && (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Row gutter={8} align="middle">
                <Col span={11}>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Kho nguồn (xuất)</div>
                  <Select
                    style={{ width: '100%' }}
                    options={phoiWarehouseOptions}
                    value={chuyenSrcId}
                    onChange={setChuyenSrcId}
                    placeholder="Chọn kho nguồn"
                    status={!chuyenSrcId ? 'error' : undefined}
                  />
                </Col>
                <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                  <SwapOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
                </Col>
                <Col span={11}>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Kho đích (nhập)</div>
                  <Select
                    style={{ width: '100%' }}
                    options={phoiWarehouseOptions}
                    value={chuyenDstId}
                    onChange={setChuyenDstId}
                    placeholder="Chọn kho đích"
                    status={!chuyenDstId ? 'error' : undefined}
                  />
                </Col>
              </Row>

              <Table<KhoRow>
                size="small"
                dataSource={chuyenRows}
                rowKey="production_order_id"
                pagination={false}
                columns={[
                  {
                    title: 'Lệnh SX',
                    dataIndex: 'so_lenh',
                    width: 130,
                    render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
                  },
                  {
                    title: 'Tên hàng',
                    dataIndex: 'ten_hang',
                    ellipsis: true,
                    render: (v: string | null) => v || 'Phôi sóng',
                  },
                  {
                    title: 'Tồn (tấm)',
                    dataIndex: 'ton_kho',
                    width: 80,
                    align: 'right' as const,
                    render: (v: number) => <Text type="secondary" style={{ fontSize: 11 }}>{fmtN(v)}</Text>,
                  },
                  {
                    title: 'SL chuyển (tấm)',
                    width: 150,
                    render: (_: unknown, row: KhoRow) => (
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        min={1}
                        max={row.ton_kho}
                        value={chuyenQtys[row.production_order_id] ?? row.ton_kho}
                        onChange={v => setChuyenQtys(prev => ({
                          ...prev,
                          [row.production_order_id]: v ?? row.ton_kho,
                        }))}
                      />
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong style={{ fontSize: 12 }}>Tổng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ fontSize: 12 }}>
                        {fmtN(chuyenRows.reduce((s, r) => s + r.ton_kho, 0))}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text strong style={{ color: '#fa8c16', fontSize: 12 }}>
                        {fmtN(Object.values(chuyenQtys).reduce((s, v) => s + (v || 0), 0))} tấm
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Space>
          )}
        </Modal>

        {/* Drawer chi tiết kho */}
        <Drawer
          title={
            <Space>
              <span>{detailWh?.ten_kho ?? 'Chi tiết kho'}</span>
              {detailWh?.ma_kho && <Tag color="blue">{detailWh.ma_kho}</Tag>}
            </Space>
          }
          open={!!detailWhId}
          onClose={() => setDetailWhId(null)}
          width={560}
        >
          {detailFetching ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Tổng giá trị tồn"
                    value={totalGiaTri}
                    formatter={v => fmtN(Number(v)) + ' đ'}
                    valueStyle={{ color: '#1677ff', fontSize: 18 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tổng tồn kho"
                    value={totalTonLuong}
                    formatter={v => fmtN(Number(v)) + ' tấm'}
                    valueStyle={{ color: '#389e0d', fontSize: 18 }}
                  />
                </Col>
              </Row>

              <Table<TonKho>
                rowKey="id"
                size="small"
                dataSource={tonKhoDetail}
                pagination={false}
                scroll={{ x: 480 }}
                columns={[
                  {
                    title: 'Tên hàng',
                    dataIndex: 'ten_hang',
                    ellipsis: true,
                    render: (v: string) => <Text strong style={{ fontSize: 12 }}>{v}</Text>,
                  },
                  {
                    title: 'Tồn',
                    dataIndex: 'ton_luong',
                    width: 80,
                    align: 'right' as const,
                    render: (v: number, r: TonKho) => (
                      <Space direction="vertical" size={0} style={{ lineHeight: 1.3 }}>
                        <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontSize: 12 }}>{fmtN(v)}</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>{r.don_vi}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: 'Đơn giá BQ',
                    dataIndex: 'don_gia_binh_quan',
                    width: 110,
                    align: 'right' as const,
                    render: (v: number) => v > 0
                      ? <Text style={{ fontSize: 12 }}>{fmtCurrency(v)}</Text>
                      : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Giá trị tồn',
                    dataIndex: 'gia_tri_ton',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => (
                      <Text strong style={{ color: v > 0 ? '#1677ff' : '#aaa', fontSize: 12 }}>
                        {v > 0 ? fmtCurrency(v) : '—'}
                      </Text>
                    ),
                  },
                ]}
                summary={() => tonKhoDetail.length > 0 ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#389e0d', fontSize: 12 }}>{fmtN(totalTonLuong)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ color: '#1677ff', fontSize: 12 }}>{fmtCurrency(totalGiaTri)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null}
              />

              {tonKhoDetail.length === 0 && !detailFetching && (
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '24px 0' }}>
                  Kho này chưa có hàng tồn kho
                </Text>
              )}
            </Space>
          )}
        </Drawer>
      </Space>
    </div>
  )
}
