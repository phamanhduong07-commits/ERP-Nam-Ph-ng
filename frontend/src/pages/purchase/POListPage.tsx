import { useEffect, useMemo, useState } from 'react'
import type { ApiError } from '../../../../../../../../api/types'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, ShopOutlined, MinusCircleOutlined,
  FileExcelOutlined, FilePdfOutlined, FileTextOutlined, UploadOutlined, WarningOutlined,
} from '@ant-design/icons'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import dayjs from 'dayjs'
import { analyzeSinglePhapNhanId, singlePhapNhanError, smartExportExcel, smartPrintPdf, buildHtmlTable, fmtVND } from '../../utils/exportUtils'
import {
  purchaseApi, PurchaseOrder, POItem, CreatePOPayload,
  TRANG_THAI_PO, TRANG_THAI_PO_COLOR,
} from '../../api/purchase'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { suppliersApi } from '../../api/suppliers'
import { purchaseInvoiceApi } from '../../api/accounting'
import { warehouseApi, TonKhoGiayRow, TonKhoNVLRow } from '../../api/warehouse'

const { Title, Text } = Typography

const VAT_OPTIONS = [0, 5, 8, 10].map(v => ({ value: v, label: `${v}%` }))

const DIEU_KHOAN_OPTIONS = ['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'TT trước'].map(v => ({ value: v, label: v }))

const PO_ACTIVE_STATUSES = ['moi', 'da_duyet', 'da_gui_ncc', 'dang_giao']
const PO_FILTER_KEY = 'po_filters'

function loadPOFilters() {
  try { return JSON.parse(sessionStorage.getItem(PO_FILTER_KEY) ?? '{}') } catch { return {} }
}

export default function POListPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const _pf = loadPOFilters()
  const [search, setSearch] = useState<string>(_pf.search ?? '')
  const [shortcutFilter, setShortcutFilter] = useState<string | null>(_pf.shortcutFilter ?? null)
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>(_pf.filterTrangThai)
  const [filterXuong, setFilterXuong] = useState<number | undefined>(_pf.filterXuong)
  const [filterLoaiPo, setFilterLoaiPo] = useState<string | undefined>(_pf.filterLoaiPo)
  const [tuNgay, setTuNgay] = useState<string | undefined>(_pf.tuNgay)
  const [denNgay, setDenNgay] = useState<string | undefined>(_pf.denNgay)
  const [importVisible, setImportVisible] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []

  const { data: otherPage } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const otherMats = otherPage?.items ?? []

  // Tồn kho — chỉ fetch khi mở form tạo PO
  const { data: giayStockRows = [] } = useQuery<TonKhoGiayRow[]>({
    queryKey: ['ton-kho-giay-po-form'],
    queryFn: () => warehouseApi.getTonKhoGiay().then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  })
  const { data: nvlStockRows = [] } = useQuery<TonKhoNVLRow[]>({
    queryKey: ['ton-kho-nvl-po-form'],
    queryFn: () => warehouseApi.getTonKhoNVL().then(r => r.data),
    enabled: open,
    staleTime: 60_000,
  })
  // Aggregate tổng tồn theo material_id
  const paperTonMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of giayStockRows) {
      m.set(r.paper_material_id, (m.get(r.paper_material_id) ?? 0) + r.ton_luong)
    }
    return m
  }, [giayStockRows])
  const nvlTonMap = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of nvlStockRows) {
      if (r.other_material_id != null) {
        m.set(r.other_material_id, (m.get(r.other_material_id) ?? 0) + r.ton_luong)
      }
    }
    return m
  }, [nvlStockRows])

  const effectivePOTrangThai = shortcutFilter === 'qua_han' ? undefined
    : shortcutFilter === 'chua_giao' ? undefined
    : shortcutFilter === 'dang_giao' ? 'dang_giao'
    : filterTrangThai

  useEffect(() => {
    sessionStorage.setItem(PO_FILTER_KEY, JSON.stringify({
      search, shortcutFilter, filterTrangThai, filterXuong, filterLoaiPo, tuNgay, denNgay,
    }))
  }, [search, shortcutFilter, filterTrangThai, filterXuong, filterLoaiPo, tuNgay, denNgay])

  const { data: rawPoList = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', search, shortcutFilter, filterTrangThai, tuNgay, denNgay, filterXuong, filterLoaiPo],
    queryFn: () => purchaseApi.list({
      search: search || undefined,
      trang_thai: effectivePOTrangThai,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      phan_xuong_id: filterXuong,
      loai_po: filterLoaiPo,
    }).then(r => r.data),
  })

  const today = dayjs().startOf('day')
  const poList = useMemo(() => {
    if (shortcutFilter === 'qua_han') {
      return rawPoList.filter(r =>
        PO_ACTIVE_STATUSES.includes(r.trang_thai) &&
        r.ngay_du_kien_nhan &&
        dayjs(r.ngay_du_kien_nhan).startOf('day').isBefore(today)
      )
    }
    if (shortcutFilter === 'chua_giao') {
      return rawPoList.filter(r => ['da_duyet', 'da_gui_ncc'].includes(r.trang_thai))
    }
    return rawPoList
  }, [rawPoList, shortcutFilter, today])

  const createMut = useMutation({
    mutationFn: (data: CreatePOPayload) => purchaseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã tạo đơn mua hàng')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi tạo PO'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => purchaseApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã duyệt đơn mua hàng')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi duyệt PO'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã xoá đơn mua hàng')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const guiNCCMut = useMutation({
    mutationFn: (id: number) => purchaseApi.guiNcc(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã chuyển trạng thái Đã gửi NCC')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const huyPOMut = useMutation({
    mutationFn: (id: number) => purchaseApi.huy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã hủy đơn mua hàng')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi hủy PO'),
  })

  const createPurchaseInvoiceMut = useMutation({
    mutationFn: (data: { poId: number; thue_suat: number; co_vat: boolean }) =>
      purchaseInvoiceApi.fromPO(data.poId, { thue_suat: data.thue_suat, co_vat: data.co_vat }),
    onSuccess: inv => {
      message.success('Đã tạo hóa đơn mua hàng')
      navigate(`/accounting/purchase-invoices/${inv.id}`)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi tạo hóa đơn'),
  })

  function openCreateInvoice(poId: number) {
    let coVat = true
    let thueSuat = 8
    Modal.confirm({
      title: 'Tạo hóa đơn mua',
      okText: 'Tạo hóa đơn',
      cancelText: 'Hủy',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            defaultValue={true}
            style={{ width: '100%' }}
            options={[
              { value: true, label: 'V: Có VAT' },
              { value: false, label: 'V: Không VAT' },
            ]}
            onChange={v => { coVat = v }}
          />
          <Select defaultValue={8} style={{ width: '100%' }} options={VAT_OPTIONS} onChange={v => { thueSuat = v }} />
        </Space>
      ),
      onOk: () => createPurchaseInvoiceMut.mutate({ poId, thue_suat: thueSuat, co_vat: coVat }),
    })
  }

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = { ...updated[itemName], mat_id: matId, ten_hang: mat.ten, dvt: mat.dvt, don_gia: mat.gia_mua || 0 }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: {
        loai_vat_tu?: string; mat_id?: number | null; ten_hang?: string
        so_luong: number; dvt?: string; don_gia?: number; ghi_chu?: string | null
      }) => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        supplier_id: v.supplier_id,
        ngay_po: v.ngay_po.format('YYYY-MM-DD'),
        phan_xuong_id: v.phan_xuong_id || null,
        loai_po: v.loai_po || 'chung',
        ngay_du_kien_nhan: v.ngay_du_kien_nhan ? v.ngay_du_kien_nhan.format('YYYY-MM-DD') : null,
        dieu_khoan_tt: v.dieu_khoan_tt || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số PO', dataIndex: 'so_po', width: 170,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay_po', width: 110 },
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 130,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan', width: 130,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 120,
      render: (v: string) => (
        <Tag color={TRANG_THAI_PO_COLOR[v] || 'default'}>{TRANG_THAI_PO[v] || v}</Tag>
      ) },
    {
      title: 'Ngày DK nhận', dataIndex: 'ngay_du_kien_nhan', width: 130,
      render: (v: string | null, r: PurchaseOrder) => {
        if (!v) return <Text type="secondary">—</Text>
        const active = PO_ACTIVE_STATUSES.includes(r.trang_thai)
        if (!active) return dayjs(v).format('DD/MM/YYYY')
        const diff = dayjs(v).startOf('day').diff(today, 'day')
        if (diff < 0) return <span style={{ color: '#cf1322', fontWeight: 600 }}><WarningOutlined style={{ marginRight: 4 }} />{dayjs(v).format('DD/MM/YYYY')}</span>
        if (diff <= 3) return <span style={{ color: '#d46b08', fontWeight: 600 }}>{dayjs(v).format('DD/MM/YYYY')}</span>
        return dayjs(v).format('DD/MM/YYYY')
      },
    },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'Tiến độ nhận', dataIndex: 'tien_do_nhan', width: 120, align: 'right' as const,
      render: (v: number) => v != null ? `${v}%` : '—' },
    { title: 'Ngày tạo', dataIndex: 'created_at', width: 110,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    {
      title: '', width: 120,
      render: (_: unknown, r: PurchaseOrder) => (
        <Space>
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Duyệt đơn mua hàng này?" onConfirm={() => approveMut.mutate(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'da_duyet' && (
            <Tooltip title="Gửi NCC">
              <Popconfirm title="Xác nhận đã gửi PO cho nhà cung cấp?" onConfirm={() => guiNCCMut.mutate(r.id)}>
                <Button size="small" icon={<ShopOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Xoá đơn mua này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
          {['da_duyet', 'da_gui_ncc', 'dang_giao'].includes(r.trang_thai) && (
            <Tooltip title="Hủy PO">
              <Popconfirm
                title="Hủy đơn mua hàng?"
                description="Thao tác này không thể hoàn tác nếu chưa có phiếu nhập."
                onConfirm={() => huyPOMut.mutate(r.id)}
                okButtonProps={{ danger: true }}
              >
                <Button danger size="small" icon={<MinusCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['da_duyet', 'da_gui_ncc', 'dang_giao', 'hoan_thanh'].includes(r.trang_thai) && (
            <Tooltip title="Tạo hóa đơn mua hàng">
              <Button
                size="small" icon={<FileTextOutlined />} type="link"
                loading={createPurchaseInvoiceMut.isPending}
                onClick={() => openCreateInvoice(r.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: PurchaseOrder) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right' as const,
          render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
          render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN')}đ</Text> },
        { title: 'Đã nhận', dataIndex: 'so_luong_da_nhan', width: 100, align: 'right' as const,
          render: (v: number, row: POItem) => {
            const pct = row.so_luong > 0 ? Math.round((v || 0) / row.so_luong * 100) : 0
            return <Text type={pct >= 100 ? 'success' : undefined}>{(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ({pct}%)</Text>
          } },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const phapNhanResult = analyzeSinglePhapNhanId(poList)
      if (!phapNhanResult.ok) {
        message.error(singlePhapNhanError(phapNhanResult, 'danh sach don mua hang'))
        return
      }
      const rows = poList.map((r, i) => ({
        stt: i + 1,
        so_po: r.so_po,
        ngay_po: r.ngay_po,
        ten_ncc: r.ten_ncc ?? '',
        trang_thai: TRANG_THAI_PO[r.trang_thai] ?? r.trang_thai,
        tong_tien: Number(r.tong_tien || 0),
        tien_do_nhan: r.tien_do_nhan != null ? r.tien_do_nhan : '',
      }))
      await smartExportExcel('PURCHASE_ORDER', rows, [
        { key: 'stt', label: 'STT', width: 6 },
        { key: 'so_po', label: 'So PO', width: 18 },
        { key: 'ngay_po', label: 'Ngay PO', width: 12 },
        { key: 'ten_ncc', label: 'Nha cung cap', width: 30 },
        { key: 'trang_thai', label: 'Trang thai', width: 18 },
        { key: 'tong_tien', label: 'Tong tien', width: 16 },
        { key: 'tien_do_nhan', label: 'Tien do nhan', width: 16 },
      ], `DonMuaHang_${dayjs().format('YYYYMMDD')}`, phapNhanResult.phapNhanId, { throwOnError: true })
    } catch (e) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      message.error(err?.message || (err as ApiError)?.response?.data?.detail || 'Xuat Excel don mua hang that bai')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPdf = async () => {
    setIsExporting(true)
    try {
      const phapNhanResult = analyzeSinglePhapNhanId(poList)
      if (!phapNhanResult.ok) {
        message.error(singlePhapNhanError(phapNhanResult, 'danh sach don mua hang'))
        return
      }
      const cols = [
        { header: 'STT', align: 'center' as const },
        { header: 'So PO' }, { header: 'Ngay PO' }, { header: 'Nha cung cap' },
        { header: 'Trang thai' },
        { header: 'Tong tien', align: 'right' as const },
        { header: 'Tien do', align: 'center' as const },
      ]
      const rows = poList.map((r, i) => [
        i + 1, r.so_po, r.ngay_po, r.ten_ncc ?? '',
        TRANG_THAI_PO[r.trang_thai] ?? r.trang_thai,
        fmtVND(r.tong_tien),
        r.tien_do_nhan != null ? `${r.tien_do_nhan}%` : '-',
      ])
      const tongTien = poList.reduce((s, r) => s + Number(r.tong_tien || 0), 0)
      await smartPrintPdf('PURCHASE_ORDER_LIST', {
        title: 'DANH SACH DON MUA HANG',
        exported_at: dayjs().format('DD/MM/YYYY HH:mm'),
        total_count: String(poList.length),
        tong_tien: fmtVND(tongTien),
        body_html: buildHtmlTable(cols, rows, {
          totalRow: ['', 'TONG CONG', '', '', '', fmtVND(tongTien), ''],
        }),
      }, phapNhanResult.phapNhanId, { throwOnError: true, landscape: true })
    } catch (e) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      message.error(err?.message || (err as ApiError)?.response?.data?.detail || 'Xuat PDF don mua hang that bai')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><ShopOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Đơn mua hàng (PO)</Title>
          </Space>
        </Col>
        <Col>
          <Space size={4}>
            <Tooltip title="Xuất Excel">
              <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} loading={isExporting} disabled={isExporting} />
            </Tooltip>
            <Tooltip title="Xuất PDF">
              <Button size="small" icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf} loading={isExporting} disabled={isExporting} />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
              Tạo đơn mua
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportVisible(true)}
            >
              Import
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 8 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={6} md={5}>
            <Input.Search
              placeholder="Tìm số PO / tên NCC..."
              allowClear
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)}
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select placeholder="Tất cả trạng thái" style={{ width: '100%' }} allowClear
              value={shortcutFilter ? undefined : filterTrangThai}
              onChange={v => { setFilterTrangThai(v); setShortcutFilter(null) }}
              disabled={!!shortcutFilter}
              options={Object.entries(TRANG_THAI_PO).map(([v, l]) => ({ value: v, label: l }))} />
          </Col>
          <Col xs={12} sm={4}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong} onChange={setFilterXuong}
              options={phanXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={4}>
            <Select placeholder="Tất cả loại" style={{ width: '100%' }} allowClear value={filterLoaiPo} onChange={setFilterLoaiPo}
              options={[
                { value: 'giay_cuon', label: 'Giấy cuộn' },
                { value: 'nvl_khac', label: 'NVL khác' },
                { value: 'chung', label: 'Chung' },
              ]} />
          </Col>
          <Col xs={12} sm={4}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              value={tuNgay ? dayjs(tuNgay) : null}
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={4}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              value={denNgay ? dayjs(denNgay) : null}
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
        <Row style={{ marginTop: 8 }} gutter={8}>
          <Col>
            <Space size={6}>
              <span style={{ fontSize: 12, color: '#888' }}>Lọc nhanh:</span>
              {[
                { key: 'chua_giao', label: 'Chưa giao' },
                { key: 'dang_giao', label: 'Đang giao' },
                { key: 'qua_han', label: 'Quá hạn DK', danger: true },
              ].map(s => (
                <Button
                  key={s.key}
                  size="small"
                  type={shortcutFilter === s.key ? 'primary' : 'default'}
                  danger={s.danger && shortcutFilter === s.key}
                  icon={s.key === 'qua_han' ? <WarningOutlined /> : undefined}
                  onClick={() => setShortcutFilter(shortcutFilter === s.key ? null : s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={poList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo đơn mua hàng" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu đơn mua</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                <Select placeholder="Chọn nhà cung cấp..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phan_xuong_id" label="Xưởng">
                <Select placeholder="Chọn xưởng..." allowClear
                  options={phanXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="loai_po" label="Loại đơn" initialValue="chung">
                <Select options={[
                  { value: 'chung', label: 'Chung' },
                  { value: 'giay_cuon', label: 'Giấy cuộn' },
                  { value: 'nvl_khac', label: 'NVL khác' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_du_kien_nhan" label="Ngày DK nhận">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dieu_khoan_tt" label="Điều khoản TT">
                <Select placeholder="Chọn..." allowClear options={DIEU_KHOAN_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách hàng mua</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={5}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" style={{ marginBottom: 4 }}>
                          <Select size="small"
                            onChange={() => {
                              const items = form.getFieldValue('items') || []
                              const updated = [...items]
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', dvt: 'Kg', don_gia: 0 }
                              form.setFieldValue('items', updated)
                            }}
                            options={[
                              { value: 'giay', label: 'NL Giấy' },
                              { value: 'khac', label: 'NL Khác' },
                              { value: 'tu_do', label: 'Tự do' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu giấy" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL giấy..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={paperMats.filter(m => m.su_dung).map(m => {
                                    const ton = paperTonMap.get(m.id) ?? 0
                                    const low = ton < (m.ton_toi_thieu ?? 0) || ton === 0
                                    return {
                                      value: m.id,
                                      label: `${m.ten} (${m.dvt}) — Tồn: ${ton.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}${low ? ' ⚠' : ''}`,
                                    }
                                  })}
                                  onChange={id => handleMatSelect(name, 'giay', id)} />
                              </Form.Item>
                            )
                            if (loai === 'khac') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu khác" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL khác..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={otherMats.filter(m => m.trang_thai).map(m => {
                                    const ton = nvlTonMap.get(m.id) ?? 0
                                    const low = ton < (m.ton_toi_thieu ?? 0) || ton === 0
                                    return {
                                      value: m.id,
                                      label: `${m.ten} (${m.dvt}) — Tồn: ${ton.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}${low ? ' ⚠' : ''}`,
                                    }
                                  })}
                                  onChange={id => handleMatSelect(name, 'khac', id)} />
                              </Form.Item>
                            )
                            return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Tên hàng tự do..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Kg', 'Tấn', 'Tờ', 'Cuộn', 'Lít', 'Thùng', 'Cái'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', don_gia: 0 })}>
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      <ImportExcelDialog
        title="Import đơn mua hàng từ Excel"
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['purchase-orders'] })}
        importFn={(file, commit) => purchaseApi.importPOs(file, commit)}
        templateUrl="/api/purchase-orders/import-template"
      />
    </div>
  )
}
