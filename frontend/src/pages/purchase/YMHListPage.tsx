import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EyeOutlined, FileAddOutlined,
  FileExcelOutlined, PlusOutlined, SendOutlined, StopOutlined, WarningOutlined,
} from '@ant-design/icons'
import {
  CreateYmhPayload, PurchaseRequisition, TRANG_THAI_YMH, TRANG_THAI_YMH_COLOR, ymhApi,
} from '../../api/purchase_requisitions'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { suppliersApi } from '../../api/suppliers'
import { productsApi } from '../../api/products'
import { customersApi } from '../../api/customers'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { RangePicker } = DatePicker
const { Text, Title } = Typography

type FormItem = {
  loai_vat_tu?: 'giay' | 'khac' | 'tu_do' | 'ban_in' | 'khuon_be' | 'muc_in' | 'dich_vu'
  mat_id?: number
  san_pham_id?: number
  ten_hang?: string
  so_luong?: number
  dvt?: string
  don_gia_du_kien?: number
  ngay_can?: dayjs.Dayjs | null
  ghi_chu?: string | null
}

const DVT_OPTIONS = ['Kg', 'Tấn', 'Cuộn', 'Tờ', 'Cái', 'Bộ', 'Hộp', 'Lít', 'Lần', 'Gói', 'Năm', 'Tháng', 'Người'].map(v => ({ value: v, label: v }))
const DIEU_KHOAN_OPTIONS = ['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'TT trước'].map(v => ({ value: v, label: v }))

const ACTIVE_STATUSES = ['nhap', 'cho_duyet', 'duyet_pb', 'duyet_gd']
const FILTER_KEY = 'ymh_filters'

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '{}') } catch { return {} }
}

function deadlineStyle(ngay: string | null | undefined, active: boolean): React.CSSProperties {
  if (!active || !ngay) return {}
  const diff = dayjs(ngay).startOf('day').diff(dayjs().startOf('day'), 'day')
  if (diff < 0) return { color: '#cf1322', fontWeight: 600 }
  if (diff <= 3) return { color: '#d46b08', fontWeight: 600 }
  return {}
}

export default function YMHListPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [poForm] = Form.useForm()

  const _f = loadFilters()
  const [search, setSearch] = useState<string>(_f.search ?? '')
  const [trangThai, setTrangThai] = useState<string | undefined>(_f.trangThai)
  const [shortcutFilter, setShortcutFilter] = useState<string | null>(_f.shortcutFilter ?? null)
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>(_f.filterPhapNhan)
  const [filterXuong, setFilterXuong] = useState<number | undefined>(_f.filterXuong)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(
    _f.tuNgay ? [dayjs(_f.tuNgay), dayjs(_f.denNgay)] : null
  )
  const [viewRecord, setViewRecord] = useState<PurchaseRequisition | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [poRecord, setPoRecord] = useState<PurchaseRequisition | null>(null)
  const [rejectRecord, setRejectRecord] = useState<PurchaseRequisition | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [poItemPrices, setPoItemPrices] = useState<Record<number, number>>({})
  const [poDuKienNhan, setPoDuKienNhan] = useState<dayjs.Dayjs | null>(null)

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 300_000,
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-for-ymh'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 2000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []

  const { data: otherPage } = useQuery({
    queryKey: ['other-materials-for-ymh'],
    queryFn: () => otherMaterialsApi.list({ page_size: 2000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const otherMats = otherPage?.items ?? []

  const [productSearch, setProductSearch] = useState('')
  const [productCustomerFilter, setProductCustomerFilter] = useState<number | undefined>()
  const { data: productsPage, isFetching: productsFetching } = useQuery({
    queryKey: ['products-for-ymh', productSearch, productCustomerFilter],
    queryFn: () => productsApi.list({ search: productSearch || undefined, ma_kh_id: productCustomerFilter, page_size: 100 }).then(r => r.data),
    staleTime: 60_000,
  })
  const products = productsPage?.items ?? []

  const { data: customersAll = [] } = useQuery({
    queryKey: ['customers-all-for-ymh'],
    queryFn: () => customersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const filteredXuongList = useMemo(() => {
    if (!filterPhapNhan) return phanXuongList
    return phanXuongList.filter(px => px.phap_nhan_id === filterPhapNhan)
  }, [filterPhapNhan, phanXuongList])

  const effectiveTrangThai = shortcutFilter ?? trangThai

  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({
      search,
      trangThai,
      shortcutFilter,
      filterPhapNhan,
      filterXuong,
      tuNgay: dateRange?.[0]?.format('YYYY-MM-DD') ?? null,
      denNgay: dateRange?.[1]?.format('YYYY-MM-DD') ?? null,
    }))
  }, [search, trangThai, shortcutFilter, filterPhapNhan, filterXuong, dateRange])

  const { data: ymhs = [], isFetching } = useQuery({
    queryKey: ['ymh-list', search, effectiveTrangThai, filterPhapNhan, filterXuong, dateRange],
    queryFn: () => ymhApi.list({
      search: search || undefined,
      trang_thai: effectiveTrangThai,
      phap_nhan_id: filterPhapNhan,
      phan_xuong_id: filterXuong,
      tu_ngay: dateRange?.[0]?.format('YYYY-MM-DD'),
      den_ngay: dateRange?.[1]?.format('YYYY-MM-DD'),
    }).then(r => r.data),
  })

  function handleExcel() {
    const rows = ymhs.map(r => ({
      'Số YMH': r.so_ymh,
      'Ngày YC': r.ngay_yeu_cau,
      'Pháp nhân': r.ten_phap_nhan ?? '',
      'Xưởng': r.ten_phan_xuong ?? '',
      'Người YC': r.ten_nguoi_yeu_cau ?? '',
      'Trạng thái': TRANG_THAI_YMH[r.trang_thai] ?? r.trang_thai,
      'Dòng': r.so_dong,
      'Tổng dự kiến': r.tong_du_kien,
    }))
    exportToExcel(`ymh-${dayjs().format('YYYYMMDD')}`, [{
      name: 'YeuCauMuaHang',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map(r => Object.values(r) as (string | number)[]),
    }])
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateYmhPayload) => ymhApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã tạo yêu cầu mua hàng')
      setCreateOpen(false)
      form.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi tạo YMH'),
  })

  const duyetPBMutation = useMutation({
    mutationFn: (id: number) => ymhApi.duyetPB(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Phòng ban đã duyệt')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi duyệt PB'),
  })

  const duyetGDMutation = useMutation({
    mutationFn: (id: number) => ymhApi.duyetGD(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('GĐ đã duyệt')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi duyệt GĐ'),
  })

  const huyMutation = useMutation({
    mutationFn: (id: number) => ymhApi.huy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã hủy YMH')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi hủy YMH'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ymhApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã xóa YMH')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi xóa YMH'),
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => ymhApi.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã gửi yêu cầu đi duyệt')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi gửi duyệt'),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => ymhApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã phê duyệt YMH')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi phê duyệt'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) =>
      ymhApi.reject(id, { ly_do }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      message.success('Đã từ chối YMH')
      setRejectRecord(null)
      setRejectReason('')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi từ chối'),
  })

  const taoPOMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof ymhApi.taoPO>[1] }) => ymhApi.taoPO(id, data),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['ymh-list'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success(`Đã tạo PO ${res.data.so_po}`)
      setPoRecord(null)
      poForm.resetFields()
      setPoItemPrices({})
      navigate('/purchasing/orders')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi tạo PO'),
  })

  function syncXuongToPhapNhan(phanXuongId?: number) {
    const px = phanXuongList.find(x => x.id === phanXuongId)
    if (px?.phap_nhan_id) form.setFieldValue('phap_nhan_id', px.phap_nhan_id)
  }

  function handleMaterialSelect(itemName: number, loai: 'giay' | 'khac', matId: number) {
    const mat = loai === 'giay'
      ? paperMats.find(m => m.id === matId)
      : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items: FormItem[] = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: matId,
      ten_hang: mat.ten,
      dvt: mat.dvt || 'Kg',
      don_gia_du_kien: Number(mat.gia_mua || 0),
    }
    form.setFieldValue('items', updated)
  }

  function clearMaterialSelect(itemName: number) {
    const items: FormItem[] = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: undefined,
      ten_hang: '',
      don_gia_du_kien: 0,
    }
    form.setFieldValue('items', updated)
  }

  function toPayload(values: Record<string, unknown>): CreateYmhPayload {
    const items = ((values.items as FormItem[] | undefined) ?? []).map((it: FormItem) => ({
      paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
      other_material_id: (it.loai_vat_tu === 'khac' || it.loai_vat_tu === 'muc_in') ? (it.mat_id || null) : null,
      ten_hang: it.ten_hang ?? '',
      so_luong: Number(it.so_luong || 0),
      dvt: it.dvt ?? 'Kg',
      don_gia_du_kien: Number(it.don_gia_du_kien || 0),
      ngay_can: it.ngay_can ? dayjs(it.ngay_can).format('YYYY-MM-DD') : null,
      ghi_chu: it.ghi_chu ?? null,
      loai_item: (['ban_in', 'khuon_be', 'muc_in', 'dich_vu'] as const).includes(it.loai_vat_tu as never) ? it.loai_vat_tu as string : 'nvl',
      san_pham_id: (it.loai_vat_tu === 'ban_in' || it.loai_vat_tu === 'khuon_be' || it.loai_vat_tu === 'muc_in') ? (it.san_pham_id ?? null) : null,
    }))
    return {
      ngay_yeu_cau: dayjs(values.ngay_yeu_cau as string).format('YYYY-MM-DD'),
      phap_nhan_id: (values.phap_nhan_id as number | undefined) ?? null,
      phan_xuong_id: (values.phan_xuong_id as number | undefined) ?? null,
      ghi_chu: (values.ghi_chu as string | undefined) ?? null,
      items,
    }
  }

  async function handleCreate() {
    const values = await form.validateFields()
    const payload = toPayload(values)
    if (!payload.items.length) {
      message.warning('Thêm ít nhất 1 dòng hàng')
      return
    }
    createMutation.mutate(payload)
  }

  async function handleCreatePO() {
    const rec = poRecord
    if (!rec) return
    const values = await poForm.validateFields()
    const ngayDuKienNhan = values.ngay_du_kien_nhan ? dayjs(values.ngay_du_kien_nhan).format('YYYY-MM-DD') : null
    taoPOMutation.mutate({
      id: rec.id,
      data: {
        supplier_id: values.supplier_id,
        ngay_po: dayjs(values.ngay_po).format('YYYY-MM-DD'),
        ngay_du_kien_nhan: ngayDuKienNhan,
        dieu_khoan_tt: values.dieu_khoan_tt ?? null,
        ghi_chu: values.ghi_chu ?? null,
        items_override: rec.items.map(it => ({
          ymh_item_id: it.id ?? 0,
          don_gia: poItemPrices[it.id ?? 0] ?? it.don_gia_du_kien,
        })),
      },
    })
  }

  const columns: ColumnsType<PurchaseRequisition> = [
    {
      title: 'Số YMH', dataIndex: 'so_ymh', width: 145,
      render: (v, r) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate(`/purchasing/ymh/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    { title: 'Ngày YC', dataIndex: 'ngay_yeu_cau', width: 105 },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130, render: v => v ?? '-' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 140, render: v => v ?? '-' },
    { title: 'Người YC', dataIndex: 'ten_nguoi_yeu_cau', width: 140, render: v => v ?? '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 125,
      render: (v: string) => <Tag color={TRANG_THAI_YMH_COLOR[v] ?? 'default'}>{TRANG_THAI_YMH[v] ?? v}</Tag>,
    },
    { title: 'Dòng', dataIndex: 'so_dong', width: 70, align: 'right' },
    {
      title: 'Cần sớm nhất',
      width: 125,
      render: (_, r) => {
        const dates = r.items.map(i => i.ngay_can).filter(Boolean) as string[]
        if (!dates.length) return '-'
        const min = dates.reduce((a, b) => (a < b ? a : b))
        const active = ACTIVE_STATUSES.includes(r.trang_thai)
        const style = deadlineStyle(min, active)
        const diff = dayjs(min).startOf('day').diff(dayjs().startOf('day'), 'day')
        return (
          <span style={style}>
            {active && diff < 0 && <WarningOutlined style={{ marginRight: 4 }} />}
            {dayjs(min).format('DD/MM/YYYY')}
          </span>
        )
      },
    },
    { title: 'Tổng dự kiến', dataIndex: 'tong_du_kien', width: 135, align: 'right', render: fmtVND },
    {
      title: 'Thao tác',
      width: 220,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setViewRecord(r)} />
          </Tooltip>
          {r.trang_thai === 'nhap' && (
            <Popconfirm title="Gửi yêu cầu đi duyệt?" onConfirm={() => submitMutation.mutate(r.id)}>
              <Tooltip title="Gửi duyệt">
                <Button size="small" type="link" icon={<SendOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {['nhap', 'cho_duyet', 'duyet_pb'].includes(r.trang_thai) && (
            <Popconfirm title="Phê duyệt YMH này?" onConfirm={() => approveMutation.mutate(r.id)}>
              <Tooltip title="Duyệt (admin)">
                <Button size="small" type="link" icon={<CheckCircleOutlined />} style={{ color: 'green' }} />
              </Tooltip>
            </Popconfirm>
          )}
          {['nhap', 'cho_duyet', 'duyet_pb'].includes(r.trang_thai) && (
            <Tooltip title="Từ chối">
              <Button
                size="small"
                type="link"
                icon={<CloseCircleOutlined />}
                style={{ color: '#cf1322' }}
                onClick={() => { setRejectRecord(r); setRejectReason('') }}
              />
            </Tooltip>
          )}
          {r.trang_thai === 'nhap' && (
            <Popconfirm title="Duyệt phòng ban?" onConfirm={() => duyetPBMutation.mutate(r.id)}>
              <Button size="small" type="link" icon={<CheckCircleOutlined />}>PB</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'cho_duyet' && (
            <Popconfirm title="Duyệt phòng ban?" onConfirm={() => duyetPBMutation.mutate(r.id)}>
              <Button size="small" type="link" icon={<CheckCircleOutlined />}>PB</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'duyet_pb' && (
            <Popconfirm title="Giám đốc duyệt?" onConfirm={() => duyetGDMutation.mutate(r.id)}>
              <Button size="small" type="link" icon={<CheckCircleOutlined />} style={{ color: 'green' }}>GĐ</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'duyet_gd' && (
            <Tooltip title="Tạo PO">
              <Button size="small" type="primary" icon={<FileAddOutlined />} onClick={() => {
                const init: Record<number, number> = {}
                r.items.forEach(it => { if (it.id != null) init[it.id] = it.don_gia_du_kien })
                setPoItemPrices(init)
                setPoRecord(r)
              }} />
            </Tooltip>
          )}
          {!['huy', 'tu_choi', 'tao_po'].includes(r.trang_thai) && (
            <Popconfirm title="Hủy YMH?" onConfirm={() => huyMutation.mutate(r.id)}>
              <Button size="small" icon={<StopOutlined />} danger />
            </Popconfirm>
          )}
          {['nhap', 'huy', 'tu_choi'].includes(r.trang_thai) && (
            <Popconfirm title="Xóa YMH?" onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button size="small" icon={<DeleteOutlined />} danger type="text" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('purchase-ymh-list', columns)

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Yêu cầu mua hàng</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields()
                form.setFieldsValue({ ngay_yeu_cau: dayjs(), items: [{ loai_vat_tu: 'giay', dvt: 'Kg', don_gia_du_kien: 0 }] })
                setCreateOpen(true)
              }}
            >
              Tạo yêu cầu
            </Button>
            {settingsButton}
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 8 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={8} md={6}>
            <Input.Search
              placeholder="Tìm số YMH / tên hàng..."
              allowClear
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Trạng thái"
              style={{ width: '100%' }}
              options={Object.entries(TRANG_THAI_YMH).map(([value, label]) => ({ value, label }))}
              value={shortcutFilter ? undefined : trangThai}
              onChange={v => { setTrangThai(v); setShortcutFilter(null) }}
              disabled={!!shortcutFilter}
            />
          </Col>
          <Col xs={24} sm={6} md={5}>
            <Select
              allowClear
              showSearch
              placeholder="Pháp nhân"
              style={{ width: '100%' }}
              optionFilterProp="label"
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
              value={filterPhapNhan}
              onChange={v => { setFilterPhapNhan(v); setFilterXuong(undefined) }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              allowClear
              showSearch
              placeholder="Xưởng"
              style={{ width: '100%' }}
              optionFilterProp="label"
              options={filteredXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))}
              value={filterXuong}
              onChange={setFilterXuong}
            />
          </Col>
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
              onChange={v => setDateRange(v)}
            />
          </Col>
        </Row>
        <Row style={{ marginTop: 8 }} gutter={8}>
          <Col>
            <Space size={6}>
              <span style={{ fontSize: 12, color: '#888' }}>Lọc nhanh:</span>
              {(['nhap', 'cho_duyet', 'duyet_pb', 'duyet_gd'] as const).map(s => (
                <Button
                  key={s}
                  size="small"
                  type={shortcutFilter === s ? 'primary' : 'default'}
                  onClick={() => setShortcutFilter(shortcutFilter === s ? null : s)}
                >
                  {TRANG_THAI_YMH[s]}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<PurchaseRequisition>
          rowKey="id"
          columns={displayColumns}
          dataSource={ymhs}
          loading={isFetching}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 1180 }}
        />
      </Card>

      <Drawer
        title={`Chi tiết YMH - ${viewRecord?.so_ymh ?? ''}`}
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        width={760}
        extra={viewRecord && (
          <Space>
            {viewRecord.trang_thai === 'nhap' && (
              <Popconfirm title="Gửi yêu cầu đi duyệt?" onConfirm={() => { submitMutation.mutate(viewRecord.id); setViewRecord(null) }}>
                <Button type="primary" size="small" icon={<SendOutlined />}>Gửi duyệt</Button>
              </Popconfirm>
            )}
            {['nhap', 'cho_duyet', 'duyet_pb'].includes(viewRecord.trang_thai) && (
              <Popconfirm title="Phê duyệt YMH?" onConfirm={() => { approveMutation.mutate(viewRecord.id); setViewRecord(null) }}>
                <Button type="primary" size="small" icon={<CheckCircleOutlined />} style={{ background: 'green' }}>Duyệt</Button>
              </Popconfirm>
            )}
            {['nhap', 'cho_duyet', 'duyet_pb'].includes(viewRecord.trang_thai) && (
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => { setRejectRecord(viewRecord); setRejectReason(''); setViewRecord(null) }}
              >Từ chối</Button>
            )}
            {viewRecord.trang_thai === 'duyet_gd' && (
              <Button type="primary" size="small" icon={<FileAddOutlined />} onClick={() => { setPoRecord(viewRecord); setViewRecord(null) }}>
                Tạo PO
              </Button>
            )}
          </Space>
        )}
      >
        {viewRecord && (
          <>
            {viewRecord.trang_thai === 'tu_choi' && viewRecord.ly_do_tu_choi && (
              <Alert
                type="error"
                showIcon
                message="Yêu cầu đã bị từ chối"
                description={viewRecord.ly_do_tu_choi}
                style={{ marginBottom: 12 }}
              />
            )}
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Số YMH">{viewRecord.so_ymh}</Descriptions.Item>
              <Descriptions.Item label="Ngày yêu cầu">{viewRecord.ngay_yeu_cau}</Descriptions.Item>
              <Descriptions.Item label="Pháp nhân">{viewRecord.ten_phap_nhan ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Xưởng">{viewRecord.ten_phan_xuong ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Người yêu cầu">{viewRecord.ten_nguoi_yeu_cau ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={TRANG_THAI_YMH_COLOR[viewRecord.trang_thai]}>{TRANG_THAI_YMH[viewRecord.trang_thai]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="PB duyệt">{viewRecord.ten_nguoi_duyet_pb ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="GĐ duyệt">{viewRecord.ten_nguoi_duyet_gd ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="PO đã tạo">{viewRecord.po_id ? `#${viewRecord.po_id}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Tổng dự kiến">{fmtVND(viewRecord.tong_du_kien)}</Descriptions.Item>
              {viewRecord.ghi_chu && <Descriptions.Item label="Ghi chú" span={2}>{viewRecord.ghi_chu}</Descriptions.Item>}
            </Descriptions>
            <Table
                            locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                            rowKey={(r, i) => r.id ?? `${r.ten_hang}-${i}`}
              size="small"
              dataSource={viewRecord.items}
              pagination={false}
              columns={[
                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                { title: 'SL', dataIndex: 'so_luong', width: 95, align: 'right' },
                { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
                { title: 'Đơn giá DK', dataIndex: 'don_gia_du_kien', width: 125, align: 'right', render: fmtVND },
                {
                  title: 'Ngày cần', dataIndex: 'ngay_can', width: 105,
                  render: (v: string | null) => {
                    if (!v) return '-'
                    const active = viewRecord ? ACTIVE_STATUSES.includes(viewRecord.trang_thai) : false
                    const style = deadlineStyle(v, active)
                    const diff = dayjs(v).startOf('day').diff(dayjs().startOf('day'), 'day')
                    return (
                      <span style={style}>
                        {active && diff < 0 && <WarningOutlined style={{ marginRight: 4 }} />}
                        {dayjs(v).format('DD/MM/YYYY')}
                      </span>
                    )
                  },
                },
                { title: 'Ghi chú', dataIndex: 'ghi_chu', width: 160, render: v => v ?? '-' },
              ]}
            />
          </>
        )}
      </Drawer>

      <Drawer
        title="Tạo yêu cầu mua hàng"
        open={createOpen}
        onClose={() => { setCreateOpen(false); form.resetFields() }}
        width={920}
        extra={
          <Button type="primary" onClick={handleCreate} loading={createMutation.isPending}>
            Lưu yêu cầu
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="ngay_yeu_cau" label="Ngày yêu cầu" rules={[{ required: true, message: 'Chọn ngày yêu cầu' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="phap_nhan_id" label="Pháp nhân">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn pháp nhân"
                  options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="phan_xuong_id" label="Xưởng / bộ phận">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn xưởng"
                  options={phanXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))}
                  onChange={syncXuongToPhapNhan}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Lý do / ghi chú">
            <Input.TextArea rows={2} placeholder="VD: mua bù tồn tối thiểu, mua cho đơn hàng, mua vật tư văn phòng..." />
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]} align="top">
                      <Col xs={24} md={4}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                          <Select
                            options={[
                              { value: 'giay', label: 'Giấy cuộn' },
                              { value: 'khac', label: 'NVL khác' },
                              { value: 'tu_do', label: 'Tự do' },
                              { value: 'ban_in', label: 'Bản in' },
                              { value: 'khuon_be', label: 'Khuôn bế' },
                              { value: 'muc_in', label: 'Mực in' },
                              { value: 'dich_vu', label: 'Dịch vụ' },
                            ]}
                            onChange={() => {
                              const items: FormItem[] = form.getFieldValue('items') || []
                              const updated = [...items]
                              updated[name] = { ...updated[name], mat_id: undefined, san_pham_id: undefined, ten_hang: '', dvt: 'Cái', don_gia_du_kien: 0 }
                              form.setFieldValue('items', updated)
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={9}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') {
                              return (
                                <Form.Item name={[name, 'mat_id']} label="Giấy cuộn" rules={[{ required: true, message: 'Chọn giấy' }]} style={{ marginBottom: 4 }}>
                                  <Select
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Chọn giấy cuộn"
                                    options={paperMats.filter(m => m.su_dung).map(m => ({
                                      value: m.id,
                                      label: `${m.ma_chinh} - ${m.ten}`,
                                    }))}
                                    onChange={id => id ? handleMaterialSelect(name, 'giay', id) : clearMaterialSelect(name)}
                                    onClear={() => clearMaterialSelect(name)}
                                  />
                                </Form.Item>
                              )
                            }
                            if (loai === 'khac') {
                              return (
                                <Form.Item name={[name, 'mat_id']} label="NVL khác" rules={[{ required: true, message: 'Chọn NVL' }]} style={{ marginBottom: 4 }}>
                                  <Select
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Chọn NVL khác"
                                    options={otherMats.filter(m => m.trang_thai).map(m => ({
                                      value: m.id,
                                      label: `${m.ma_chinh} - ${m.ten}`,
                                    }))}
                                    onChange={id => id ? handleMaterialSelect(name, 'khac', id) : clearMaterialSelect(name)}
                                    onClear={() => clearMaterialSelect(name)}
                                  />
                                </Form.Item>
                              )
                            }
                            if (loai === 'ban_in' || loai === 'khuon_be' || loai === 'muc_in') {
                              const label = loai === 'ban_in' ? 'Bản in' : loai === 'khuon_be' ? 'Khuôn bế' : 'Mực in'
                              return (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                  <Select
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Lọc theo khách hàng (tùy chọn)"
                                    style={{ width: '100%' }}
                                    onChange={(v: number | undefined) => { setProductCustomerFilter(v); setProductSearch('') }}
                                    onClear={() => { setProductCustomerFilter(undefined); setProductSearch('') }}
                                    options={customersAll.map(c => ({
                                      value: c.id,
                                      label: `${c.ma_kh} - ${c.ten_viet_tat}`,
                                    }))}
                                  />
                                  <Form.Item name={[name, 'san_pham_id']} label="Mã hàng" rules={[{ required: true, message: `Chọn mã hàng cho ${label}` }]} style={{ marginBottom: 4 }}>
                                    <Select
                                      allowClear
                                      showSearch
                                      filterOption={false}
                                      loading={productsFetching}
                                      placeholder="Gõ tìm mã hàng..."
                                      onSearch={v => setProductSearch(v)}
                                      options={products.filter(p => p.trang_thai).map(p => ({
                                        value: p.id,
                                        label: `${p.ma_hang ?? p.ma_amis} - ${p.ten_hang}`,
                                      }))}
                                    />
                                  </Form.Item>
                                  {loai === 'muc_in'
                                    ? (
                                      <Form.Item name={[name, 'other_material_id']} label="Mực in" rules={[{ required: true, message: 'Chọn loại mực từ danh mục NVL' }]} style={{ marginBottom: 4 }}>
                                        <Select
                                          allowClear
                                          showSearch
                                          optionFilterProp="label"
                                          placeholder="Chọn mực từ danh mục NVL"
                                          options={otherMats.filter(m => m.trang_thai).map(m => ({
                                            value: m.id,
                                            label: `${m.ma_chinh} - ${m.ten}`,
                                          }))}
                                          onChange={id => id ? handleMaterialSelect(name, 'khac', id) : clearMaterialSelect(name)}
                                          onClear={() => clearMaterialSelect(name)}
                                        />
                                      </Form.Item>
                                    )
                                    : (
                                      <Form.Item name={[name, 'ten_hang']} label={label} rules={[{ required: true, message: `Nhập mô tả ${label}` }]} style={{ marginBottom: 4 }}>
                                        <Input placeholder={`Mô tả ${label} cần đặt`} />
                                      </Form.Item>
                                    )}
                                </Space>
                              )
                            }
                            if (loai === 'dich_vu') {
                              return (
                                <Form.Item name={[name, 'ten_hang']} label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]} style={{ marginBottom: 4 }}>
                                  <Input placeholder="VD: Bảo hiểm cháy nổ, Khám sức khỏe định kỳ..." />
                                </Form.Item>
                              )
                            }
                            return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true, message: 'Nhập tên hàng' }]} style={{ marginBottom: 4 }}>
                                <Input placeholder="Tên hàng cần mua" />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={3}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={3}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select options={DVT_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item name={[name, 'don_gia_du_kien']} label="Giá dự kiến" style={{ marginBottom: 4 }}>
                          <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={4}>
                        <Form.Item name={[name, 'ngay_can']} label="Ngày cần" style={{ marginBottom: 4 }}>
                          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={21} md={6}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú dòng" style={{ marginBottom: 4 }}>
                          <Input placeholder="..." />
                        </Form.Item>
                      </Col>
                      <Col xs={3} md={1} style={{ paddingTop: 30 }}>
                        <Button danger size="small" type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', don_gia_du_kien: 0 })}
                >
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      <Modal
        title={`Từ chối YMH - ${rejectRecord?.so_ymh ?? ''}`}
        open={!!rejectRecord}
        onCancel={() => { setRejectRecord(null); setRejectReason('') }}
        onOk={() => {
          if (!rejectRecord) return
          rejectMutation.mutate({ id: rejectRecord.id, ly_do: rejectReason })
        }}
        confirmLoading={rejectMutation.isPending}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
      >
        <p>Nhập lý do từ chối (tùy chọn):</p>
        <Input.TextArea
          rows={3}
          placeholder="VD: Chưa đủ thông tin, vượt ngân sách..."
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        title={`Tạo PO từ ${poRecord?.so_ymh ?? ''}`}
        open={!!poRecord}
        onCancel={() => { setPoRecord(null); poForm.resetFields(); setPoItemPrices({}); setPoDuKienNhan(null) }}
        onOk={handleCreatePO}
        confirmLoading={taoPOMutation.isPending}
        okText="Tạo PO"
        width={720}
      >
        <Form form={poForm} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn nhà cung cấp"
              options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_du_kien_nhan" label="Ngày dự kiến nhận">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  onChange={v => setPoDuKienNhan(v)}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dieu_khoan_tt" label="Điều khoản thanh toán">
            <Select allowClear options={DIEU_KHOAN_OPTIONS} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú PO">
            <Input.TextArea rows={2} placeholder={`Tạo từ ${poRecord?.so_ymh ?? 'YMH'}`} />
          </Form.Item>
        </Form>

        {poRecord && poRecord.items.length > 0 && (() => {
          const lateItems = poDuKienNhan
            ? poRecord.items.filter(it => it.ngay_can && dayjs(it.ngay_can).isBefore(poDuKienNhan, 'day'))
            : []
          const tong = poRecord.items.reduce((s, it) => s + (poItemPrices[it.id ?? 0] ?? it.don_gia_du_kien) * it.so_luong, 0)
          return (
            <>
              <Divider orientation="left" style={{ margin: '8px 0' }}>Dòng hàng & đơn giá</Divider>
              {lateItems.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={`${lateItems.length} dòng hàng cần sớm hơn ngày giao dự kiến`}
                  description={lateItems.map(it => `${it.ten_hang}: cần ${dayjs(it.ngay_can!).format('DD/MM/YYYY')}`).join(', ')}
                />
              )}
              <Table
                size="small"
                pagination={false}
                dataSource={poRecord.items}
                rowKey={(_, i) => String(i)}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      <Text strong>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong>{fmtVND(tong)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
                columns={[
                  { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                  { title: 'SL', dataIndex: 'so_luong', width: 70, align: 'right', render: v => Number(v).toLocaleString() },
                  { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
                  {
                    title: 'Đơn giá',
                    width: 130,
                    align: 'right',
                    render: (_, it) => (
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => Number(v?.replace(/,/g, '') ?? 0) as unknown as number}
                        value={poItemPrices[it.id ?? 0] ?? it.don_gia_du_kien}
                        onChange={val => {
                          const id = it.id ?? 0
                          setPoItemPrices(prev => ({ ...prev, [id]: val ?? 0 }))
                        }}
                        min={0}
                      />
                    ),
                  },
                  {
                    title: 'Thành tiền',
                    width: 110,
                    align: 'right',
                    render: (_, it) => fmtVND((poItemPrices[it.id ?? 0] ?? it.don_gia_du_kien) * it.so_luong),
                  },
                ]}
              />
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
