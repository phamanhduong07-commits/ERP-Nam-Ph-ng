import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form, Input, InputNumber, Select, DatePicker, Checkbox, Radio,
  Button, Card, Row, Col, Table, Space, Typography, Divider,
  message, Spin, Tag, Tooltip, Popconfirm, Modal, Badge,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, FileAddOutlined, AppstoreOutlined, CopyOutlined,
  ThunderboltOutlined, SyncOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { quotesApi, paperMaterialsApi, LOAI_IN_OPTIONS, LOAI_THUNG_OPTIONS, SO_LOP_OPTIONS, TO_HOP_SONG_OPTIONS, getSongType, calcBoxDimensions, suggestGiaBan } from '../../api/quotes'
import type { QuoteItem, CreateQuotePayload } from '../../api/quotes'
import { cauTrucApi, type CauTruc } from '../../api/cauTruc'
import { productsApi, type ProductFull } from '../../api/products'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { usersApi } from '../../api/usersApi'

const { Title, Text } = Typography

// ─── Auto-generate ghi_chu từ các chi tiết gia công (viết tắt gọn) ─────────────
function buildGhiChu(ci: QuoteItem): string {
  const parts: string[] = []

  // In ấn: FL3m / FL3m+PN / KTS
  if (ci.loai_in === 'flexo' && (ci.so_mau ?? 0) > 0) {
    parts.push(`FL${ci.so_mau}m${ci.do_phu ? '+PN' : ''}`)
  } else if (ci.loai_in === 'ky_thuat_so') {
    parts.push(ci.do_phu ? 'KTS+PN' : 'KTS')
  } else if (ci.do_phu) {
    parts.push('PN')
  }

  // Máy in (giữ nguyên vì đã ngắn: "4 màu", "in dọc"…)
  if (ci.may_in) parts.push(ci.may_in)

  // Dịch vụ checkbox
  if (ci.boi)     parts.push('Bồi')
  if (ci.ghim)    parts.push('Ghim')
  if (ci.dan)     parts.push('Dán')
  if (ci.chap_xa) parts.push('CX')       // Chạp xả
  if (ci.be_lo)   parts.push('BL')       // Bê lỗ
  if (ci.do_kho)  parts.push('SP khó')

  // Bế khuôn: Bế 4c
  if (ci.so_c_be) {
    const v = ci.so_c_be.trim()
    if (v && v !== '0') {
      // rút "4 con" → "4c"
      const short = v.replace(/\s*con$/i, 'c')
      parts.push(`Bế ${short}`)
    }
  }

  // Chống thấm: CT 1m / CT 2m
  if (ci.c_tham && ci.c_tham !== 'Không') {
    const m = ci.c_tham.replace('mặt', 'm').replace(/\s+/, '')  // "1 mặt"→"1m"
    parts.push(`CT ${m}`)
  }

  // Cán màng: CM 1m / CM 2m
  if (ci.can_man && ci.can_man !== 'Không') {
    const m = ci.can_man.replace('mặt', 'm').replace(/\s+/, '')
    parts.push(`CM ${m}`)
  }

  // Loại lằn
  if (ci.loai_lan === 'lan_bang')     parts.push('Lằn B')
  else if (ci.loai_lan === 'lan_am_duong') parts.push('Lằn ÂD')
  else if (ci.loai_lan)               parts.push(ci.loai_lan)

  // Bản vẽ KT
  if (ci.ban_ve_kt) parts.push(`BV:${ci.ban_ve_kt}`)

  return parts.join(' / ')
}

// Các field kích hoạt tự sinh ghi_chu
const ADDON_TRIGGER_KEYS: (keyof QuoteItem)[] = [
  'loai_in', 'so_mau', 'do_phu',
  'boi', 'ghim', 'dan', 'chap_xa', 'be_lo', 'do_kho',
  'so_c_be', 'c_tham', 'can_man',
  'may_in', 'loai_lan', 'ban_ve_kt',
]

// ─── Empty item template ────────────────────────────────────
const emptyItem = (): QuoteItem => ({
  stt: 1,
  product_id: null,
  loai: null,
  ma_amis: null,
  ten_hang: '',
  dvt: 'Thùng',
  so_luong: 1,
  so_mau: 0,
  so_lop: 3,
  to_hop_song: null,
  mat: null,    mat_dl: null,
  song_1: null, song_1_dl: null,
  mat_1: null,  mat_1_dl: null,
  song_2: null, song_2_dl: null,
  mat_2: null,  mat_2_dl: null,
  song_3: null, song_3_dl: null,
  mat_3: null,  mat_3_dl: null,
  lay_gia_moi_nl: false,
  don_gia_m2: null,
  loai_thung: null,
  dai: null, rong: null, cao: null,
  kho_tt: null, dai_tt: null, dien_tich: null,
  khong_ct: false,
  loai_in: 'khong_in',
  do_kho: false, ghim: false, chap_xa: false,
  do_phu: false, dan: false, boi: false, be_lo: false,
  c_tham: null, can_man: null, so_c_be: null,
  may_in: null, loai_lan: null, ban_ve_kt: null,
  gia_ban: 0,
  ghi_chu: null,
})

// ─── Hook: load distinct ma_ky_hieu + dinh_luong từ backend ─────────────────
function usePaperOptions() {
  const [mkList, setMkList] = useState<string[]>([])
  const [byMk, setByMk] = useState<Record<string, number[]>>({})
  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    paperMaterialsApi.options().then(res => {
      setMkList(res.data.ma_ky_hieu)
      setByMk(res.data.by_mk)
    })
  }, [])
  return { mkList, byMk }
}

// ─── LayerRow: 1 dòng lớp giấy với Mã KH + Định lượng ───────────────────────
function LayerRow({
  label, mkField, dlField, ci, setCI, mkList, byMk,
}: {
  label: string
  mkField: keyof QuoteItem
  dlField: keyof QuoteItem
  ci: QuoteItem
  setCI: (p: Partial<QuoteItem>) => void
  mkList: string[]
  byMk: Record<string, number[]>
}) {
  const mkVal = ci[mkField] as string | null | undefined
  const dlVal = ci[dlField] as number | null | undefined
  const dlOptions = mkVal && byMk[mkVal]
    ? byMk[mkVal].map(n => ({ value: n, label: `${n} g/m²` }))
    : Object.values(byMk).flat().filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      .map(n => ({ value: n, label: `${n} g/m²` }))

  return (
    <Row gutter={4} style={{ marginTop: 4 }} align="middle">
      <Col span={7}>
        <Text style={{ fontSize: 11 }}>{label}</Text>
      </Col>
      <Col span={9}>
        <Select
          size="small"
          style={{ width: '100%' }}
          showSearch
          allowClear
          placeholder="Mã KH"
          value={mkVal || undefined}
          options={mkList.map(mk => ({ value: mk, label: mk }))}
          onChange={v => setCI({ [mkField]: v ?? null, [dlField]: null })}
          filterOption={(input, opt) =>
            (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Col>
      <Col span={8}>
        <Select
          size="small"
          style={{ width: '100%' }}
          allowClear
          placeholder="g/m²"
          value={dlVal ?? undefined}
          options={dlOptions}
          onChange={v => setCI({ [dlField]: v ?? null })}
          notFoundContent="—"
        />
      </Col>
    </Row>
  )
}

// ─── Main component ─────────────────────────────────────────
export default function QuoteForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [headerForm] = Form.useForm()

  const [items, setItems] = useState<QuoteItem[]>([])
  const [currentItem, setCurrentItem] = useState<QuoteItem>(emptyItem())
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [customerOptions, setCustomerOptions] = useState<{ value: number; label: string }[]>([])

  const { data: phapNhanRaw } = useQuery({
    queryKey: ['phap-nhan'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
  })
  const phapNhanList = Array.isArray(phapNhanRaw) ? phapNhanRaw : []

  const { data: phanXuongRaw } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })
  const phanXuongList = Array.isArray(phanXuongRaw) ? phanXuongRaw : []

  const { data: nhanVienRaw } = useQuery({
    queryKey: ['nhan-vien-list'],
    queryFn: () => usersApi.list({ trang_thai: true }).then(r => r.data),
  })
  const nhanVienList = Array.isArray(nhanVienRaw) ? nhanVienRaw : []
  const [cauTrucModal, setCauTrucModal] = useState(false)
  const [productOptions, setProductOptions] = useState<{ value: number; label: string; record: ProductFull }[]>([])
  const [productSearching, setProductSearching] = useState(false)
  const [selectItemsModal, setSelectItemsModal] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([])
  const { mkList, byMk } = usePaperOptions()

  // Financial summary state
  const [finance, setFinance] = useState({
    chi_phi_bang_in: 0,
    chi_phi_khuon: 0,
    chi_phi_van_chuyen: 0,
    tong_tien_hang: 0,
    ty_le_vat: 8,
    tien_vat: 0,
    chi_phi_hang_hoa_dv: 0,
    tong_cong: 0,
    chi_phi_khac_1_ten: '',
    chi_phi_khac_1: 0,
    chi_phi_khac_2_ten: '',
    chi_phi_khac_2: 0,
    chiet_khau: 0,
    gia_ban: 0,
    gia_xuat_phoi_vsp: 0,
  })

  // Load existing quote for edit
  const { data: quoteData, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.get(Number(id)).then(r => r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (quoteData) {
      headerForm.setFieldsValue({
        customer_id: quoteData.customer_id,
        ngay_bao_gia: dayjs(quoteData.ngay_bao_gia),
        ngay_het_han: quoteData.ngay_het_han ? dayjs(quoteData.ngay_het_han) : null,
        phap_nhan_id: quoteData.phap_nhan_id ?? null,
        phap_nhan_sx_id: quoteData.phap_nhan_sx_id ?? null,
        phan_xuong_id: quoteData.phan_xuong_id ?? null,
        nv_phu_trach_id: quoteData.nv_phu_trach_id,
        nv_theo_doi_id: quoteData.nv_theo_doi_id ?? null,
        so_bg_copy: quoteData.so_bg_copy,
        ghi_chu: quoteData.ghi_chu,
        dieu_khoan: quoteData.dieu_khoan,
      })
      setItems(quoteData.items)
      setFinance({
        chi_phi_bang_in: Number(quoteData.chi_phi_bang_in),
        chi_phi_khuon: Number(quoteData.chi_phi_khuon),
        chi_phi_van_chuyen: Number(quoteData.chi_phi_van_chuyen),
        tong_tien_hang: Number(quoteData.tong_tien_hang),
        ty_le_vat: Number(quoteData.ty_le_vat),
        tien_vat: Number(quoteData.tien_vat),
        chi_phi_hang_hoa_dv: Number(quoteData.chi_phi_hang_hoa_dv),
        tong_cong: Number(quoteData.tong_cong),
        chi_phi_khac_1_ten: quoteData.chi_phi_khac_1_ten || '',
        chi_phi_khac_1: Number(quoteData.chi_phi_khac_1),
        chi_phi_khac_2_ten: quoteData.chi_phi_khac_2_ten || '',
        chi_phi_khac_2: Number(quoteData.chi_phi_khac_2),
        chiet_khau: Number(quoteData.chiet_khau),
        gia_ban: Number(quoteData.gia_ban),
        gia_xuat_phoi_vsp: Number(quoteData.gia_xuat_phoi_vsp),
      })
      if (quoteData.customer) {
        setCustomerOptions([{
          value: quoteData.customer_id,
          label: `${quoteData.customer.ten_viet_tat}${quoteData.customer.ten_don_vi ? ' – ' + quoteData.customer.ten_don_vi : ''}`,
        }])
      }
    }
  }, [quoteData, headerForm])

  // Auto-calculate VAT and total
  const recalcFinance = useCallback((f: typeof finance) => {
    const tienVat = Math.round(f.tong_tien_hang * f.ty_le_vat / 100)
    const chiPhiHhDv = f.tong_tien_hang + tienVat
    const tongCong = chiPhiHhDv + f.chi_phi_bang_in + f.chi_phi_khuon + f.chi_phi_van_chuyen
      + f.chi_phi_khac_1 + f.chi_phi_khac_2 - f.chiet_khau
    const giaBan = tongCong
    return { ...f, tien_vat: tienVat, chi_phi_hang_hoa_dv: chiPhiHhDv, tong_cong: tongCong, gia_ban: giaBan }
  }, [])

  const updateFinance = (patch: Partial<typeof finance>) => {
    setFinance(prev => recalcFinance({ ...prev, ...patch }))
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateQuotePayload) => quotesApi.create(data),
    onSuccess: (res) => {
      message.success(`Đã tạo báo giá ${res.data.so_bao_gia}`)
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate(`/quotes/${res.data.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo báo giá'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateQuotePayload>) => quotesApi.update(Number(id), data),
    onSuccess: () => {
      message.success('Đã cập nhật báo giá')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const approveMutation = useMutation({
    mutationFn: () => quotesApi.approve(Number(id)),
    onSuccess: () => {
      message.success('Đã duyệt báo giá')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })

  const taoDonMutation = useMutation({
    mutationFn: (ids: number[]) => quotesApi.taoDonHang(Number(id), ids.length < items.length ? ids : undefined),
    onSuccess: (res) => {
      message.success(`Đã tạo đơn hàng ${res.data.so_don}`)
      setSelectItemsModal(false)
      navigate('/sales/orders')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo đơn'),
  })

  // ── Customer search ──────────────────────────────────────
  const handleCustomerSearch = async (q: string) => {
    if (!q || q.length < 1) return
    const res = await customersApi.list({ search: q, page_size: 30 })
    setCustomerOptions(
      res.data.items.map(c => ({
        value: c.id,
        label: `${c.ten_viet_tat}${c.ten_don_vi ? ' – ' + c.ten_don_vi : ''}`,
      }))
    )
  }

  // ── Product search from catalog ───────────────────────────
  const handleProductSearch = async (q: string) => {
    if (!q || q.length < 1) return
    setProductSearching(true)
    try {
      const res = await productsApi.list({ search: q, page_size: 40 })
      setProductOptions(
        res.data.items.map(p => ({
          value: p.id,
          label: `[${p.ma_amis}] ${p.ten_hang}`,
          record: p,
        }))
      )
    } finally {
      setProductSearching(false)
    }
  }

  const handleProductSelect = (_val: number, opt: unknown) => {
    const p = (opt as { record: ProductFull }).record
    setCI({
      product_id: p.id,
      ma_amis: p.ma_amis,
      ten_hang: p.ten_hang,
      dvt: p.dvt,
      so_lop: p.so_lop,
      ...(p.dai != null ? { dai: p.dai } : {}),
      ...(p.rong != null ? { rong: p.rong } : {}),
      ...(p.cao != null ? { cao: p.cao } : {}),
    })
  }

  // ── Auto-generate tên hàng từ kích thước ─────────────────
  const autoGenName = (item: QuoteItem): string => {
    if (item.loai_thung === 'LOT') {
      return `Tấm ${item.so_lop}L`
    }
    if (item.dai && item.rong && item.cao) {
      return `Thùng Carton ${item.dai}x${item.rong}x${item.cao} ${item.so_lop}L`
    }
    return `Thùng Carton ${item.so_lop}L`
  }

  const handleAutoName = () => {
    setCI({ ten_hang: autoGenName(currentItem) })
  }

  // ── Item editing ─────────────────────────────────────────
  const setCI = (patch: Partial<QuoteItem>) =>
    setCurrentItem(prev => {
      const next = { ...prev, ...patch }

      // Auto-calculate kho_tt, dai_tt, dien_tich when relevant fields change
      const dimTriggers: (keyof QuoteItem)[] = ['loai_thung', 'dai', 'rong', 'cao', 'so_lop']
      const hasDimChange = Object.keys(patch).some(k => dimTriggers.includes(k as keyof QuoteItem))
      if (hasDimChange && !next.khong_ct) {
        const calc = calcBoxDimensions(next.loai_thung, next.dai, next.rong, next.cao, next.so_lop)
        if (calc) {
          next.kho_tt = calc.kho_tt
          next.dai_tt = calc.dai_tt
          next.dien_tich = calc.dien_tich
        }
      }

      // Khi khong_ct=true: tự tính dien_tich từ kho_tt * dai_tt nhập tay
      const khoTriggers: (keyof QuoteItem)[] = ['kho_tt', 'dai_tt', 'khong_ct']
      const hasKhoChange = Object.keys(patch).some(k => khoTriggers.includes(k as keyof QuoteItem))
      if (hasKhoChange && next.khong_ct && next.kho_tt && next.dai_tt) {
        next.dien_tich = Math.round(next.kho_tt * next.dai_tt / 10000 * 10000) / 10000
      }

      // Auto-generate tên hàng khi thay đổi kích thước/loại thùng,
      // chỉ áp dụng khi: không chọn từ catalog VÀ tên hiện tại rỗng hoặc là tên tự sinh
      if (hasDimChange && !next.product_id) {
        const isAutoName = !next.ten_hang
          || next.ten_hang.startsWith('Thùng Carton')
          || next.ten_hang.startsWith('Tấm ')
        if (isAutoName) {
          if (next.loai_thung === 'LOT') {
            next.ten_hang = `Tấm ${next.so_lop}L`
          } else if (next.dai && next.rong && next.cao) {
            next.ten_hang = `Thùng Carton ${next.dai}x${next.rong}x${next.cao} ${next.so_lop}L`
          } else if (next.loai_thung || next.so_lop) {
            next.ten_hang = `Thùng Carton ${next.so_lop}L`
          }
        }
      }

      // Auto-generate ghi_chu khi thay đổi bất kỳ field gia công/dịch vụ
      const hasAddonChange = Object.keys(patch).some(
        k => ADDON_TRIGGER_KEYS.includes(k as keyof QuoteItem)
      )
      if (hasAddonChange) {
        next.ghi_chu = buildGhiChu(next) || null
      }

      return next
    })

  const handleAddItem = () => {
    if (!currentItem.ten_hang) {
      message.warning('Vui lòng nhập tên hàng')
      return
    }
    let newItems: QuoteItem[]
    if (editingIdx !== null) {
      newItems = items.map((it, i) => i === editingIdx ? { ...currentItem, stt: it.stt } : it)
      setItems(newItems)
      setEditingIdx(null)
    } else {
      newItems = [...items, { ...currentItem, stt: items.length + 1 }]
      setItems(newItems)
    }
    // Auto-update tong_tien_hang = Σ (gia_ban * so_luong)
    const tongTienHang = newItems.reduce((sum, it) => sum + (it.gia_ban || 0) * (it.so_luong || 0), 0)
    updateFinance({ tong_tien_hang: tongTienHang })
    setCurrentItem(emptyItem())
    setProductOptions([])
  }

  const handleEditItem = (idx: number) => {
    const item = items[idx]
    setCurrentItem(item)
    setEditingIdx(idx)
    // Nếu dòng có product_id, inject option vào Select để hiển thị đúng
    if (item.product_id && item.ma_amis) {
      setProductOptions([{
        value: item.product_id,
        label: `[${item.ma_amis}] ${item.ten_hang}`,
        record: { id: item.product_id, ma_amis: item.ma_amis, ten_hang: item.ten_hang } as ProductFull,
      }])
    }
  }

  const handleDeleteItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, stt: i + 1 }))
    setItems(newItems)
    if (editingIdx === idx) { setCurrentItem(emptyItem()); setEditingIdx(null) }
    const tongTienHang = newItems.reduce((sum, it) => sum + (it.gia_ban || 0) * (it.so_luong || 0), 0)
    updateFinance({ tong_tien_hang: tongTienHang })
  }

  // Sao chép dòng → load vào editor để chỉnh sửa trước khi thêm
  const handleCopyItem = (idx: number) => {
    const { id: _id, stt: _stt, ...rest } = items[idx]
    setCurrentItem({ ...rest, stt: items.length + 1 })
    setEditingIdx(null)
    // Giữ lại product option nếu có
    if (rest.product_id && rest.ma_amis) {
      setProductOptions([{
        value: rest.product_id,
        label: `[${rest.ma_amis}] ${rest.ten_hang}`,
        record: { id: rest.product_id, ma_amis: rest.ma_amis, ten_hang: rest.ten_hang } as ProductFull,
      }])
    } else {
      setProductOptions([])
    }
    message.info('Đã sao chép — chỉnh sửa nếu cần rồi nhấn "Thêm vào danh sách"')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) { message.warning('Báo giá cần ít nhất 1 mặt hàng'); return }
    try {
      const vals = await headerForm.validateFields()
      const payload: CreateQuotePayload = {
        customer_id: vals.customer_id,
        ngay_bao_gia: vals.ngay_bao_gia.format('YYYY-MM-DD'),
        ngay_het_han: vals.ngay_het_han?.format('YYYY-MM-DD') || null,
        phap_nhan_id: vals.phap_nhan_id || null,
        phap_nhan_sx_id: vals.phap_nhan_sx_id || null,
        phan_xuong_id: vals.phan_xuong_id || null,
        nv_phu_trach_id: vals.nv_phu_trach_id || null,
        nv_theo_doi_id: vals.nv_theo_doi_id || null,
        so_bg_copy: vals.so_bg_copy || null,
        ghi_chu: vals.ghi_chu || null,
        dieu_khoan: vals.dieu_khoan || null,
        ...finance,
        items: items.map(({ id: _id, ...rest }) => rest),
      }
      if (isEdit) updateMutation.mutate(payload)
      else createMutation.mutate(payload)
    } catch {
      // validateFields() tự hiện lỗi inline trên form, không cần xử lý thêm
    }
  }

  // isReadonly: chỉ khoá khi ĐÃ có dữ liệu và trạng thái không phải 'moi'
  // (tránh khoá form trong khi đang loading quoteData)
  const isReadonly = isEdit && !!quoteData && quoteData.trang_thai !== 'moi'

  const itemColumns: ColumnsType<QuoteItem> = [
    { title: 'STT', dataIndex: 'stt', width: 45, align: 'center' },
    {
      title: 'Mã hàng',
      dataIndex: 'ma_amis',
      width: 100,
      render: (v: string) => v ? <Text code style={{ fontSize: 10 }}>{v}</Text> : '—',
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string, r: QuoteItem) => (
        <div>
          <Text>{v}</Text>
          {r.loai && <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>({r.loai})</Text>}
        </div>
      ),
    },
    { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
    { title: 'SL', dataIndex: 'so_luong', width: 65, align: 'right' },
    {
      title: 'Kết cấu',
      width: 90,
      render: (_: unknown, r: QuoteItem) => (
        <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
          <Tag style={{ fontSize: 10, margin: 0 }}>{r.so_lop}L</Tag>
          {r.to_hop_song && <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>{r.to_hop_song}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Loại thùng',
      dataIndex: 'loai_thung',
      width: 75,
      render: (v: string) => v ? <Tag style={{ fontSize: 10 }}>{v}</Tag> : '—',
    },
    {
      title: 'D×R×C (cm)',
      width: 120,
      render: (_: unknown, r: QuoteItem) =>
        r.dai ? `${r.dai}×${r.rong}×${r.cao}` : '—',
    },
    {
      title: 'S (m²)',
      dataIndex: 'dien_tich',
      width: 68,
      align: 'right' as const,
      render: (v: number | string | null) => (v != null && v !== '') ? Number(v).toFixed(4) : '—',
    },
    {
      title: 'Loại in',
      dataIndex: 'loai_in',
      width: 80,
      render: (v: string) => {
        const opt = LOAI_IN_OPTIONS.find(o => o.value === v)
        return opt?.value !== 'khong_in' ? <Tag color="purple" style={{ fontSize: 10 }}>{opt?.label}</Tag> : '—'
      },
    },
    {
      title: 'Giá bán',
      dataIndex: 'gia_ban',
      width: 105,
      align: 'right',
      render: (v: number) => v
        ? <Text strong style={{ color: '#f5222d' }}>{v.toLocaleString('vi-VN')}</Text>
        : '—',
    },
    !isReadonly ? {
      title: '',
      key: 'act',
      width: 110,
      render: (_: any, _row: QuoteItem, idx: number) => (
        <Space size={2}>
          <Tooltip title="Sao chép dòng này">
            <Button
              size="small"
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleCopyItem(idx)}
              style={{ color: '#1890ff' }}
            />
          </Tooltip>
          <Button size="small" type="link" onClick={() => handleEditItem(idx)}>Sửa</Button>
          <Popconfirm title="Xoá dòng này?" onConfirm={() => handleDeleteItem(idx)}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    } : {},
  ].filter(c => Object.keys(c).length > 0) as ColumnsType<QuoteItem>

  if (loadingQuote) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  const ci = currentItem

  return (
    <div style={{ maxWidth: 1600 }}>
      {/* ── Toolbar ──────────────────────────────────── */}
      <Card style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotes')}>
                Danh sách
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                {isEdit
                  ? `Báo giá: ${quoteData?.so_bao_gia}`
                  : 'Thêm báo giá mới'}
              </Title>
              {quoteData && (
                <Tag color={quoteData.trang_thai === 'moi' ? 'blue' : quoteData.trang_thai === 'da_duyet' ? 'green' : 'red'}>
                  {quoteData.trang_thai === 'moi' ? 'Mới' : quoteData.trang_thai === 'da_duyet' ? 'Đã duyệt' : quoteData.trang_thai}
                </Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              {!isReadonly && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={createMutation.isPending || updateMutation.isPending}
                  onClick={handleSubmit}
                >
                  {isEdit ? 'Lưu thay đổi' : 'Lưu báo giá'}
                </Button>
              )}
              {isEdit && quoteData?.trang_thai === 'moi' && (
                <Popconfirm
                  title="Duyệt báo giá này?"
                  description="Sau khi duyệt sẽ không thể chỉnh sửa nội dung báo giá."
                  onConfirm={() => approveMutation.mutate()}
                  okText="Duyệt"
                  cancelText="Huỷ"
                >
                  <Button icon={<CheckCircleOutlined />} type="primary" ghost>
                    Duyệt báo giá
                  </Button>
                </Popconfirm>
              )}
              {isEdit && quoteData?.trang_thai === 'da_duyet' && (
                <Button
                  type="primary"
                  icon={<FileAddOutlined />}
                  loading={taoDonMutation.isPending}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => {
                    const allIds = items.map(it => it.id).filter(Boolean) as number[]
                    setSelectedItemIds(allIds)
                    setSelectItemsModal(true)
                  }}
                >
                  Lập đơn hàng
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Header form ──────────────────────────────── */}
      <Card style={{ marginBottom: 12 }}>
        <Form form={headerForm} layout="vertical" disabled={isReadonly}>
          <Row gutter={12}>
            <Col span={4}>
              <Form.Item label="Số BG copy" name="so_bg_copy">
                <Input placeholder="Sao chép từ..." />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Ngày" name="ngay_bao_gia" initialValue={dayjs()} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="*Khách hàng" name="customer_id" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleCustomerSearch}
                  options={customerOptions}
                  placeholder="Tìm khách hàng..."
                  notFoundContent="Gõ để tìm..."
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Ngày hết hạn" name="ngay_het_han">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Pháp nhân" name="phap_nhan_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn pháp nhân..."
                  options={phapNhanList
                    .filter(p => p.trang_thai)
                    .map(p => ({ value: p.id, label: `[${p.ma_phap_nhan}] ${p.ten_viet_tat || p.ten_phap_nhan}` }))}
                  notFoundContent={
                    <div style={{ padding: '8px 4px', color: '#888', fontSize: 12 }}>
                      Chưa có pháp nhân.{' '}
                      <a href="/danhmuc/phap-nhan" target="_blank" rel="noreferrer">
                        Thêm tại Danh mục → Pháp nhân
                      </a>
                    </div>
                  }
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Nơi sản xuất" name="phan_xuong_id">
                <Select
                  allowClear
                  placeholder="Chọn phân xưởng..."
                  options={phanXuongList
                    .filter(p => p.trang_thai)
                    .map(p => ({ value: p.id, label: p.ten_xuong }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="NV phụ trách" name="nv_phu_trach_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn nhân viên..."
                  options={nhanVienList.map(nv => ({ value: nv.id, label: nv.ho_ten }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="NV theo dõi đơn hàng" name="nv_theo_doi_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn nhân viên..."
                  options={nhanVienList.map(nv => ({ value: nv.id, label: nv.ho_ten }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ── Line item editor ─────────────────────────── */}
      {!isReadonly && (
        <Card
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <Text strong>{editingIdx !== null ? `Sửa dòng ${editingIdx + 1}` : 'Thêm mặt hàng'}</Text>
              {editingIdx !== null && (
                <Button size="small" onClick={() => { setCurrentItem(emptyItem()); setEditingIdx(null); setProductOptions([]) }}>
                  Huỷ sửa
                </Button>
              )}
            </Space>
          }
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
              {editingIdx !== null ? 'Cập nhật dòng' : 'Thêm vào danh sách'}
            </Button>
          }
        >
          {/* Row 1: Product info */}
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col span={2}>
              <Input
                size="small"
                placeholder="Loại"
                value={ci.loai || ''}
                onChange={e => setCI({ loai: e.target.value })}
              />
            </Col>
            <Col span={5}>
              <Select
                size="small"
                style={{ width: '100%' }}
                showSearch
                allowClear
                filterOption={false}
                placeholder="🔍 Tìm SP từ danh mục..."
                value={ci.product_id ?? undefined}
                onSearch={handleProductSearch}
                onSelect={handleProductSelect}
                onClear={() => setCI({ product_id: null, ma_amis: null })}
                notFoundContent={productSearching ? <Spin size="small" /> : 'Gõ tên / mã AMIS...'}
                options={productOptions}
              />
            </Col>
            <Col span={9}>
              <Input
                size="small"
                placeholder="*Tên hàng"
                value={ci.ten_hang}
                onChange={e => setCI({ ten_hang: e.target.value, product_id: null, ma_amis: ci.ma_amis })}
                addonAfter={
                  <Tooltip title="Tự tạo tên: Thùng Carton DxRxC NL / Tấm NL">
                    <ThunderboltOutlined
                      style={{ cursor: 'pointer', color: '#fa8c16' }}
                      onClick={handleAutoName}
                    />
                  </Tooltip>
                }
              />
            </Col>
            <Col span={2}>
              <Input
                size="small"
                placeholder="ĐVT"
                value={ci.dvt}
                onChange={e => setCI({ dvt: e.target.value })}
              />
            </Col>
            <Col span={3}>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                placeholder="Số lượng BG"
                value={ci.so_luong}
                onChange={v => setCI({ so_luong: v || 0 })}
                min={0}
              />
            </Col>
            <Col span={3}>
              <Tooltip
                title={
                  ci.don_gia_m2 && ci.dien_tich
                    ? `Giá giấy: ${Math.round(ci.don_gia_m2 * ci.dien_tich).toLocaleString('vi-VN')}đ — Bấm để gợi ý giá (gồm hao hụt + lợi nhuận)`
                    : 'Nhập Đơn giá m² và Diện tích để gợi ý giá'
                }
              >
                <InputNumber
                  size="small"
                  style={{ width: '100%', borderColor: ci.gia_ban ? undefined : '#ff4d4f' }}
                  placeholder="Giá bán/thùng"
                  value={ci.gia_ban || undefined}
                  onChange={v => setCI({ gia_ban: v || 0 })}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                  addonAfter={
                    ci.don_gia_m2 && ci.dien_tich ? (
                      <span
                        style={{ cursor: 'pointer', fontSize: 10, color: '#1890ff' }}
                        onClick={() => {
                          const suggested = suggestGiaBan(ci.don_gia_m2!, ci.dien_tich!, ci.so_luong, ci.so_lop)
                          setCI({ gia_ban: suggested })
                        }}
                      >
                        Gợi ý
                      </span>
                    ) : undefined
                  }
                />
              </Tooltip>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0' }} />

          {/* Row 2: Three panels */}
          <Row gutter={8}>
            {/* LEFT: Loại giấy */}
            <Col span={6}>
              <div style={{ background: '#f0f5ff', padding: 8, borderRadius: 6, height: '100%' }}>
                <Row justify="space-between" align="middle">
                  <Col><Text strong style={{ fontSize: 12, color: '#1890ff' }}>LOẠI GIẤY</Text></Col>
                  <Col>
                    <Button
                      size="small"
                      type="link"
                      icon={<AppstoreOutlined />}
                      style={{ fontSize: 11, padding: '0 4px' }}
                      onClick={() => setCauTrucModal(true)}
                    >
                      Chọn kết cấu
                    </Button>
                  </Col>
                </Row>
                {/* Số lớp + Tổ hợp sóng */}
                <Row gutter={4} style={{ marginTop: 6 }}>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Số lớp</Text>
                    <Select
                      size="small" style={{ width: '100%' }}
                      value={ci.so_lop}
                      onChange={v => setCI({ so_lop: v, to_hop_song: null })}
                      options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))}
                    />
                  </Col>
                  <Col span={16}>
                    <Text style={{ fontSize: 11 }}>Tổ hợp sóng</Text>
                    <Select
                      size="small" style={{ width: '100%' }}
                      allowClear
                      placeholder="Chọn..."
                      value={ci.to_hop_song || undefined}
                      onChange={v => setCI({ to_hop_song: v ?? null })}
                      options={(TO_HOP_SONG_OPTIONS[ci.so_lop] ?? []).map(s => ({
                        value: s, label: s,
                      }))}
                      notFoundContent="Chọn số lớp trước"
                    />
                  </Col>
                </Row>

                {/* Header cột */}
                <Row gutter={4} style={{ marginTop: 8 }}>
                  <Col span={7} />
                  <Col span={9}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Mã KH đồng cấp</Text></Col>
                  <Col span={8}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Định lượng</Text></Col>
                </Row>

                {/* Mặt (lớp mặt ngoài) */}
                <LayerRow label="Mặt" mkField="mat" dlField="mat_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />

                {/* Sóng 1 + Mặt 1 */}
                <LayerRow
                  label={`Sóng ${getSongType(ci.to_hop_song, 0)}`}
                  mkField="song_1" dlField="song_1_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />
                <LayerRow label="Mặt 1" mkField="mat_1" dlField="mat_1_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />

                {/* 5+ lớp: Sóng 2 + Mặt 2 */}
                {ci.so_lop >= 5 && <>
                  <LayerRow
                    label={`Sóng ${getSongType(ci.to_hop_song, 1)}`}
                    mkField="song_2" dlField="song_2_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />
                  <LayerRow label="Mặt 2" mkField="mat_2" dlField="mat_2_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />
                </>}

                {/* 7 lớp: Sóng 3 + Mặt 3 */}
                {ci.so_lop >= 7 && <>
                  <LayerRow
                    label={`Sóng ${getSongType(ci.to_hop_song, 2)}`}
                    mkField="song_3" dlField="song_3_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />
                  <LayerRow label="Mặt 3" mkField="mat_3" dlField="mat_3_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} />
                </>}

                <Divider style={{ margin: '6px 0' }} />
                <Row style={{ marginTop: 2 }} align="middle">
                  <Col span={14}>
                    <Checkbox checked={ci.lay_gia_moi_nl}
                      onChange={e => setCI({ lay_gia_moi_nl: e.target.checked })}>
                      <Text style={{ fontSize: 11 }}>Lấy giá mới NL</Text>
                    </Checkbox>
                  </Col>
                </Row>
                <Row style={{ marginTop: 4 }} gutter={4} align="middle">
                  <Col span={8}><Text style={{ fontSize: 11 }}>Đơn giá m²</Text></Col>
                  <Col span={16}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={ci.don_gia_m2 || undefined}
                      onChange={v => setCI({ don_gia_m2: v })}
                      placeholder="0"
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Col>
                </Row>
              </div>
            </Col>

            {/* MIDDLE: Kích thước & In ấn */}
            <Col span={12}>
              <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#52c41a' }}>KÍCH THƯỚC & IN ẤN</Text>

                {/* Box dimensions */}
                <Row gutter={6} style={{ marginTop: 6 }}>
                  <Col span={6}>
                    <Text style={{ fontSize: 11 }}>Loại thùng</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={ci.loai_thung || undefined}
                      onChange={v => setCI({ loai_thung: v })}
                      allowClear
                      options={LOAI_THUNG_OPTIONS}
                    />
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 11 }}>Dài (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.dai || undefined}
                      onChange={v => setCI({ dai: v })} placeholder="0" min={0} step={0.1} />
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 11 }}>Rộng (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.rong || undefined}
                      onChange={v => setCI({ rong: v })} placeholder="0" min={0} step={0.1} />
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 11 }}>Cao (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.cao || undefined}
                      onChange={v => setCI({ cao: v })} placeholder="0" min={0} step={0.1} />
                  </Col>
                  <Col span={3}>
                    <Text style={{ fontSize: 11 }}>Khổ TT (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.kho_tt || undefined}
                      onChange={v => setCI({ kho_tt: v })} placeholder="auto" step={0.1} />
                  </Col>
                  <Col span={3}>
                    <Text style={{ fontSize: 11 }}>Dài TT (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.dai_tt || undefined}
                      onChange={v => setCI({ dai_tt: v })} placeholder="auto" step={0.1} />
                  </Col>
                </Row>
                <Row gutter={6} style={{ marginTop: 4 }}>
                  <Col span={6}>
                    <Tooltip title="Không tự động tính kích thước, nhập thủ công">
                      <Checkbox
                        checked={ci.khong_ct}
                        onChange={e => setCI({ khong_ct: e.target.checked })}
                      >
                        <Text style={{ fontSize: 11 }}>Không CT</Text>
                      </Checkbox>
                    </Tooltip>
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>
                      Diện tích (m²)
                      {!ci.khong_ct && ci.dien_tich ? (
                        <Text style={{ fontSize: 10, color: '#52c41a', marginLeft: 4 }}>tự tính</Text>
                      ) : null}
                    </Text>
                    <InputNumber size="small" style={{ width: '100%' }} value={ci.dien_tich || undefined}
                      onChange={v => setCI({ dien_tich: v })} placeholder="0" step={0.0001}
                      readOnly={!ci.khong_ct && Boolean(ci.loai_thung && ci.dai && ci.rong && ci.cao)}
                    />
                  </Col>
                  {ci.dien_tich && ci.don_gia_m2 ? (
                    <Col span={10}>
                      <Text style={{ fontSize: 11 }}>
                        Giá giấy ≈
                      </Text>
                      <Text style={{ fontSize: 11, color: '#f5222d', fontWeight: 600 }}>
                        {' '}{Math.round(ci.dien_tich * (ci.don_gia_m2 || 0)).toLocaleString('vi-VN')} đ
                      </Text>
                    </Col>
                  ) : null}
                </Row>

                <Divider style={{ margin: '6px 0' }} />

                {/* Printing */}
                <Row gutter={8} align="middle">
                  <Col>
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>Loại In: </Text>
                  </Col>
                  <Col>
                    <Radio.Group
                      size="small"
                      value={ci.loai_in}
                      onChange={e => setCI({ loai_in: e.target.value })}
                      options={LOAI_IN_OPTIONS}
                      optionType="button"
                    />
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 11 }}>Số màu: </Text>
                    <InputNumber
                      size="small"
                      style={{ width: 60 }}
                      value={ci.so_mau}
                      onChange={v => setCI({ so_mau: v || 0 })}
                      min={0}
                      max={10}
                    />
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 6 }}>
                  <Col>
                    <Space wrap size={[16, 4]}>
                      <Checkbox checked={ci.do_kho} onChange={e => setCI({ do_kho: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Độ khó</Text>
                      </Checkbox>
                      <Checkbox checked={ci.ghim} onChange={e => setCI({ ghim: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Ghim</Text>
                      </Checkbox>
                      <Checkbox checked={ci.chap_xa} onChange={e => setCI({ chap_xa: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>CHAP XÃ</Text>
                      </Checkbox>
                      <Checkbox checked={ci.do_phu} onChange={e => setCI({ do_phu: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Độ phủ</Text>
                      </Checkbox>
                      <Checkbox checked={ci.dan} onChange={e => setCI({ dan: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Dán</Text>
                      </Checkbox>
                      <Checkbox checked={ci.boi} onChange={e => setCI({ boi: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Bổi</Text>
                      </Checkbox>
                      <Checkbox checked={ci.be_lo} onChange={e => setCI({ be_lo: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Bê lỗ</Text>
                      </Checkbox>
                    </Space>
                  </Col>
                </Row>

                <Row gutter={8} style={{ marginTop: 6 }}>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Chống thấm</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="Không"
                      value={ci.c_tham || undefined}
                      onChange={v => setCI({ c_tham: v ?? null })}
                      options={[
                        { value: 'Không',  label: 'Không' },
                        { value: '1 mặt',  label: '1 mặt' },
                        { value: '2 mặt',  label: '2 mặt' },
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Cán màng</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="Không"
                      value={ci.can_man || undefined}
                      onChange={v => setCI({ can_man: v ?? null })}
                      options={[
                        { value: 'Không',  label: 'Không' },
                        { value: '1 mặt',  label: '1 mặt' },
                        { value: '2 mặt',  label: '2 mặt' },
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Số c bề</Text>
                    <Input size="small" value={ci.so_c_be || ''}
                      onChange={e => setCI({ so_c_be: e.target.value })} />
                  </Col>
                </Row>
                <Row gutter={8} style={{ marginTop: 4 }}>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Máy In</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="Chọn..."
                      value={ci.may_in || undefined}
                      onChange={v => setCI({ may_in: v ?? null })}
                      options={[
                        { value: '4 màu',   label: '4 màu' },
                        { value: '5 màu',   label: '5 màu' },
                        { value: '6 màu',   label: '6 màu' },
                        { value: 'in dọc',  label: 'In dọc' },
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Loại lằn</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      allowClear
                      placeholder="Chọn..."
                      value={ci.loai_lan || undefined}
                      onChange={v => setCI({ loai_lan: v ?? null })}
                      options={[
                        { value: 'lan_bang',     label: 'Lằn bằng' },
                        { value: 'lan_am_duong', label: 'Lằn âm dương' },
                      ]}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 11 }}>Bản vẽ KT</Text>
                    <Input size="small" value={ci.ban_ve_kt || ''}
                      onChange={e => setCI({ ban_ve_kt: e.target.value })} />
                  </Col>
                </Row>
                <Row style={{ marginTop: 4 }}>
                  <Col span={24}>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 2 }}>
                      <Col>
                        <Text style={{ fontSize: 11 }}>Ghi chú dòng</Text>
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                          (tự sinh từ gia công)
                        </Text>
                      </Col>
                      <Col>
                        <Tooltip title="Tự sinh lại ghi chú từ các chi tiết gia công">
                          <Button
                            size="small"
                            type="text"
                            icon={<SyncOutlined style={{ fontSize: 11 }} />}
                            style={{ height: 18, padding: '0 4px', fontSize: 11, color: '#1677ff' }}
                            onClick={() => setCI({ ghi_chu: buildGhiChu(ci) || null })}
                          >
                            Tự sinh
                          </Button>
                        </Tooltip>
                      </Col>
                    </Row>
                    <Input
                      size="small"
                      value={ci.ghi_chu || ''}
                      placeholder={buildGhiChu(ci) || 'Chưa có dịch vụ gia công'}
                      onChange={e => setCurrentItem(prev => ({ ...prev, ghi_chu: e.target.value || null }))}
                    />
                  </Col>
                </Row>
              </div>
            </Col>

            {/* RIGHT: Tài chính */}
            <Col span={6}>
              <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, height: '100%' }}>
                <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>TÀI CHÍNH</Text>

                {[
                  ['CP bảng in', 'chi_phi_bang_in'],
                  ['CP khuôn', 'chi_phi_khuon'],
                  ['CP vận chuyển', 'chi_phi_van_chuyen'],
                ].map(([label, field]) => (
                  <Row key={field} gutter={4} style={{ marginTop: 6 }} align="middle">
                    <Col span={12}><Text style={{ fontSize: 11 }}>{label}</Text></Col>
                    <Col span={12}>
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        value={(finance as any)[field]}
                        onChange={v => updateFinance({ [field]: v || 0 })}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        min={0}
                      />
                    </Col>
                  </Row>
                ))}

                <Divider style={{ margin: '6px 0' }} />

                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>Tổng tiền hàng</Text></Col>
                  <Col span={12}>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={finance.tong_tien_hang}
                      onChange={v => updateFinance({ tong_tien_hang: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={7}><Text style={{ fontSize: 11 }}>VAT %</Text></Col>
                  <Col span={5}>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={finance.ty_le_vat}
                      onChange={v => updateFinance({ ty_le_vat: v || 0 })}
                      min={0} max={30}
                    />
                  </Col>
                  <Col span={12}>
                    <InputNumber
                      size="small"
                      style={{ width: '100%' }}
                      value={finance.tien_vat}
                      readOnly
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>CP HH và DV</Text></Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.chi_phi_hang_hoa_dv} readOnly
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>

                <Divider style={{ margin: '6px 0' }} />

                {/* Chi phí khác */}
                <Row gutter={4} style={{ marginTop: 4 }}>
                  <Col span={12}>
                    <Input size="small" placeholder="CP khác 1 tên"
                      value={finance.chi_phi_khac_1_ten}
                      onChange={e => updateFinance({ chi_phi_khac_1_ten: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.chi_phi_khac_1}
                      onChange={v => updateFinance({ chi_phi_khac_1: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }}>
                  <Col span={12}>
                    <Input size="small" placeholder="CP khác 2 tên"
                      value={finance.chi_phi_khac_2_ten}
                      onChange={e => updateFinance({ chi_phi_khac_2_ten: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.chi_phi_khac_2}
                      onChange={v => updateFinance({ chi_phi_khac_2: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>Chiết khấu</Text></Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.chiet_khau}
                      onChange={v => updateFinance({ chiet_khau: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>

                <Divider style={{ margin: '6px 0' }} />

                <Row gutter={4} align="middle">
                  <Col span={12}><Text strong style={{ fontSize: 12 }}>Tổng cộng</Text></Col>
                  <Col span={12}>
                    <Text strong style={{ fontSize: 13, color: '#f5222d' }}>
                      {finance.tong_cong.toLocaleString('vi-VN')} ₫
                    </Text>
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>Giá bán</Text></Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.gia_ban}
                      onChange={v => updateFinance({ gia_ban: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>GX phôi VSP</Text></Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={finance.gia_xuat_phoi_vsp}
                      onChange={v => updateFinance({ gia_xuat_phoi_vsp: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* ── Ghi chú & Điều khoản ─────────────────────── */}
      <Card style={{ marginBottom: 12 }}>
        <Form form={headerForm} layout="vertical" disabled={isReadonly}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input.TextArea rows={3} placeholder="Ghi chú báo giá..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Điều khoản" name="dieu_khoan">
                <Input.TextArea rows={3} placeholder="Điều khoản thanh toán, giao hàng..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* ── Items table ───────────────────────────────── */}
      <Card title={<Text strong>Chi tiết mặt hàng ({items.length} dòng)</Text>}>
        <Table
          rowKey="stt"
          dataSource={items}
          columns={itemColumns}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          onRow={(_, idx) => ({
            onDoubleClick: () => !isReadonly && idx !== undefined && handleEditItem(idx),
            style: { cursor: isReadonly ? 'default' : 'pointer' },
          })}
        />
      </Card>

      {/* ── Kết cấu quick-select modal ────────────────── */}
      <CauTrucModal
        open={cauTrucModal}
        soLop={currentItem.so_lop}
        onClose={() => setCauTrucModal(false)}
        onSelect={(ct) => {
          setCI({
            so_lop: ct.so_lop,
            to_hop_song: ct.to_hop_song,
            mat: ct.mat,       mat_dl: ct.mat_dl,
            song_1: ct.song_1, song_1_dl: ct.song_1_dl,
            mat_1: ct.mat_1,   mat_1_dl: ct.mat_1_dl,
            song_2: ct.song_2, song_2_dl: ct.song_2_dl,
            mat_2: ct.mat_2,   mat_2_dl: ct.mat_2_dl,
            song_3: ct.song_3, song_3_dl: ct.song_3_dl,
            mat_3: ct.mat_3,   mat_3_dl: ct.mat_3_dl,
          })
          setCauTrucModal(false)
          message.success(`Đã chọn: ${ct.ten_cau_truc}`)
        }}
      />

      {/* ── Chọn mặt hàng để lập đơn ──────────────────── */}
      <Modal
        title="Chọn mặt hàng để lập đơn hàng"
        open={selectItemsModal}
        onCancel={() => setSelectItemsModal(false)}
        onOk={() => taoDonMutation.mutate(selectedItemIds)}
        okText="Lập đơn"
        cancelText="Huỷ"
        confirmLoading={taoDonMutation.isPending}
        okButtonProps={{ disabled: selectedItemIds.length === 0 }}
        width={700}
      >
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Button size="small" onClick={() => setSelectedItemIds(items.map(it => it.id).filter(Boolean) as number[])}>
              Chọn tất cả
            </Button>
            <Button size="small" onClick={() => setSelectedItemIds([])}>Bỏ chọn tất cả</Button>
            <Text type="secondary">Đã chọn {selectedItemIds.length}/{items.length} mặt hàng</Text>
          </Space>
        </div>
        <Table
          size="small"
          pagination={false}
          dataSource={items}
          rowKey={r => String(r.id ?? r.stt)}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedItemIds,
            onChange: (keys) => setSelectedItemIds(keys as number[]),
            getCheckboxProps: (r) => ({ disabled: !r.id }),
          }}
          columns={[
            { title: 'STT', dataIndex: 'stt', width: 48, align: 'center' },
            { title: 'Mã hàng', dataIndex: 'ma_amis', width: 100, render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
            { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
            { title: 'SL', dataIndex: 'so_luong', width: 60, align: 'right' },
            {
              title: 'Giá bán',
              dataIndex: 'gia_ban',
              width: 110,
              align: 'right',
              render: (v: number) => v ? <Text style={{ color: '#f5222d' }}>{v.toLocaleString('vi-VN')}</Text> : '—',
            },
          ]}
        />
      </Modal>
    </div>
  )
}

// ─── Kết cấu quick-select modal ──────────────────────────────
function CauTrucModal({
  open, soLop, onClose, onSelect,
}: {
  open: boolean
  soLop: number
  onClose: () => void
  onSelect: (ct: CauTruc) => void
}) {
  const [filterLop, setFilterLop] = useState<number | undefined>(undefined)

  const { data = [], isLoading } = useQuery({
    queryKey: ['cau-truc', filterLop],
    queryFn: () => cauTrucApi.list({ so_lop: filterLop, active_only: true }).then(r => r.data),
    enabled: open,
  })

  const cols: ColumnsType<CauTruc> = [
    {
      title: 'Tên kết cấu',
      dataIndex: 'ten_cau_truc',
      render: (v: string, r: CauTruc) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          {r.ghi_chu && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.ghi_chu}</Text>}
        </div>
      ),
    },
    {
      title: 'Lớp',
      dataIndex: 'so_lop',
      width: 60,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}L</Tag>,
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 60,
      align: 'center' as const,
      render: (v: string) => v ? <Tag color="geekblue">{v}</Tag> : '—',
    },
    {
      title: 'Cấu trúc lớp giấy',
      render: (_: unknown, r: CauTruc) => {
        // Build layer sequence: Mặt / Sóng1 / Mặt1 / Sóng2 / Mặt2 ...
        const layers: { label: string; code: string | null; isSong: boolean }[] = [
          { label: 'Mặt', code: r.mat, isSong: false },
          { label: 'Sóng 1', code: r.song_1, isSong: true },
          { label: 'Mặt 1', code: r.mat_1, isSong: false },
          ...(r.so_lop >= 5 ? [
            { label: 'Sóng 2', code: r.song_2, isSong: true },
            { label: 'Mặt 2', code: r.mat_2, isSong: false },
          ] : []),
          ...(r.so_lop >= 7 ? [
            { label: 'Sóng 3', code: r.song_3, isSong: true },
            { label: 'Mặt 3', code: r.mat_3, isSong: false },
          ] : []),
        ]
        const hasAny = layers.some(l => l.code)
        if (!hasAny) {
          // Only to_hop_song defined — show structural diagram
          const songs = r.to_hop_song ? r.to_hop_song.split('') : []
          const numMat = r.so_lop === 3 ? 2 : r.so_lop === 5 ? 3 : 4
          return (
            <Space size={2}>
              {Array.from({ length: numMat }).map((_, i) => (
                <>
                  <Tag key={`m${i}`} style={{ fontSize: 11, background: '#f5f5f5', margin: '1px' }}>Mặt</Tag>
                  {i < songs.length && (
                    <Tag key={`s${i}`} color="blue" style={{ fontSize: 11, margin: '1px' }}>
                      Sóng {songs[i]}
                    </Tag>
                  )}
                </>
              ))}
            </Space>
          )
        }
        return (
          <Space wrap size={[2, 2]}>
            {layers.map((l, i) => (
              <Tooltip key={i} title={l.label}>
                <Tag
                  color={l.isSong ? 'blue' : undefined}
                  style={{ fontSize: 11, margin: '1px' }}
                >
                  {l.code || <span style={{ color: '#bfbfbf' }}>—</span>}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        )
      },
    },
    {
      title: '',
      width: 80,
      render: (_: unknown, r: CauTruc) => (
        <Button
          type="primary"
          size="small"
          onClick={() => onSelect(r)}
        >
          Chọn
        </Button>
      ),
    },
  ]

  return (
    <Modal
      title={
        <Space>
          <AppstoreOutlined />
          <span>Chọn kết cấu giấy thông dụng</span>
          <Badge count={data.length} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      destroyOnClose
    >
      <Space style={{ marginBottom: 12 }}>
        <Text>Lọc:</Text>
        {[undefined, 3, 5, 7].map(n => (
          <Button
            key={String(n)}
            size="small"
            type={filterLop === n ? 'primary' : 'default'}
            onClick={() => setFilterLop(n)}
          >
            {n === undefined ? 'Tất cả' : `${n} lớp`}
          </Button>
        ))}
      </Space>
      <Table
        rowKey="id"
        dataSource={data}
        columns={cols}
        loading={isLoading}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
        onRow={(r) => ({
          onDoubleClick: () => onSelect(r),
          style: { cursor: 'pointer' },
        })}
      />
      <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
        Nhấn đôi vào dòng hoặc nút Chọn để áp dụng kết cấu. Quản lý tại: Danh mục → Kết cấu thông dụng
      </Text>
    </Modal>
  )
}
