import { useEffect, useMemo, useState } from 'react'
import type { ApiError } from '../../../../../../../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Checkbox, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, EyeOutlined,
  FileTextOutlined, InboxOutlined, FileDoneOutlined, AuditOutlined,
  CheckOutlined, CloseOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, GoodsReceipt, CreateGoodsReceiptPayload } from '../../api/warehouse'
import { purchaseApi, PurchaseOrder } from '../../api/purchase'
import { purchaseInvoiceApi } from '../../api/accounting'
import { suppliersApi } from '../../api/suppliers'
import { warehousesApi, Warehouse } from '../../api/warehouses'
import { phapNhanApi } from '../../api/phap_nhan'
import { analyzeSinglePhapNhanId, singlePhapNhanError, smartExportExcel, fmtVND } from '../../utils/exportUtils'
import PhotoCapture from '../../components/PhotoCapture'

const { Title, Text } = Typography

const GR_FILTER_KEY = 'gr_filters'
function loadGRFilters() {
  try { return JSON.parse(sessionStorage.getItem(GR_FILTER_KEY) ?? '{}') } catch { return {} }
}

const TRANG_THAI_GR: Record<string, string> = {
  nhap_nhanh: 'Nhập nhanh',
  nhap: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
}

const TRANG_THAI_COLOR: Record<string, string> = {
  nhap_nhanh: 'orange',
  nhap: 'blue',
  da_duyet: 'green',
}

const PO_STATUS_FOR_GR = ['da_duyet', 'da_gui_ncc', 'dang_giao']

const VAT_OPTIONS = [0, 5, 8, 10].map(v => ({ value: v, label: `${v}%` }))

const KET_QUA_OPTIONS = [
  { value: 'DAT', label: 'Đạt' },
  { value: 'KHONG_DAT', label: 'Không đạt' },
]

function poLoaiKhoAuto(po?: PurchaseOrder | null) {
  if (!po) return 'GIAY_CUON'
  if (po.loai_po === 'giay_tam') return 'PHOI'
  if (po.loai_po === 'nvl_khac') return 'NVL_PHU'
  return 'GIAY_CUON'
}

function remainingQty(item: { so_luong: number; so_luong_da_nhan?: number; so_cuon?: number | null; so_cuon_da_nhan?: number }) {
  // Giấy cuộn: theo dõi bằng số cuộn (kg thực chưa biết khi đặt hàng)
  if (item.so_cuon && item.so_cuon > 0) {
    return Math.max(0, (item.so_cuon || 0) - (item.so_cuon_da_nhan || 0))
  }
  // NVL khác: theo dõi bằng kg/dvt như cũ
  return Math.max(0, Number(item.so_luong || 0) - Number(item.so_luong_da_nhan || 0))
}

function isPaperRoll(item: { so_cuon?: number | null; paper_material_id?: number | null }) {
  return !!(item.so_cuon && item.so_cuon > 0 && item.paper_material_id)
}

export default function GoodsReceiptPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm()

  const _gf = loadGRFilters()
  const [search, setSearch] = useState<string>(_gf.search ?? '')
  const [shortcutFilter, setShortcutFilter] = useState<string | null>(_gf.shortcutFilter ?? null)
  const [filterNCC, setFilterNCC] = useState<number | undefined>(_gf.filterNCC)
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>(_gf.filterTrangThai)
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>(_gf.filterPhapNhan)
  const [filterXuong, setFilterXuong] = useState<number | undefined>(_gf.filterXuong)
  const [filterKho, setFilterKho] = useState<number | undefined>(_gf.filterKho)
  const [tuNgay, setTuNgay] = useState<string | undefined>(_gf.tuNgay)
  const [denNgay, setDenNgay] = useState<string | undefined>(_gf.denNgay)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPOId, setSelectedPOId] = useState<number | undefined>()
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [detailDrawer, setDetailDrawer] = useState<GoodsReceipt | null>(null)
  const [matchingGrId, setMatchingGrId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 300_000,
  })

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

  const { data: poList = [] } = useQuery({
    queryKey: ['po-for-gr-all'],
    queryFn: () => purchaseApi.list().then(r => r.data),
    staleTime: 60_000,
  })

  const filteredXuongList = useMemo(() => {
    if (!filterPhapNhan) return phanXuongList
    return phanXuongList.filter(px => px.phap_nhan_id === filterPhapNhan)
  }, [filterPhapNhan, phanXuongList])

  const filteredKhoList = useMemo(() => {
    return warehouses.filter(w => {
      if (filterXuong && w.phan_xuong_id !== filterXuong) return false
      return w.trang_thai
    })
  }, [warehouses, filterXuong])

  const poOptions = useMemo(() => {
    return poList
      .filter(p => PO_STATUS_FOR_GR.includes(p.trang_thai))
      .filter(p => (p.items ?? []).some(it => remainingQty(it) > 0))
  }, [poList])

  // cho_duyet gồm cả nhap + nhap_nhanh → không filter server-side, useMemo lọc client-side
  const effectiveGRTrangThai = shortcutFilter === 'cho_duyet' ? undefined
    : shortcutFilter === 'da_duyet' ? 'da_duyet'
    : shortcutFilter === 'chua_hd' ? 'da_duyet'
      : filterTrangThai

  useEffect(() => {
    sessionStorage.setItem(GR_FILTER_KEY, JSON.stringify({
      search, shortcutFilter, filterNCC, filterTrangThai, filterPhapNhan,
      filterXuong, filterKho, tuNgay, denNgay,
    }))
  }, [search, shortcutFilter, filterNCC, filterTrangThai, filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay])

  const today = dayjs().format('YYYY-MM-DD')

  const { data: rawGrList = [], isLoading } = useQuery({
    queryKey: ['goods-receipts', search, shortcutFilter, filterNCC, filterTrangThai, filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listGoodsReceipts({
      search: search || undefined,
      supplier_id: filterNCC,
      trang_thai: effectiveGRTrangThai,
      phap_nhan_id: filterPhapNhan,
      phan_xuong_id: filterXuong,
      warehouse_id: filterKho,
      tu_ngay: shortcutFilter === 'hom_nay' ? today : tuNgay,
      den_ngay: shortcutFilter === 'hom_nay' ? today : denNgay,
    }).then(r => r.data),
  })

  // "Chờ duyệt" bao gồm nhap_nhanh; "Chưa HĐ" chỉ lấy da_duyet chưa có hóa đơn
  const grList = useMemo(() => {
    if (shortcutFilter === 'cho_duyet') {
      return rawGrList.filter(r => r.trang_thai === 'nhap' || r.trang_thai === 'nhap_nhanh')
    }
    if (shortcutFilter === 'chua_hd') {
      return rawGrList.filter(r => r.trang_thai === 'da_duyet' && !r.co_hoa_don)
    }
    return rawGrList
  }, [rawGrList, shortcutFilter])

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['po-for-gr-all'] })
      message.success('Đã duyệt phiếu nhập kho và cập nhật tồn kho')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi duyệt phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      message.success('Đã xóa phiếu nhập kho')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi xóa phiếu'),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateGoodsReceiptPayload) => warehouseApi.createGoodsReceipt(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['po-for-gr-all'] })
      message.success('Đã tạo phiếu nhập kho, chờ duyệt để cập nhật tồn')
      setDrawerOpen(false)
      setSelectedPOId(undefined)
      setSelectedPO(null)
      form.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu nhập kho'),
  })

  const { data: matchingData, isFetching: matchingFetching } = useQuery({
    queryKey: ['gr-matching', matchingGrId],
    queryFn: () => warehouseApi.getGRMatchingStatus(matchingGrId!).then(r => r.data),
    enabled: !!matchingGrId,
    staleTime: 30_000,
  })

  const createInvoiceMut = useMutation({
    mutationFn: (data: { grId: number; thue_suat: number; co_vat: boolean }) =>
      purchaseInvoiceApi.fromGR(data.grId, { thue_suat: data.thue_suat, co_vat: data.co_vat }),
    onSuccess: inv => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      message.success(`Đã tạo hóa đơn mua #${inv.id}`)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Lỗi tạo hóa đơn mua từ phiếu nhập'),
  })

  function openCreateInvoice(grId: number) {
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
          <Select
            defaultValue={8}
            style={{ width: '100%' }}
            options={VAT_OPTIONS}
            onChange={v => { thueSuat = v }}
          />
        </Space>
      ),
      onOk: () => createInvoiceMut.mutate({ grId, thue_suat: thueSuat, co_vat: coVat }),
    })
  }

  function suggestWarehouse(po: PurchaseOrder): Warehouse | undefined {
    const loaiKho = poLoaiKhoAuto(po)
    return warehouses.find(w => (
      w.trang_thai &&
      w.phan_xuong_id === po.phan_xuong_id &&
      w.loai_kho === loaiKho
    ))
  }

  function openCreate() {
    form.resetFields()
    setSelectedPOId(undefined)
    setSelectedPO(null)
    form.setFieldsValue({ ngay_nhap: dayjs(), items: [] })
    setDrawerOpen(true)
  }

  async function onPOSelect(poId?: number) {
    setSelectedPOId(poId)
    if (!poId) {
      setSelectedPO(null)
      form.setFieldsValue({ items: [] })
      return
    }

    try {
      const po = await purchaseApi.get(poId).then(r => r.data)
      const wh = suggestWarehouse(po)
      setSelectedPO(po)
      form.setFieldsValue({
        supplier_id: po.supplier_id,
        ngay_nhap: dayjs(),
        warehouse_id: wh?.id,
        items: po.items
          .filter(item => remainingQty(item) > 0)
          .map(item => ({
            po_item_id: item.id,
            paper_material_id: item.paper_material_id,
            other_material_id: item.other_material_id,
            ten_hang: item.ten_hang,
            dvt: item.dvt || 'Kg',
            don_gia: Number(item.don_gia || 0),
            // Giấy cuộn: pre-fill số cuộn còn lại, kg để trống (nhập sau khi cân)
            so_cuon: isPaperRoll(item) ? remainingQty(item) : null,
            so_luong: isPaperRoll(item) ? 0 : remainingQty(item),
            ket_qua_kiem_tra: 'DAT',
            ghi_chu: null,
          })),
      })
      if (!wh && po.phan_xuong_id) {
        message.info('Chưa tìm thấy kho phù hợp, hệ thống sẽ thử tự chọn kho khi lưu phiếu')
      }
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || 'Không đọc được PO')
    }
  }

  type GRFormItem = {
    po_item_id?: number | null
    paper_material_id?: number | null
    other_material_id?: number | null
    ten_hang?: string
    so_luong?: number
    so_cuon?: number | null
    dvt?: string
    don_gia?: number
    ket_qua_kiem_tra?: string
    ghi_chu?: string | null
  }

  function onFinish(values: { items?: GRFormItem[]; ngay_nhap: { format: (f: string) => string }; supplier_id: number; warehouse_id?: number; bo_qua_hach_toan?: boolean; ghi_chu?: string; so_xe?: string }) {
    const items = (values.items ?? []).map((it: GRFormItem) => ({
      po_item_id: it.po_item_id ?? null,
      paper_material_id: it.paper_material_id ?? null,
      other_material_id: it.other_material_id ?? null,
      ten_hang: it.ten_hang ?? '',
      so_luong: Number(it.so_luong) || 0,
      so_cuon: it.so_cuon ? Number(it.so_cuon) : null,
      dvt: it.dvt ?? 'Kg',
      don_gia: Number(it.don_gia) || 0,
      ket_qua_kiem_tra: it.ket_qua_kiem_tra ?? 'DAT',
      ghi_chu: it.ghi_chu ?? null,
    }))

    if (!items.length) {
      message.warning('Thêm ít nhất 1 dòng hàng')
      return
    }
    if (items.some(it => !it.ten_hang)) {
      message.warning('Mỗi dòng hàng cần có tên hàng')
      return
    }
    if (items.some(it => {
      if (it.paper_material_id && it.so_cuon) return it.so_cuon <= 0 || it.so_luong <= 0
      return it.so_luong <= 0
    })) {
      message.warning('Giấy cuộn: nhập cả số cuộn và kg thực cân. NVL khác: nhập số lượng > 0')
      return
    }
    if (!values.warehouse_id && !selectedPO?.phan_xuong_id) {
      message.warning('Chọn kho nhập hoặc chọn PO có xưởng để hệ thống tự tìm kho')
      return
    }

    const payload: CreateGoodsReceiptPayload = {
      ngay_nhap: values.ngay_nhap.format('YYYY-MM-DD'),
      po_id: selectedPOId ?? null,
      supplier_id: values.supplier_id,
      warehouse_id: values.warehouse_id ?? null,
      phan_xuong_id: selectedPO?.phan_xuong_id ?? null,
      loai_kho_auto: poLoaiKhoAuto(selectedPO),
      phap_nhan_id: null,
      bo_qua_hach_toan: Boolean(values.bo_qua_hach_toan),
      loai_nhap: selectedPO?.loai_po === 'giay_tam' ? 'PHOI_NGOAI' : 'MUA_HANG',
      ghi_chu: values.ghi_chu ?? null,
      so_xe: values.so_xe ?? null,
      items,
    }
    createMut.mutate(payload)
  }

  const columns = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 150,
      render: (v: string, r: GoodsReceipt) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setDetailDrawer(r)}>
          {v}
        </Button>
      ),
    },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 105, render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '-' },
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
    {
      title: 'PO',
      dataIndex: 'po_id',
      width: 145,
      render: (v: number | null) => {
        const po = poList.find(p => p.id === v)
        return po ? <Tag color="blue">{po.so_po}</Tag> : <Text type="secondary">-</Text>
      },
    },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 130, render: (v: string | null) => v ?? '-' },
    { title: 'Kho nhập', dataIndex: 'ten_kho', width: 150, ellipsis: true },
    { title: 'Tổng giá trị', dataIndex: 'tong_gia_tri', width: 125, align: 'right' as const, render: (v: number) => fmtVND(v) },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 115,
      render: (v: string) => <Tag color={TRANG_THAI_COLOR[v] ?? 'default'}>{TRANG_THAI_GR[v] ?? v}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 135,
      align: 'right' as const,
      render: (_: unknown, r: GoodsReceipt) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailDrawer(r)} />
          </Tooltip>
          {r.trang_thai === 'da_duyet' && (
            <Tooltip title="Tạo hóa đơn mua">
              <Button
                size="small"
                icon={<FileDoneOutlined />}
                loading={createInvoiceMut.isPending}
                onClick={() => openCreateInvoice(r.id)}
              />
            </Tooltip>
          )}
          {r.trang_thai === 'da_duyet' && r.po_id && (
            <Tooltip title="Kiểm tra khớp PO–GR–HĐ">
              <Button
                size="small"
                icon={<AuditOutlined />}
                onClick={() => setMatchingGrId(r.id)}
              />
            </Tooltip>
          )}
          {(r.trang_thai === 'nhap' || r.trang_thai === 'nhap_nhanh') && (
            <Tooltip title="Duyệt và cập nhật tồn kho">
              <Popconfirm
                title="Duyệt phiếu nhập kho?"
                description="Tồn kho sẽ được cập nhật ngay."
                onConfirm={() => approveMut.mutate(r.id)}
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={approveMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.trang_thai !== 'da_duyet' && (
            <Tooltip title="Xóa">
              <Popconfirm title="Xóa phiếu này?" onConfirm={() => deleteMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const itemColumns = [
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Số lượng', dataIndex: 'so_luong', width: 105, align: 'right' as const, render: (v: number) => v.toLocaleString('vi-VN') },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const, render: (v: number) => fmtVND(v) },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const, render: (v: number) => fmtVND(v) },
    {
      title: 'Kiểm tra',
      dataIndex: 'ket_qua_kiem_tra',
      width: 100,
      render: (v: string) => <Tag color={v === 'DAT' ? 'green' : 'red'}>{v === 'DAT' ? 'Đạt' : 'Không đạt'}</Tag>,
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true, render: (v: string | null) => v ?? '-' },
  ]

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const phapNhanResult = analyzeSinglePhapNhanId(grList)
      if (!phapNhanResult.ok) {
        message.error(singlePhapNhanError(phapNhanResult, 'danh sach phieu nhap mua hang'))
        return
      }
      const rows = grList.map(g => ({
        so_phieu: g.so_phieu,
        ngay_nhap: g.ngay_nhap,
        ten_ncc: g.ten_ncc,
        ten_phan_xuong: g.ten_phan_xuong ?? '',
        ten_kho: g.ten_kho,
        tong_gia_tri: g.tong_gia_tri,
        trang_thai: TRANG_THAI_GR[g.trang_thai] ?? g.trang_thai,
      }))
      await smartExportExcel('GOODS_RECEIPT_PURCHASE', rows, [
        { key: 'so_phieu', label: 'So phieu', width: 18 },
        { key: 'ngay_nhap', label: 'Ngay nhap', width: 12 },
        { key: 'ten_ncc', label: 'Nha cung cap', width: 28 },
        { key: 'ten_phan_xuong', label: 'Xuong', width: 18 },
        { key: 'ten_kho', label: 'Kho', width: 20 },
        { key: 'tong_gia_tri', label: 'Tong gia tri', width: 16 },
        { key: 'trang_thai', label: 'Trang thai', width: 16 },
      ], `phieu_nhap_kho_mua_hang_${dayjs().format('YYYYMMDD')}`, phapNhanResult.phapNhanId, { throwOnError: true })
    } catch (e) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } }
      message.error(err?.message || (err as ApiError)?.response?.data?.detail || 'Xuat Excel phieu nhap mua hang that bai')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            Phiếu nhập kho mua hàng
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FileTextOutlined />}
              onClick={handleExportExcel}
              loading={isExporting}
              disabled={isExporting}
            >
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo phiếu nhập
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 8 }}>
        <Row gutter={[8, 8]} align="middle">
          <Col xs={24} sm={8} md={5}>
            <Input.Search
              placeholder="Tìm số phiếu / tên NCC..."
              allowClear
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Trạng thái"
              style={{ width: '100%' }}
              allowClear
              options={Object.entries(TRANG_THAI_GR).map(([value, label]) => ({ value, label }))}
              value={shortcutFilter ? undefined : filterTrangThai}
              onChange={v => { setFilterTrangThai(v); setShortcutFilter(null) }}
              disabled={!!shortcutFilter}
            />
          </Col>
          <Col xs={24} sm={8} md={5}>
            <Select
              placeholder="Nhà cung cấp"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
              value={filterNCC}
              onChange={setFilterNCC}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Pháp nhân"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
              value={filterPhapNhan}
              onChange={v => { setFilterPhapNhan(v); setFilterXuong(undefined); setFilterKho(undefined) }}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Xưởng"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={filteredXuongList.map(px => ({ value: px.id, label: px.ten_xuong }))}
              value={filterXuong}
              onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Kho"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={filteredKhoList.map(w => ({ value: w.id, label: w.ten_kho }))}
              value={filterKho}
              onChange={setFilterKho}
            />
          </Col>
          <Col xs={12} sm={8} md={3}>
            <DatePicker placeholder="Từ ngày" format="DD/MM/YYYY" style={{ width: '100%' }}
              value={tuNgay ? dayjs(tuNgay) : null}
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={8} md={3}>
            <DatePicker placeholder="Đến ngày" format="DD/MM/YYYY" style={{ width: '100%' }}
              value={denNgay ? dayjs(denNgay) : null}
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
        <Row style={{ marginTop: 8 }} gutter={8}>
          <Col>
            <Space size={6}>
              <span style={{ fontSize: 12, color: '#888' }}>Lọc nhanh:</span>
              {[
                { key: 'cho_duyet', label: 'Chờ duyệt' },
                { key: 'da_duyet', label: 'Đã duyệt' },
                { key: 'hom_nay', label: 'Hôm nay' },
                { key: 'chua_hd', label: 'Chưa HĐ' },
              ].map(s => (
                <Button
                  key={s.key}
                  size="small"
                  type={shortcutFilter === s.key ? 'primary' : 'default'}
                  danger={s.key === 'chua_hd' && shortcutFilter === s.key}
                  onClick={() => setShortcutFilter(shortcutFilter === s.key ? null : s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        size="small"
        columns={columns}
        dataSource={grList}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1120 }}
        summary={pageData => {
          const total = pageData.reduce((s, r) => s + (r.tong_gia_tri || 0), 0)
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6}>
                <Text strong>Tổng trang</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <Text strong>{fmtVND(total)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} colSpan={2} />
            </Table.Summary.Row>
          )
        }}
      />

      <Drawer
        title={detailDrawer ? `Chi tiết ${detailDrawer.so_phieu}` : ''}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={760}
      >
        {detailDrawer && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Số phiếu">{detailDrawer.so_phieu}</Descriptions.Item>
              <Descriptions.Item label="Ngày nhập">{dayjs(detailDrawer.ngay_nhap).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Nhà cung cấp" span={2}>{detailDrawer.ten_ncc}</Descriptions.Item>
              <Descriptions.Item label="Xưởng">{detailDrawer.ten_phan_xuong ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Kho nhập">{detailDrawer.ten_kho}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={TRANG_THAI_COLOR[detailDrawer.trang_thai]}>
                  {TRANG_THAI_GR[detailDrawer.trang_thai]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng giá trị">
                <Text strong>{fmtVND(detailDrawer.tong_gia_tri)}</Text>
              </Descriptions.Item>
              {detailDrawer.ghi_chu && <Descriptions.Item label="Ghi chú" span={2}>{detailDrawer.ghi_chu}</Descriptions.Item>}
            </Descriptions>

            <Divider orientation="left" orientationMargin={0}>Chi tiết hàng nhập</Divider>
            <Table size="small" dataSource={detailDrawer.items} columns={itemColumns} rowKey="id" pagination={false} />

            <Divider orientation="left" orientationMargin={0} style={{ marginTop: 16 }}>Ảnh đính kèm</Divider>
            <PhotoCapture
              module="goods_receipts"
              recordId={detailDrawer.id}
              label="Ảnh phiếu giao / hàng nhập"
              readOnly={detailDrawer.trang_thai === 'da_duyet'}
            />

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                {detailDrawer.trang_thai === 'da_duyet' && (
                  <Button
                    icon={<FileDoneOutlined />}
                    loading={createInvoiceMut.isPending}
                    onClick={() => openCreateInvoice(detailDrawer.id)}
                  >
                    Tạo hóa đơn mua
                  </Button>
                )}
                {(detailDrawer.trang_thai === 'nhap' || detailDrawer.trang_thai === 'nhap_nhanh') && (
                  <Popconfirm
                    title="Duyệt phiếu nhập kho?"
                    description="Tồn kho sẽ được cập nhật ngay."
                    onConfirm={() => {
                      approveMut.mutate(detailDrawer.id)
                      setDetailDrawer(null)
                    }}
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMut.isPending}>
                      Duyệt phiếu
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        title="Tạo phiếu nhập kho mua hàng"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedPOId(undefined); setSelectedPO(null); form.resetFields() }}
        width={900}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setDrawerOpen(false); setSelectedPOId(undefined); setSelectedPO(null); form.resetFields() }}>
                Hủy
              </Button>
              <Button type="primary" onClick={() => form.submit()} loading={createMut.isPending}>
                Lưu phiếu nhập
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="Đơn mua hàng">
                <Select
                  placeholder="Chọn PO để tự điền nhà cung cấp, hàng hóa và kho nhập"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={selectedPOId}
                  options={poOptions.map(p => ({
                    value: p.id,
                    label: `${p.so_po} - ${p.ten_ncc} - ${p.ten_phan_xuong ?? 'Chưa gán xưởng'} - ${fmtVND(p.tong_tien)}`,
                  }))}
                  onChange={v => void onPOSelect(v)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true, message: 'Chọn ngày nhập' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="warehouse_id" label="Kho nhập">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={selectedPO ? 'Tự gợi ý theo xưởng/loại hàng' : 'Chọn kho nhập'}
                  options={warehouses.filter(w => w.trang_thai).map(w => ({
                    value: w.id,
                    label: `${w.ten_kho}${w.ten_xuong ? ` - ${w.ten_xuong}` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="so_xe" label="Số xe / số phiếu NCC">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="bo_qua_hach_toan" valuePropName="checked" label=" ">
                <Checkbox>Bỏ qua hạch toán tự động</Checkbox>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}>Chi tiết hàng nhập</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const paperMatId = getFieldValue(['items', name, 'paper_material_id'])
                        const soCuonField = getFieldValue(['items', name, 'so_cuon'])
                        const isRoll = !!(paperMatId && soCuonField)
                        return (
                          <Row gutter={8} align="top">
                            <Col xs={24} md={isRoll ? 8 : 9}>
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true, message: 'Nhập tên hàng' }]}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col xs={8} md={isRoll ? 2 : 3}>
                              <Form.Item name={[name, 'dvt']} label="ĐVT">
                                <Input placeholder="Kg" />
                              </Form.Item>
                            </Col>
                            {isRoll && (
                              <Col xs={8} md={3}>
                                <Form.Item name={[name, 'so_cuon']} label="Số cuộn" rules={[{ required: true, message: 'Nhập số cuộn' }]}>
                                  <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="cuộn" />
                                </Form.Item>
                              </Col>
                            )}
                            <Col xs={8} md={isRoll ? 3 : 4}>
                              <Form.Item
                                name={[name, 'so_luong']}
                                label={isRoll ? 'Kg thực cân' : 'Số lượng'}
                                rules={[{ required: true, message: 'Nhập số lượng' }]}
                              >
                                <InputNumber style={{ width: '100%' }} min={0} />
                              </Form.Item>
                            </Col>
                            <Col xs={8} md={4}>
                              <Form.Item name={[name, 'don_gia']} label="Đơn giá (đ/kg)">
                                <InputNumber style={{ width: '100%' }} min={0} />
                              </Form.Item>
                            </Col>
                            <Col xs={18} md={3}>
                              <Form.Item name={[name, 'ket_qua_kiem_tra']} label="Kiểm tra" initialValue="DAT">
                                <Select options={KET_QUA_OPTIONS} />
                              </Form.Item>
                            </Col>
                            <Col xs={6} md={1} style={{ paddingTop: 30, textAlign: 'right' }}>
                              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                            </Col>
                          </Row>
                        )
                      }}
                    </Form.Item>
                    <Row gutter={8}>
                      <Col span={24}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú dòng">
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name={[name, 'po_item_id']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'paper_material_id']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'other_material_id']} hidden><Input /></Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ dvt: 'Kg', ket_qua_kiem_tra: 'DAT', so_luong: 0, don_gia: 0 })}
                >
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      {/* Modal 3-way matching PO ↔ GR ↔ Hóa đơn */}
      <Modal
        open={!!matchingGrId}
        onCancel={() => setMatchingGrId(null)}
        footer={null}
        width={760}
        title={<Space><AuditOutlined /> Kiểm tra khớp PO – GR – Hóa đơn</Space>}
      >
        {matchingFetching ? (
          <div style={{ textAlign: 'center', padding: 32 }}>Đang tải...</div>
        ) : matchingData ? (
          <>
            <Descriptions size="small" bordered column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Phiếu nhập">{matchingData.so_phieu_gr}</Descriptions.Item>
              <Descriptions.Item label="Đơn mua">{matchingData.so_po ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Hóa đơn">
                {matchingData.so_hoa_don
                  ? <Tag color="green"><CheckOutlined /> {matchingData.so_hoa_don}</Tag>
                  : <Tag color="orange"><WarningOutlined /> Chưa có HĐ</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Giá trị GR">{fmtVND(matchingData.gia_tri_gr)}</Descriptions.Item>
              <Descriptions.Item label="Giá trị PO">
                {matchingData.gia_tri_po != null
                  ? <span style={{ color: matchingData.lenh_gia_po_pct != null && matchingData.lenh_gia_po_pct > 1 ? '#ff4d4f' : '#52c41a' }}>
                      {fmtVND(matchingData.gia_tri_po)}
                      {matchingData.lenh_gia_po_pct != null && ` (±${matchingData.lenh_gia_po_pct}%)`}
                    </span>
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Giá trị HĐ">
                {matchingData.gia_tri_hd != null
                  ? <span style={{ color: matchingData.lenh_hd_pct != null && matchingData.lenh_hd_pct > 1 ? '#ff4d4f' : '#52c41a' }}>
                      {fmtVND(matchingData.gia_tri_hd)}
                      {matchingData.lenh_hd_pct != null && ` (±${matchingData.lenh_hd_pct}%)`}
                    </span>
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              dataSource={matchingData.lines}
              rowKey="ten_hang"
              pagination={false}
              columns={[
                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                { title: 'SL GR', dataIndex: 'gr_so_luong', width: 90, align: 'right' as const, render: (v: number) => v.toLocaleString('vi-VN') },
                { title: 'SL PO', dataIndex: 'po_so_luong', width: 90, align: 'right' as const, render: (v: number | null) => v != null ? v.toLocaleString('vi-VN') : '—' },
                {
                  title: 'SL OK?', width: 70, align: 'center' as const,
                  render: (_: unknown, r: typeof matchingData.lines[0]) =>
                    r.so_luong_ok == null ? <Text type="secondary">—</Text>
                    : r.so_luong_ok ? <CheckOutlined style={{ color: '#52c41a' }} />
                    : <CloseOutlined style={{ color: '#ff4d4f' }} />,
                },
                { title: 'Đơn giá GR', dataIndex: 'gr_don_gia', width: 110, align: 'right' as const, render: (v: number) => fmtVND(v) },
                { title: 'Đơn giá PO', dataIndex: 'po_don_gia', width: 110, align: 'right' as const, render: (v: number | null) => v != null ? fmtVND(v) : '—' },
                {
                  title: 'Giá OK?', width: 70, align: 'center' as const,
                  render: (_: unknown, r: typeof matchingData.lines[0]) =>
                    r.don_gia_ok == null ? <Text type="secondary">—</Text>
                    : r.don_gia_ok ? <CheckOutlined style={{ color: '#52c41a' }} />
                    : <CloseOutlined style={{ color: '#ff4d4f' }} />,
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </div>
  )
}
