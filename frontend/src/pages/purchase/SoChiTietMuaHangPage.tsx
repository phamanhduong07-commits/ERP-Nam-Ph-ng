import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Divider,
  Input, Modal, Pagination, Row, Select, Space, Spin,
  Statistic, Table, Tag, Typography,
} from 'antd'
import {
  FileExcelOutlined, FilterOutlined, PrinterOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import { phapNhanApi } from '../../api/phap_nhan'
import { exportToExcel } from '../../utils/exportUtils'
import EmptyState from '../../components/EmptyState'

const { Text, Title } = Typography

// ─── Types ───────────────────────────────────────────────────────────────────

interface Params {
  tu_ngay: dayjs.Dayjs
  den_ngay: dayjs.Dayjs
  phap_nhan_id?: number
  nhom_vthh_id?: number
  phan_loai_ncc?: string
  nhan_vien_id?: number
  supplier_ids: number[]
  paper_material_ids: number[]
}

interface ReportRow {
  id: number
  ngay_hach_toan: string
  ngay_chung_tu: string
  so_chung_tu: string | null
  so_hoa_don: string | null
  ten_ncc: string
  tong_tien_hang: number
  tien_thue: number
  tong_thanh_toan: number
  da_thanh_toan: number
  con_lai: number
  trang_thai: string
  ghi_chu: string | null
}

interface ReportResponse {
  total: number
  page: number
  page_size: number
  rows: ReportRow[]
  totals: {
    tong_tien_hang: number
    tong_thue: number
    tong_thanh_toan: number
    da_thanh_toan: number
    con_lai: number
  }
}

interface MaterialItem {
  id: number
  ma_chinh: string
  ten: string
  dvt: string
}

interface SupplierItem {
  id: number
  ma_ncc: string
  ten_viet_tat: string
  ten_don_vi: string | null
  dia_chi?: string | null
  ma_so_thue?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v) + 'đ'

const TRANG_THAI_LABELS: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Chưa TT', color: 'default' },
  da_tt_mot_phan: { label: 'TT một phần', color: 'orange' },
  da_tt_du: { label: 'Đã TT đủ', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
}

const PERIOD_PRESETS = [
  { label: 'Tháng này', value: 'thang_nay' },
  { label: 'Tháng trước', value: 'thang_truoc' },
  { label: 'Quý này', value: 'quy_nay' },
  { label: 'Năm nay', value: 'nam_nay' },
  { label: 'Tùy chọn', value: 'tuy_chon' },
]

function applyPreset(preset: string): [dayjs.Dayjs, dayjs.Dayjs] {
  const today = dayjs()
  switch (preset) {
    case 'thang_nay': return [today.startOf('month'), today.endOf('month')]
    case 'thang_truoc': return [today.subtract(1, 'month').startOf('month'), today.subtract(1, 'month').endOf('month')]
    case 'quy_nay': {
      const qMonth = Math.floor(today.month() / 3) * 3
      return [today.month(qMonth).startOf('month'), today.month(qMonth + 2).endOf('month')]
    }
    case 'nam_nay': return [today.startOf('year'), today.endOf('year')]
    default: return [today.startOf('month'), today]
  }
}

const defaultParams = (): Params => ({
  tu_ngay: dayjs().startOf('month'),
  den_ngay: dayjs(),
  supplier_ids: [],
  paper_material_ids: [],
})

// ─── Supplier selection table ─────────────────────────────────────────────────

function SupplierTable({
  selected,
  onSelect,
}: {
  selected: number[]
  onSelect: (ids: number[]) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8

  const { data, isFetching } = useQuery({
    queryKey: ['soctmh-suppliers', search, page],
    queryFn: () =>
      client.get<{ items: SupplierItem[]; total: number }>('/suppliers', {
        params: { search, page, page_size: PAGE_SIZE },
      }).then(r => r.data),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggle = (id: number) => {
    if (selected.includes(id)) onSelect(selected.filter(s => s !== id))
    else onSelect([...selected, id])
  }

  const selectAll = () => {
    const ids = items.map(s => s.id)
    const allIn = ids.every(id => selected.includes(id))
    if (allIn) onSelect(selected.filter(id => !ids.includes(id)))
    else onSelect([...new Set([...selected, ...ids])])
  }

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 8 }} align="middle">
        <Col flex="auto">
          <Input.Search
            size="small"
            placeholder="Tìm mã, tên NCC, MST..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
        </Col>
        <Col>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selected.length > 0 ? `Đã chọn: ${selected.length}` : `${total} NCC`}
          </Text>
        </Col>
      </Row>
      <Table<SupplierItem>
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={items}
        pagination={false}
        scroll={{ y: 200 }}
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: keys => onSelect(keys as number[]),
          columnWidth: 36,
        }}
        columns={[
          {
            title: <Checkbox
              indeterminate={items.some(i => selected.includes(i.id)) && !items.every(i => selected.includes(i.id))}
              checked={items.length > 0 && items.every(i => selected.includes(i.id))}
              onChange={selectAll}
            />,
            dataIndex: 'select',
            width: 36,
            render: (_v, rec) => (
              <Checkbox checked={selected.includes(rec.id)} onChange={() => toggle(rec.id)} />
            ),
          },
          { title: 'Mã NCC', dataIndex: 'ma_ncc', width: 80, ellipsis: true },
          { title: 'Tên NCC', dataIndex: 'ten_viet_tat', ellipsis: true },
          { title: 'MST', dataIndex: 'ma_so_thue', width: 120, ellipsis: true, render: v => v || '—' },
        ]}
      />
      <Pagination
        size="small"
        current={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
        showTotal={t => `${t} NCC`}
        style={{ marginTop: 6, textAlign: 'right' }}
      />
    </div>
  )
}

// ─── Material selection table ─────────────────────────────────────────────────

function MaterialTable({
  selected,
  onSelect,
}: {
  selected: number[]
  onSelect: (ids: number[]) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8

  const { data, isFetching } = useQuery({
    queryKey: ['soctmh-materials', search, page],
    queryFn: () =>
      client.get<{ items: MaterialItem[]; total: number }>('/paper-materials', {
        params: { search, page, page_size: PAGE_SIZE },
      }).then(r => r.data),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggle = (id: number) => {
    if (selected.includes(id)) onSelect(selected.filter(s => s !== id))
    else onSelect([...selected, id])
  }

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 8 }} align="middle">
        <Col flex="auto">
          <Input.Search
            size="small"
            placeholder="Tìm mã hàng, tên..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
        </Col>
        <Col>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selected.length > 0 ? `Đã chọn: ${selected.length}` : `${total} mặt hàng`}
          </Text>
        </Col>
      </Row>
      <Table<MaterialItem>
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={items}
        pagination={false}
        scroll={{ y: 200 }}
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: keys => onSelect(keys as number[]),
          columnWidth: 36,
        }}
        columns={[
          { title: 'Mã hàng', dataIndex: 'ma_chinh', width: 100, ellipsis: true },
          { title: 'Tên hàng', dataIndex: 'ten', ellipsis: true },
          { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        ]}
      />
      <Pagination
        size="small"
        current={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
        showTotal={t => `${t} mặt hàng`}
        style={{ marginTop: 6, textAlign: 'right' }}
      />
    </div>
  )
}

// ─── Parameter modal ──────────────────────────────────────────────────────────

function ParamModal({
  open,
  initialParams,
  onApply,
  onClose,
}: {
  open: boolean
  initialParams: Params
  onApply: (p: Params) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Params>(initialParams)
  const [period, setPeriod] = useState('thang_nay')

  const handleOpen = useCallback(() => {
    setDraft(initialParams)
    // detect current period
    const tu = initialParams.tu_ngay
    const den = initialParams.den_ngay
    const today = dayjs()
    if (tu.isSame(today.startOf('month'), 'day') && den.isSame(today.endOf('month'), 'day'))
      setPeriod('thang_nay')
    else if (tu.isSame(today.subtract(1, 'month').startOf('month'), 'day'))
      setPeriod('thang_truoc')
    else
      setPeriod('tuy_chon')
  }, [initialParams])

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const { data: materialGroups = [] } = useQuery({
    queryKey: ['material-groups-all'],
    queryFn: () => client.get<{ id: number; ma_nhom: string; ten_nhom: string }[]>('/material-groups/all').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const { data: supplierPhanLoai = [] } = useQuery({
    queryKey: ['supplier-phan-loai'],
    queryFn: () =>
      client.get<{ items: { phan_loai: string | null }[] }>('/suppliers', { params: { page_size: 500 } })
        .then(r => {
          const distinct = [...new Set(r.data.items.map(s => s.phan_loai).filter(Boolean))] as string[]
          return distinct.sort()
        }),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const setPeriodPreset = (val: string) => {
    setPeriod(val)
    if (val !== 'tuy_chon') {
      const [tu, den] = applyPreset(val)
      setDraft(d => ({ ...d, tu_ngay: tu, den_ngay: den }))
    }
  }

  const handleApply = () => {
    onApply(draft)
    onClose()
  }

  const handleReset = () => {
    const fresh = defaultParams()
    setDraft(fresh)
    setPeriod('thang_nay')
  }

  return (
    <Modal
      title={<><FilterOutlined /> Chọn tham số</>}
      open={open}
      onCancel={onClose}
      afterOpenChange={isOpen => isOpen && handleOpen()}
      width={800}
      footer={
        <Row justify="space-between">
          <Col>
            <Button onClick={handleReset}>Xóa điều kiện</Button>
          </Col>
          <Col>
            <Space>
              <Button onClick={onClose}>Hủy</Button>
              <Button type="primary" style={{ background: '#00695c' }} onClick={handleApply}>
                Xem báo cáo
              </Button>
            </Space>
          </Col>
        </Row>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {/* Row 1: Pháp nhân + Kỳ báo cáo */}
        <Row gutter={16}>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Pháp nhân</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả pháp nhân"
              allowClear
              value={draft.phap_nhan_id}
              onChange={v => setDraft(d => ({ ...d, phap_nhan_id: v }))}
              options={listPhapNhan.map((p: any) => ({
                value: p.id,
                label: p.ten_viet_tat || p.ten_phap_nhan,
              }))}
            />
          </Col>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Kỳ báo cáo</Text>
            <Select
              style={{ width: '100%' }}
              value={period}
              onChange={setPeriodPreset}
              options={PERIOD_PRESETS}
            />
          </Col>
        </Row>

        {/* Row 2: Từ ngày - Đến ngày */}
        <Row gutter={16}>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Từ ngày</Text>
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={draft.tu_ngay}
              onChange={v => {
                if (v) { setPeriod('tuy_chon'); setDraft(d => ({ ...d, tu_ngay: v })) }
              }}
            />
          </Col>
          <Col span={12}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Đến ngày</Text>
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={draft.den_ngay}
              onChange={v => {
                if (v) { setPeriod('tuy_chon'); setDraft(d => ({ ...d, den_ngay: v })) }
              }}
            />
          </Col>
        </Row>

        {/* Row 3: Nhóm VTHH + Nhóm NCC + NV mua hàng */}
        <Row gutter={12}>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Nhóm VTHH</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả nhóm"
              allowClear showSearch optionFilterProp="label"
              value={draft.nhom_vthh_id}
              onChange={v => setDraft(d => ({ ...d, nhom_vthh_id: v }))}
              options={materialGroups.map((g: any) => ({ value: g.id, label: g.ten_nhom }))}
            />
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Nhóm NCC</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả loại"
              allowClear
              value={draft.phan_loai_ncc}
              onChange={v => setDraft(d => ({ ...d, phan_loai_ncc: v }))}
              options={supplierPhanLoai.map((pl: string) => ({ value: pl, label: pl }))}
            />
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>NV mua hàng</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả NV"
              allowClear
              value={draft.nhan_vien_id}
              onChange={v => setDraft(d => ({ ...d, nhan_vien_id: v }))}
              // populated from users list - kept simple for now
              options={[]}
            />
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0' }} />

        {/* Hàng hóa table */}
        <div>
          <Text strong>Hàng hóa</Text>
          {draft.paper_material_ids.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {draft.paper_material_ids.length} mã đã chọn
            </Tag>
          )}
          <MaterialTable
            selected={draft.paper_material_ids}
            onSelect={ids => setDraft(d => ({ ...d, paper_material_ids: ids }))}
          />
        </div>

        <Divider style={{ margin: '4px 0' }} />

        {/* Nhà cung cấp table */}
        <div>
          <Text strong>Nhà cung cấp</Text>
          {draft.supplier_ids.length > 0 && (
            <Tag color="teal" style={{ marginLeft: 8 }}>
              {draft.supplier_ids.length} NCC đã chọn
            </Tag>
          )}
          <SupplierTable
            selected={draft.supplier_ids}
            onSelect={ids => setDraft(d => ({ ...d, supplier_ids: ids }))}
          />
        </div>
      </Space>
    </Modal>
  )
}

// ─── Report columns ───────────────────────────────────────────────────────────

const COLUMNS: ColumnsType<ReportRow> = [
  {
    title: 'Ngày hạch toán',
    dataIndex: 'ngay_hach_toan',
    width: 120,
    render: v => dayjs(v).format('DD/MM/YYYY'),
  },
  {
    title: 'Ngày chứng từ',
    dataIndex: 'ngay_chung_tu',
    width: 120,
    render: v => dayjs(v).format('DD/MM/YYYY'),
  },
  {
    title: 'Số chứng từ',
    dataIndex: 'so_chung_tu',
    width: 130,
    render: v => v || <Text type="secondary">—</Text>,
  },
  {
    title: 'Số hóa đơn',
    dataIndex: 'so_hoa_don',
    width: 130,
    render: v => v || <Text type="secondary">—</Text>,
  },
  {
    title: 'Nhà cung cấp',
    dataIndex: 'ten_ncc',
    ellipsis: true,
  },
  {
    title: 'Tiền hàng',
    dataIndex: 'tong_tien_hang',
    width: 130,
    align: 'right',
    render: v => fmtVND(v),
  },
  {
    title: 'Thuế VAT',
    dataIndex: 'tien_thue',
    width: 110,
    align: 'right',
    render: v => v > 0 ? fmtVND(v) : <Text type="secondary">—</Text>,
  },
  {
    title: 'Tổng TT',
    dataIndex: 'tong_thanh_toan',
    width: 130,
    align: 'right',
    render: v => <Text strong>{fmtVND(v)}</Text>,
  },
  {
    title: 'Đã TT',
    dataIndex: 'da_thanh_toan',
    width: 120,
    align: 'right',
    render: v => <Text style={{ color: '#389e0d' }}>{fmtVND(v)}</Text>,
  },
  {
    title: 'Còn lại',
    dataIndex: 'con_lai',
    width: 120,
    align: 'right',
    render: v => (
      <Text strong style={{ color: v > 0 ? '#fa541c' : '#52c41a' }}>{fmtVND(v)}</Text>
    ),
  },
  {
    title: 'Trạng thái',
    dataIndex: 'trang_thai',
    width: 120,
    render: v => {
      const cfg = TRANG_THAI_LABELS[v] || { label: v, color: 'default' }
      return <Tag color={cfg.color}>{cfg.label}</Tag>
    },
  },
  {
    title: 'Ghi chú',
    dataIndex: 'ghi_chu',
    ellipsis: true,
    render: v => v || <Text type="secondary">—</Text>,
  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SoChiTietMuaHangPage() {
  const [params, setParams] = useState<Params>(defaultParams)
  const [appliedParams, setAppliedParams] = useState<Params | null>(null)
  const [modalOpen, setModalOpen] = useState(true)
  const [reportPage, setReportPage] = useState(1)
  const PAGE_SIZE = 50

  const { data, isFetching, refetch } = useQuery<ReportResponse>({
    queryKey: [
      'soctmh-report',
      appliedParams?.tu_ngay?.format('YYYY-MM-DD'),
      appliedParams?.den_ngay?.format('YYYY-MM-DD'),
      appliedParams?.phap_nhan_id,
      appliedParams?.nhom_vthh_id,
      appliedParams?.phan_loai_ncc,
      appliedParams?.nhan_vien_id,
      appliedParams?.supplier_ids,
      appliedParams?.paper_material_ids,
      reportPage,
    ],
    queryFn: () => {
      if (!appliedParams) throw new Error('no params')
      const qp: Record<string, unknown> = {
        tu_ngay: appliedParams.tu_ngay.format('YYYY-MM-DD'),
        den_ngay: appliedParams.den_ngay.format('YYYY-MM-DD'),
        page: reportPage,
        page_size: PAGE_SIZE,
      }
      if (appliedParams.phap_nhan_id) qp.phap_nhan_id = appliedParams.phap_nhan_id
      if (appliedParams.nhom_vthh_id) qp.nhom_vthh_id = appliedParams.nhom_vthh_id
      if (appliedParams.phan_loai_ncc) qp.phan_loai_ncc = appliedParams.phan_loai_ncc
      if (appliedParams.nhan_vien_id) qp.nhan_vien_id = appliedParams.nhan_vien_id
      if (appliedParams.supplier_ids.length)
        qp.supplier_ids = appliedParams.supplier_ids
      if (appliedParams.paper_material_ids.length)
        qp.paper_material_ids = appliedParams.paper_material_ids
      return client.get<ReportResponse>('/accounting/purchase/so-chi-tiet-nangcao', { params: qp }).then(r => r.data)
    },
    enabled: !!appliedParams,
    staleTime: 30_000,
  })

  const handleApply = (p: Params) => {
    setParams(p)
    setAppliedParams(p)
    setReportPage(1)
  }

  const handleExcel = () => {
    if (!data) return
    const tu = appliedParams!.tu_ngay.format('DDMMYYYY')
    const den = appliedParams!.den_ngay.format('DDMMYYYY')
    exportToExcel(`SoChiTietMuaHang_${tu}_${den}`, [{
      name: 'Sổ chi tiết',
      headers: ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Nhà cung cấp', 'Tiền hàng', 'Thuế VAT', 'Tổng TT', 'Đã TT', 'Còn lại', 'Trạng thái'],
      rows: data.rows.map(r => [
        dayjs(r.ngay_hach_toan).format('DD/MM/YYYY'),
        dayjs(r.ngay_chung_tu).format('DD/MM/YYYY'),
        r.so_chung_tu || '',
        r.so_hoa_don || '',
        r.ten_ncc,
        r.tong_tien_hang,
        r.tien_thue,
        r.tong_thanh_toan,
        r.da_thanh_toan,
        r.con_lai,
        TRANG_THAI_LABELS[r.trang_thai]?.label || r.trang_thai,
      ]),
      colWidths: [14, 14, 14, 14, 28, 14, 12, 14, 14, 14, 14],
    }])
  }

  const filterSummary = appliedParams
    ? `${appliedParams.tu_ngay.format('DD/MM/YYYY')} — ${appliedParams.den_ngay.format('DD/MM/YYYY')}${
        appliedParams.supplier_ids.length ? ` · ${appliedParams.supplier_ids.length} NCC` : ''
      }${appliedParams.paper_material_ids.length ? ` · ${appliedParams.paper_material_ids.length} mặt hàng` : ''}`
    : null

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: '#00695c' }}>Sổ chi tiết mua hàng</Title>
      </Row>
      {/* Toolbar */}
      <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
        <Col flex="auto">
          {filterSummary && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Đang xem: <Text strong>{filterSummary}</Text>
            </Text>
          )}
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FilterOutlined />}
              style={{ borderColor: '#00695c', color: '#00695c' }}
              onClick={() => setModalOpen(true)}
            >
              {appliedParams ? 'Thay đổi tham số' : 'Chọn tham số'}
            </Button>
            {appliedParams && (
              <>
                <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching} />
                <Button
                  icon={<FileExcelOutlined />}
                  style={{ color: '#217346', borderColor: '#217346' }}
                  disabled={!data}
                  onClick={handleExcel}
                >
                  Xuất Excel
                </Button>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
              </>
            )}
          </Space>
        </Col>
      </Row>

      {/* Summary cards */}
      {appliedParams && data && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Tổng tiền hàng"
                value={data.totals.tong_tien_hang}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Thuế VAT"
                value={data.totals.tong_thue}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Đã thanh toán"
                value={data.totals.da_thanh_toan}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="Còn phải trả"
                value={data.totals.con_lai}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: data.totals.con_lai > 0 ? '#fa541c' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Report table */}
      {!appliedParams && (
        <Alert
          type="info"
          showIcon
          message='Nhấn "Chọn tham số" để bắt đầu xem báo cáo'
        />
      )}

      {appliedParams && (
        <>
          {isFetching && !data && <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />}
          {data && (
            <Table<ReportRow>
              rowKey="id"
              size="small"
              loading={isFetching}
              dataSource={data.rows}
              columns={COLUMNS}
              scroll={{ x: 1400 }}
              locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
              pagination={false}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <Text strong>Tổng cộng ({data.total} bản ghi)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{fmtVND(data.totals.tong_tien_hang)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{fmtVND(data.totals.tong_thue)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong>{fmtVND(data.totals.tong_thanh_toan)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <Text strong style={{ color: '#389e0d' }}>{fmtVND(data.totals.da_thanh_toan)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <Text strong style={{ color: '#fa541c' }}>{fmtVND(data.totals.con_lai)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} />
                  <Table.Summary.Cell index={11} />
                </Table.Summary.Row>
              )}
            />
          )}
          {data && data.total > PAGE_SIZE && (
            <Pagination
              current={reportPage}
              total={data.total}
              pageSize={PAGE_SIZE}
              onChange={p => setReportPage(p)}
              showTotal={t => `${t} bản ghi`}
              style={{ marginTop: 12, textAlign: 'right' }}
            />
          )}
        </>
      )}

      {/* Parameter modal */}
      <ParamModal
        open={modalOpen}
        initialParams={params}
        onApply={handleApply}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
