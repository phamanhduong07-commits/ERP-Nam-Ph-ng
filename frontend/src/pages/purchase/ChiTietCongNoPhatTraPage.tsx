import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker,
  Input, Modal, Pagination, Row, Select, Space,
  Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  FileExcelOutlined, FilterOutlined, PrinterOutlined, ReloadOutlined, WarningOutlined,
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
  phan_loai_ncc?: string
  nhan_vien_id?: number
  supplier_ids: number[]
  chi_lay_hd_trong_ky: boolean
}

interface ReportRow {
  id: number
  ma_ncc: string
  ten_ncc: string
  ngay_hach_toan: string
  ngay_hoa_don: string
  so_hoa_don: string | null
  tong_tien_hang: number
  tien_thue: number
  tong_thanh_toan: number
  da_thanh_toan: number
  con_lai: number
  han_tt: string | null
  so_ngay_qua_han: number
  trang_thai: string
  ghi_chu: string | null
}

interface ReportResponse {
  total: number
  page: number
  page_size: number
  rows: ReportRow[]
  totals: { tong_phat_sinh: number; tong_da_tt: number; tong_con_lai: number }
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

const TRANG_THAI: Record<string, { label: string; color: string }> = {
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
  const t = dayjs()
  switch (preset) {
    case 'thang_nay': return [t.startOf('month'), t.endOf('month')]
    case 'thang_truoc': return [t.subtract(1, 'month').startOf('month'), t.subtract(1, 'month').endOf('month')]
    case 'quy_nay': {
      const qm = Math.floor(t.month() / 3) * 3
      return [t.month(qm).startOf('month'), t.month(qm + 2).endOf('month')]
    }
    case 'nam_nay': return [t.startOf('year'), t.endOf('year')]
    default: return [t.startOf('month'), t]
  }
}

const defaultParams = (): Params => ({
  tu_ngay: dayjs().startOf('month'),
  den_ngay: dayjs(),
  supplier_ids: [],
  chi_lay_hd_trong_ky: true,
})

// ─── Supplier selection table ─────────────────────────────────────────────────

function SupplierPickerTable({
  selected,
  onSelect,
}: {
  selected: number[]
  onSelect: (ids: number[]) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectAll, setSelectAll] = useState(false)
  const PAGE_SIZE = 20

  const { data, isFetching } = useQuery({
    queryKey: ['ctcnpt-suppliers', search, page],
    queryFn: () =>
      client.get<{ items: SupplierItem[]; total: number }>('/suppliers', {
        params: { search, page, page_size: PAGE_SIZE },
      }).then(r => r.data),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      // When "select all" is checked, clear specific selections (means "all NCC")
      onSelect([])
    }
  }

  const handleToggle = (id: number) => {
    setSelectAll(false)
    if (selected.includes(id)) onSelect(selected.filter(s => s !== id))
    else onSelect([...selected, id])
  }

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 6 }} align="middle">
        <Col>
          <Checkbox
            checked={selectAll}
            onChange={e => handleSelectAllChange(e.target.checked)}
          >
            Chọn tất cả nhà cung cấp
          </Checkbox>
        </Col>
        <Col flex="auto" />
        <Col>
          <Input.Search
            size="small"
            style={{ width: 220 }}
            placeholder="Nhập từ khoá tìm kiếm"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
          />
        </Col>
      </Row>
      <Table<SupplierItem>
        rowKey="id"
        size="small"
        loading={isFetching}
        dataSource={items}
        pagination={false}
        scroll={{ y: 280 }}
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        rowSelection={{
          selectedRowKeys: selectAll ? items.map(i => i.id) : selected,
          onChange: keys => { setSelectAll(false); onSelect(keys as number[]) },
          columnWidth: 36,
          getCheckboxProps: () => ({ disabled: selectAll }),
        }}
        columns={[
          { title: 'Mã NCC', dataIndex: 'ma_ncc', width: 140, ellipsis: true },
          { title: 'Tên NCC', dataIndex: 'ten_viet_tat', ellipsis: true },
          {
            title: 'Địa chỉ',
            dataIndex: 'ten_don_vi',
            ellipsis: true,
            render: (_v, r) => r.ten_don_vi || <Text type="secondary">—</Text>,
          },
          {
            title: 'Mã số thuế',
            dataIndex: 'ma_so_thue',
            width: 130,
            render: v => v || <Text type="secondary">—</Text>,
          },
        ]}
        onRow={r => ({ onClick: () => handleToggle(r.id) })}
      />
      <Row align="middle" style={{ marginTop: 6 }}>
        <Col flex="auto">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tổng số: {total} bản ghi
            {!selectAll && selected.length > 0 && ` · Đã chọn: ${selected.length} NCC`}
          </Text>
        </Col>
        <Col>
          <Pagination
            size="small"
            current={page}
            total={total}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            showTotal={(_t, range) => `${range[0]}-${range[1]} trên ${_t}`}
          />
        </Col>
      </Row>
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

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const { data: supplierPhanLoai = [] } = useQuery({
    queryKey: ['supplier-phan-loai-ctcn'],
    queryFn: () =>
      client.get<{ items: { phan_loai: string | null }[] }>('/suppliers', { params: { page_size: 500 } })
        .then(r => {
          const distinct = [...new Set(r.data.items.map((s: any) => s.phan_loai).filter(Boolean))] as string[]
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

  const handleApply = () => { onApply(draft); onClose() }
  const handleReset = () => { setDraft(defaultParams()); setPeriod('thang_nay') }

  return (
    <Modal
      title={<><FilterOutlined /> Chọn tham số</>}
      open={open}
      onCancel={onClose}
      afterOpenChange={isOpen => isOpen && setDraft(initialParams)}
      width={900}
      footer={
        <Row justify="space-between">
          <Col><Button onClick={handleReset}>Xóa điều kiện</Button></Col>
          <Col>
            <Space>
              <Button onClick={onClose}>Hủy</Button>
              <Button type="primary" style={{ background: '#1565c0' }} onClick={handleApply}>
                Xem báo cáo
              </Button>
            </Space>
          </Col>
        </Row>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {/* Chi nhánh */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>Chi nhánh</Text>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Chọn chi nhánh"
            allowClear showSearch optionFilterProp="label"
            value={draft.phap_nhan_id ? [draft.phap_nhan_id] : []}
            onChange={v => setDraft(d => ({ ...d, phap_nhan_id: v[v.length - 1] }))}
            options={listPhapNhan.map((p: any) => ({
              value: p.id,
              label: p.ten_viet_tat || p.ten_phap_nhan,
            }))}
          />
        </div>

        {/* Kỳ báo cáo + ngày */}
        <Row gutter={12} align="bottom">
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Kỳ báo cáo <Text type="danger">*</Text></Text>
            <Select
              style={{ width: '100%' }}
              value={period}
              onChange={setPeriodPreset}
              options={PERIOD_PRESETS}
            />
          </Col>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Từ ngày</Text>
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={draft.tu_ngay}
              onChange={v => { if (v) { setPeriod('tuy_chon'); setDraft(d => ({ ...d, tu_ngay: v })) } }}
            />
          </Col>
          <Col span={6}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Đến ngày</Text>
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={draft.den_ngay}
              onChange={v => { if (v) { setPeriod('tuy_chon'); setDraft(d => ({ ...d, den_ngay: v })) } }}
            />
          </Col>
        </Row>

        {/* Tài khoản + Loại tiền + Nhóm NCC + NV mua hàng */}
        <Row gutter={12}>
          <Col span={4}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Tài khoản</Text>
            <Select
              style={{ width: '100%' }}
              value="331"
              disabled
              options={[{ value: '331', label: '331' }]}
            />
          </Col>
          <Col span={4}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Loại tiền</Text>
            <Select
              style={{ width: '100%' }}
              value="TH"
              disabled
              options={[{ value: 'TH', label: 'TH' }]}
            />
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Nhóm nhà cung cấp</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Tất cả"
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
              options={[]}
            />
          </Col>
        </Row>

        {/* Supplier table */}
        <SupplierPickerTable
          selected={draft.supplier_ids}
          onSelect={ids => setDraft(d => ({ ...d, supplier_ids: ids }))}
        />

        {/* Bottom checkboxes */}
        <Space direction="vertical" size={4}>
          <Checkbox
            checked={draft.chi_lay_hd_trong_ky}
            onChange={e => setDraft(d => ({ ...d, chi_lay_hd_trong_ky: e.target.checked }))}
          >
            Chỉ lấy hóa đơn trong kỳ
          </Checkbox>
          <Checkbox disabled>
            Lấy cả chứng từ thanh toán chưa đối trừ với chứng từ công nợ
          </Checkbox>
        </Space>
      </Space>
    </Modal>
  )
}

// ─── Report columns ───────────────────────────────────────────────────────────

const COLUMNS: ColumnsType<ReportRow> = [
  { title: 'Mã nhà cung cấp', dataIndex: 'ma_ncc', width: 140, ellipsis: true },
  { title: 'Tên nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true, width: 220 },
  {
    title: 'Ngày hạch toán',
    dataIndex: 'ngay_hach_toan',
    width: 120,
    render: v => dayjs(v).format('DD/MM/YYYY'),
  },
  {
    title: 'Ngày hóa đơn',
    dataIndex: 'ngay_hoa_don',
    width: 115,
    render: v => dayjs(v).format('DD/MM/YYYY'),
  },
  {
    title: 'Số hóa đơn',
    dataIndex: 'so_hoa_don',
    width: 130,
    render: v => v || <Text type="secondary">—</Text>,
  },
  {
    title: 'Tổng phát sinh',
    dataIndex: 'tong_thanh_toan',
    width: 130,
    align: 'right',
    render: v => <Text strong>{fmtVND(v)}</Text>,
  },
  {
    title: 'Đã thanh toán',
    dataIndex: 'da_thanh_toan',
    width: 130,
    align: 'right',
    render: v => <Text style={{ color: '#389e0d' }}>{fmtVND(v)}</Text>,
  },
  {
    title: 'Còn phải trả',
    dataIndex: 'con_lai',
    width: 120,
    align: 'right',
    render: v => (
      <Text strong style={{ color: v > 0 ? '#fa541c' : '#52c41a' }}>{fmtVND(v)}</Text>
    ),
  },
  {
    title: 'Hạn TT',
    dataIndex: 'han_tt',
    width: 100,
    render: (v, r) => {
      if (!v) return <Text type="secondary">—</Text>
      const isOver = r.so_ngay_qua_han > 0
      return (
        <Tooltip title={isOver ? `Quá hạn ${r.so_ngay_qua_han} ngày` : undefined}>
          <span style={{ color: isOver ? '#f5222d' : undefined, fontWeight: isOver ? 600 : undefined }}>
            {isOver && <WarningOutlined style={{ marginRight: 4 }} />}
            {dayjs(v).format('DD/MM/YYYY')}
          </span>
        </Tooltip>
      )
    },
  },
  {
    title: 'Số ngày QH',
    dataIndex: 'so_ngay_qua_han',
    width: 100,
    align: 'center',
    render: v => v > 0 ? <Tag color="red">{v}</Tag> : <Text type="secondary">—</Text>,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'trang_thai',
    width: 120,
    render: v => {
      const cfg = TRANG_THAI[v] || { label: v, color: 'default' }
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

export default function ChiTietCongNoPhatTraPage() {
  const [params, setParams] = useState<Params>(defaultParams)
  const [appliedParams, setAppliedParams] = useState<Params | null>(null)
  const [modalOpen, setModalOpen] = useState(true)
  const [reportPage, setReportPage] = useState(1)
  const PAGE_SIZE = 50

  const { data, isFetching, refetch } = useQuery<ReportResponse>({
    queryKey: [
      'ctcnpt-report',
      appliedParams?.tu_ngay?.format('YYYY-MM-DD'),
      appliedParams?.den_ngay?.format('YYYY-MM-DD'),
      appliedParams?.phap_nhan_id,
      appliedParams?.phan_loai_ncc,
      appliedParams?.nhan_vien_id,
      appliedParams?.supplier_ids,
      appliedParams?.chi_lay_hd_trong_ky,
      reportPage,
    ],
    queryFn: () => {
      if (!appliedParams) throw new Error('no params')
      const qp: Record<string, unknown> = {
        tu_ngay: appliedParams.tu_ngay.format('YYYY-MM-DD'),
        den_ngay: appliedParams.den_ngay.format('YYYY-MM-DD'),
        chi_lay_hd_trong_ky: appliedParams.chi_lay_hd_trong_ky,
        page: reportPage,
        page_size: PAGE_SIZE,
      }
      if (appliedParams.phap_nhan_id) qp.phap_nhan_id = appliedParams.phap_nhan_id
      if (appliedParams.phan_loai_ncc) qp.phan_loai_ncc = appliedParams.phan_loai_ncc
      if (appliedParams.nhan_vien_id) qp.nhan_vien_id = appliedParams.nhan_vien_id
      if (appliedParams.supplier_ids.length) qp.supplier_ids = appliedParams.supplier_ids
      return client.get<ReportResponse>('/accounting/ap/chi-tiet-theo-hoa-don', { params: qp }).then(r => r.data)
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
    exportToExcel(`ChiTietCNPhatTra_${tu}_${den}`, [{
      name: 'Chi tiết CN phải trả',
      headers: ['Mã NCC', 'Tên NCC', 'Ngày hạch toán', 'Ngày HĐ', 'Số HĐ', 'Tổng phát sinh', 'Đã TT', 'Còn phải trả', 'Hạn TT', 'Số ngày QH', 'Trạng thái'],
      rows: data.rows.map(r => [
        r.ma_ncc,
        r.ten_ncc,
        dayjs(r.ngay_hach_toan).format('DD/MM/YYYY'),
        dayjs(r.ngay_hoa_don).format('DD/MM/YYYY'),
        r.so_hoa_don || '',
        r.tong_thanh_toan,
        r.da_thanh_toan,
        r.con_lai,
        r.han_tt ? dayjs(r.han_tt).format('DD/MM/YYYY') : '',
        r.so_ngay_qua_han || '',
        TRANG_THAI[r.trang_thai]?.label || r.trang_thai,
      ]),
      colWidths: [14, 28, 14, 14, 14, 16, 16, 16, 12, 12, 14],
    }])
  }

  const filterSummary = appliedParams
    ? `${appliedParams.tu_ngay.format('DD/MM/YYYY')} — ${appliedParams.den_ngay.format('DD/MM/YYYY')}${
        appliedParams.chi_lay_hd_trong_ky ? '' : ' · Tất cả tồn đọng'
      }${appliedParams.supplier_ids.length ? ` · ${appliedParams.supplier_ids.length} NCC` : ''}`
    : null

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: '#1565c0' }}>Chi tiết công nợ phải trả theo hóa đơn</Title>
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
              style={{ borderColor: '#1565c0', color: '#1565c0' }}
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
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title="Tổng phát sinh"
                value={data.totals.tong_phat_sinh}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: '#1565c0' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title="Đã thanh toán"
                value={data.totals.tong_da_tt}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title="Còn phải trả"
                value={data.totals.tong_con_lai}
                formatter={v => fmtVND(Number(v))}
                valueStyle={{ fontSize: 14, color: data.totals.tong_con_lai > 0 ? '#fa541c' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Report table */}
      {!appliedParams && (
        <Alert type="info" showIcon message='Nhấn "Chọn tham số" để bắt đầu xem báo cáo' />
      )}

      {appliedParams && data && (
        <>
          <Table<ReportRow>
            rowKey="id"
            size="small"
            loading={isFetching}
            dataSource={data.rows}
            columns={COLUMNS}
            scroll={{ x: 1500 }}
            locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
            pagination={false}
            rowClassName={r => r.so_ngay_qua_han > 0 ? 'row-overdue' : ''}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <Text strong>Tổng cộng ({data.total} hóa đơn)</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#1565c0' }}>{fmtVND(data.totals.tong_phat_sinh)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: '#389e0d' }}>{fmtVND(data.totals.tong_da_tt)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <Text strong style={{ color: '#fa541c' }}>{fmtVND(data.totals.tong_con_lai)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} colSpan={4} />
              </Table.Summary.Row>
            )}
          />
          {data.total > PAGE_SIZE && (
            <Pagination
              current={reportPage}
              total={data.total}
              pageSize={PAGE_SIZE}
              onChange={p => setReportPage(p)}
              showTotal={t => `${t} bản ghi`}
              style={{ marginTop: 12, textAlign: 'right' }}
            />
          )}
          <style>{`.row-overdue td { background: #fff1f0 !important; }`}</style>
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
