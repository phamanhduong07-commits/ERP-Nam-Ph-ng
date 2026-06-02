import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form, Input, InputNumber, Select, DatePicker, Checkbox, Radio, Switch,
  Button, Card, Row, Col, Table, Space, Typography, Divider,
  message, Spin, Tag, Tooltip, Popconfirm, Modal, Badge,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined,
  ArrowLeftOutlined, FileAddOutlined, AppstoreOutlined, CopyOutlined,
  ThunderboltOutlined, SyncOutlined, SendOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { quotesApi, paperMaterialsApi, LOAI_IN_OPTIONS, LOAI_THUNG_OPTIONS, LOAI_BE_OPTIONS, DIE_CUT_TYPES, SO_LOP_OPTIONS, TO_HOP_SONG_OPTIONS, getSongType, calcBoxDimensions, calcOffsetCost, calcOffsetSheetDims, buildPaperSymbol, paperCodeKey, calcDonGiaM2 } from '../../api/quotes'
import type { QuoteItem, CreateQuotePayload } from '../../api/quotes'
import { temPaperPricesApi } from '../../api/temPaperPrices'
import { offsetAddonPricesApi } from '../../api/offsetAddonPrices'
import type { OffsetAddonPrice } from '../../api/offsetAddonPrices'

interface AxiosErrorLike { response?: { data?: { detail?: string } }; errorFields?: unknown }
function apiErrorMsg(e: unknown, fallback: string): string {
  return (e as AxiosErrorLike)?.response?.data?.detail || fallback
}
import { cauTrucApi, type CauTruc } from '../../api/cauTruc'
import { productsApi, type ProductFull } from '../../api/products'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { usersApi } from '../../api/usersApi'
import { useAuthStore } from '../../store/auth'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

// Grouped options for Ant Design Select
const LOAI_THUNG_GROUPED = [
  { label: 'Thùng', options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Thùng') },
  { label: 'Hộp',   options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Hộp') },
  { label: 'Khay',  options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Khay') },
]

const TEM_LOAI_GIAY_OPTIONS = [
  { value: 'duplex',  label: 'Duplex (DUP)' },
  { value: 'ivory',   label: 'Ivory' },
  { value: 'couche',  label: 'Couche' },
  { value: 'kraft',   label: 'Kraft' },
]

const NHOM_SAN_PHAM_OPTIONS = [
  { value: 'thung', label: 'Thùng' },
  { value: 'hop',   label: 'Hộp' },
  { value: 'khay',  label: 'Khay' },
]

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

  // Dịch vụ checkbox
  if (ci.boi)     parts.push('Bồi')
  if (ci.ghim)    parts.push('Ghim')
  if (ci.dan)     parts.push('Dán')
  if (ci.chap_xa) parts.push('CX')       // Chạp xả
  if (ci.be_lo)   parts.push('BL')       // Bê lỗ
  if (ci.do_kho)  parts.push('SP khó')

  // Bế khuôn: Bế 3c
  if (ci.be_so_con && ci.be_so_con > 1) {
    parts.push(`Bế ${ci.be_so_con}c`)
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
  'c_tham', 'can_man',
  'may_in', 'loai_lan', 'ban_ve_kt',
]

// ─── Empty item template ────────────────────────────────────
const emptyItem = (): QuoteItem => ({
  stt: 1,
  product_id: null,
  loai: null,
  ma_amis: null,
  ma_ky_hieu: null,
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
  loai_be: null, kho_sx: null, dai_sx: null,
  nhom_san_pham: null,
  co_tem_offset: false,
  tem_loai_giay: null, tem_gsm: null, tem_don_gia_kg: null,
  tem_dai_to: null, tem_rong_to: null,
  tem_sp_per_to: 2, tem_waste_to: 150, tem_so_mau: 0,
  tem_gia_kem_mau: null, tem_gia_in_1000to: null,
  tem_co_can_mang: false, tem_gia_can_mang_m2: null,
  tem_co_khuon_be: false, tem_gia_khuon_be: null, tem_khuon_be_phan_bo: 10000,
  tem_co_uv: false, tem_gia_uv_m2: null,
  tem_co_suppo: false, tem_gia_suppo_m2: null,
  tem_co_luoi: false, tem_gia_luoi_m2: null,
  tem_hai_manh: false,
  tem_khac_thiet_ke: false,
  loai_in: 'khong_in',
  do_kho: false, ghim: false, chap_xa: false,
  do_phu: false, dan: false, boi: false, be_lo: false,
  c_tham: null, can_man: null, be_so_con: null,
  may_in: null, loai_lan: null, ban_ve_kt: null,
  gia_ban: 0,
  gia_phoi: 0,
  gia_noi_bo: 0,
  ghi_chu: null,
  phan_xuong_id: null,
})

// ─── Hook: load distinct ma_ky_hieu + dinh_luong từ backend ─────────────────
function usePaperOptions() {
  const [mkList, setMkList] = useState<string[]>([])
  const [byMk, setByMk] = useState<Record<string, number[]>>({})
  const [paperCodes, setPaperCodes] = useState<Record<string, string>>({})
  const [rawToMk, setRawToMk] = useState<Record<string, string>>({})
  const [giaBanMap, setGiaBanMap] = useState<Record<string, number>>({})
  const loaded = useRef(false)
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    paperMaterialsApi.options().then(res => {
      setMkList(res.data.ma_ky_hieu)
      setByMk(res.data.by_mk)
      setPaperCodes(res.data.paper_codes || {})
      setRawToMk(res.data.raw_to_mk || {})
      setGiaBanMap(res.data.gia_ban_map || {})
    })
  }, [])
  return { mkList, byMk, paperCodes, rawToMk, giaBanMap }
}

// ─── LayerRow: 1 dòng lớp giấy với Mã KH + Định lượng ───────────────────────
function LayerRow({
  label, mkField, dlField, ci, setCI, mkList, byMk, paperCodes,
}: {
  label: string
  mkField: keyof QuoteItem
  dlField: keyof QuoteItem
  ci: QuoteItem
  setCI: (p: Partial<QuoteItem>) => void
  mkList: string[]
  byMk: Record<string, number[]>
  paperCodes: Record<string, string>
}) {
  const mkVal = ci[mkField] as string | null | undefined
  const dlVal = ci[dlField] as number | null | undefined
  const paperLabel = (mk: string) =>
    paperCodes[paperCodeKey(mk, dlVal)] || paperCodes[paperCodeKey(mk, null)] || mk
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
          placeholder="Mã giấy"
          value={mkVal || undefined}
          options={mkList.map(mk => ({ value: mk, label: paperLabel(mk) }))}
          onChange={v => {
            const dlOpts = v ? (byMk[v] ?? []) : []
            setCI({ [mkField]: v ?? null, [dlField]: dlOpts.length === 1 ? dlOpts[0] : null })
          }}
          filterOption={(input, opt) =>
            `${opt?.value ?? ''} ${opt?.label ?? ''}`.toLowerCase().includes(input.toLowerCase())
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
  const [customerSearching, setCustomerSearching] = useState(false)
  const [isCalcLoading, setIsCalcLoading] = useState(false)
  const role = useAuthStore(s => s.user?.role)
  const hideCostDetails = role === 'SALE_ADMIN' || role === 'TRUONG_PHONG_SALE_ADMIN'
  const canApprove = role === 'ADMIN' || role === 'GIAM_DOC' || role === 'TRUONG_PHONG_SALE_ADMIN'

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
  const { mkList, byMk, paperCodes, rawToMk, giaBanMap } = usePaperOptions()
  const giaBanManualRef = useRef(false)
  const financeGiaBanLockRef = useRef(false)  // lock finance.gia_ban khi lấy từ catalog

  const { data: temPaperList = [] } = useQuery({
    queryKey: ['tem-paper-prices'],
    queryFn: () => temPaperPricesApi.list(true).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: offsetAddonList = [] } = useQuery({
    queryKey: ['offset-addon-prices'],
    queryFn: () => offsetAddonPricesApi.list(true).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const getAddonPrice = (loai: string): OffsetAddonPrice | undefined =>
    offsetAddonList.find(p => p.loai_addon === loai)

  const priceCalcSeq = useRef(0)
  const confirmOpenRef = useRef(false)

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
    gia_phoi: 0,
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
        gia_phoi: Number(quoteData.items?.[0]?.gia_phoi || 0),
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
    return { ...f, tien_vat: tienVat, chi_phi_hang_hoa_dv: chiPhiHhDv, tong_cong: tongCong }
  }, [])

  const updateFinance = (patch: Partial<typeof finance>) => {
    setFinance(prev => recalcFinance({ ...prev, ...patch }))
  }

  const hasFormulaPriceData = (item: QuoteItem) => {
    if (![3, 5, 7].includes(item.so_lop)) return false
    if (!item.loai_thung || item.loai_thung === 'KHAC') return false
    const needsCao = item.loai_thung !== 'LOT'
    if (!item.dai || !item.rong || !item.to_hop_song || !item.so_luong) return false
    if (needsCao && item.cao == null) return false
    const layers: [keyof QuoteItem, keyof QuoteItem][] = [
      ['mat', 'mat_dl'],
      ['song_1', 'song_1_dl'],
      ['mat_1', 'mat_1_dl'],
    ]
    if (item.so_lop >= 5) layers.push(['song_2', 'song_2_dl'], ['mat_2', 'mat_2_dl'])
    if (item.so_lop >= 7) layers.push(['song_3', 'song_3_dl'], ['mat_3', 'mat_3_dl'])
    return layers.every(([codeKey, dlKey]) => Boolean(item[codeKey]) && Boolean(item[dlKey]))
  }

  const canCalculateItemPrice = (item: QuoteItem) =>
    !giaBanManualRef.current && hasFormulaPriceData(item)

  const applyFormulaPrice = useCallback(async (item: QuoteItem, force = false) => {
    if (!force && !canCalculateItemPrice(item)) return
    const seq = ++priceCalcSeq.current
    if (force) setIsCalcLoading(true)
    try {
      const res = await quotesApi.calculateItemPrice(item)
      if (seq !== priceCalcSeq.current) return
      const giaBan = Number(res.data.gia_ban || 0)
      const giaPhoi = Number(res.data.gia_phoi || 0)
      const giaNB = Number(res.data.gia_noi_bo || 0)
      if (giaBan > 0) {
        // Item row gia_ban: luôn cập nhật từ công thức (trừ khi user nhập tay)
        if (force || !giaBanManualRef.current) {
          setCurrentItem(prev => ({ ...prev, gia_ban: giaBan, gia_phoi: giaPhoi, gia_noi_bo: giaNB }))
        }
        // Finance: gia_phoi + gia_noi_bo luôn cập nhật; gia_ban chỉ update khi không lock
        if (force) financeGiaBanLockRef.current = false
        setFinance(prev => recalcFinance({
          ...prev,
          gia_ban: (force || !financeGiaBanLockRef.current) ? giaBan : prev.gia_ban,
          gia_phoi: giaPhoi,
          gia_xuat_phoi_vsp: giaNB,
        }))
      } else if (force) {
        message.warning('Công thức trả về giá bán bằng 0. Kiểm tra giá mua giấy và định mức chi phí.')
      }
    } catch (err: unknown) {
      const detail = (err as AxiosErrorLike)?.response?.data?.detail
      if (force) message.warning(detail || 'Chưa đủ dữ liệu hoặc chưa tìm được giá giấy để tính giá bán')
    } finally {
      if (force) setIsCalcLoading(false)
    }
  }, [recalcFinance])

  const createMutation = useMutation({
    mutationFn: (data: CreateQuotePayload) => quotesApi.create(data),
    onSuccess: (res) => {
      message.success(`Đã tạo báo giá ${res.data.so_bao_gia}`)
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate(`/quotes/${res.data.id}`)
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, 'Lỗi tạo báo giá')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateQuotePayload>) => quotesApi.update(Number(id), data),
    onSuccess: () => {
      message.success('Đã cập nhật báo giá')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, 'Lỗi cập nhật')),
  })

  const submitMutation = useMutation({
    mutationFn: () => quotesApi.submit(Number(id)),
    onSuccess: () => {
      message.success('Đã gửi báo giá để duyệt')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      navigate(`/quotes/${id}`)
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, 'Gửi duyệt thất bại')),
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
    onError: (e: unknown) => message.error(apiErrorMsg(e, 'Lỗi tạo đơn')),
  })

  // ── Customer search ──────────────────────────────────────
  const handleCustomerSearch = async (q: string) => {
    if (!q || q.length < 1) return
    setCustomerSearching(true)
    try {
      const res = await customersApi.list({ search: q, page_size: 30 })
      setCustomerOptions(
        res.data.items.map(c => ({
          value: c.id,
          label: `${c.ten_viet_tat}${c.ten_don_vi ? ' – ' + c.ten_don_vi : ''}`,
        }))
      )
    } finally {
      setCustomerSearching(false)
    }
  }

  // ── Product search from catalog ───────────────────────────
  const loadProductOptions = async (q: string) => {
    const customerId = headerForm.getFieldValue('customer_id') as number | undefined
    // Nếu không có KH và không có query → không load
    if (!customerId && (!q || q.length < 1)) return
    setProductSearching(true)
    try {
      const res = await productsApi.list({
        search: q,
        page_size: 50,
        ...(customerId ? { ma_kh_id: customerId } : {}),
      })
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

  const handleProductSearch = (q: string) => { loadProductOptions(q) }

  // Khi dropdown mở: nếu đã chọn KH mà chưa có options → auto-load
  const handleProductDropdownOpen = (open: boolean) => {
    if (open && productOptions.length === 0) {
      loadProductOptions('')
    }
  }

  const _loaiInStr = (v: number) => v === 1 ? 'flexo' : v === 2 ? 'ky_thuat_so' : 'khong_in'
  const _coverageStr = (v: number) => v === 1 ? '1 mặt' : v === 2 ? '2 mặt' : null
  const _loaiLanStr = (v: string | null) =>
    v === 'bang' ? 'lan_bang' : v === 'am_duong' ? 'lan_am_duong' : null
  const _deriveToHopSong = (p: ProductFull): string | null => {
    const parts: string[] = []
    if (p.song_1) parts.push('B')
    if (p.song_2) parts.push('C')
    if (p.song_3) parts.push('E')
    return parts.join('') || null
  }

  // Chuyển giá trị loai_thung cũ (text) → code mới cho calcBoxDimensions
  // startsWith ASCII prefix: immune với NFC/NFD encoding của ký tự tiếng Việt đằng sau
  // NFC-normalize cả hai phía cho Vietnamese exact-match
  const normalizeLoaiThung = (v: string | null): string | null => {
    if (!v) return null
    // Đã là code mới → giữ nguyên
    const VALID_CODES = new Set(['A1','A3','A5','A5_DAY','A5_NAP','A7','GOI_GIUA','GOI_SUON','LOT','KHAC',
      'HOP_CAI','HOP_CAI_CHAU','HOP_GIAY','HOP_PIZZA','HOP_DAY_NGAN','HOP_DUOI_CA','HOP_PIZZA_CO_TAY','KHAY_1','KHAY_2','KHAY_3'])
    if (VALID_CODES.has(v)) return v
    // ASCII prefix check: 'A1-', 'A3-', 'A5-', 'A7-' → safe dù encoding tiếng Việt phía sau thế nào
    if (v.startsWith('A1-')) return 'A1'
    if (v.startsWith('A3-')) return 'A3'
    if (v.startsWith('A5-')) return 'A5_DAY'
    if (v.startsWith('A7-')) return 'A7'
    // Vietnamese exact-match (NFC normalize để tránh NFD mismatch)
    const n = v.normalize('NFC')
    if (n === 'Gói giữa')  return 'GOI_GIUA'
    if (n === 'Gói sườn')  return 'GOI_SUON'
    if (n === 'Tấm lót')   return 'LOT'
    if (n === 'Tấm lót bế') return 'LOT'
    if (n === 'Tấm bế')    return 'LOT'
    return v
  }

  const _applyProductToCI = (p: ProductFull) => {
    // Convert ma_chinh (full raw code) → ma_ky_hieu (short code dùng trong form)
    const toMk = (raw: string | null) => raw ? (rawToMk[raw] ?? raw) : null
    const productGiaBan = p.gia_ban ? Number(p.gia_ban) : 0
    giaBanManualRef.current = false  // item gia_ban luôn dùng công thức
    financeGiaBanLockRef.current = productGiaBan > 0  // finance.gia_ban lock nếu catalog có giá
    if (productGiaBan > 0) {
      setFinance(prev => recalcFinance({ ...prev, gia_ban: productGiaBan }))
    }
    setCI({
      product_id: p.id,
      ma_amis: p.ma_amis,
      ten_hang: p.ten_hang,
      dvt: p.dvt,
      so_lop: p.so_lop,
      to_hop_song: _deriveToHopSong(p),
      ...(p.dai != null ? { dai: Number(p.dai) } : {}),
      ...(p.rong != null ? { rong: Number(p.rong) } : {}),
      ...(p.cao != null ? { cao: Number(p.cao) } : {}),
      // addon
      loai_in: _loaiInStr(p.loai_in ?? 0),
      so_mau: p.so_mau ?? 0,
      ghim: p.ghim ?? false,
      dan: p.dan ?? false,
      chap_xa: !!(p.chap_xa),
      boi: !!(p.boi),
      be_so_con: p.be_so_con ?? 0,
      c_tham: _coverageStr(p.chong_tham ?? 0),
      can_man: _coverageStr(p.can_mang ?? 0),
      loai_lan: _loaiLanStr(p.loai_lan ?? null),
      // Chỉ override loai_thung nếu sản phẩm có giá trị — không xoá loai_thung đã chọn
      // normalizeLoaiThung chuyển format cũ ("A1-Thùng thường") → code mới ("A1")
      ...(p.loai_thung != null ? { loai_thung: normalizeLoaiThung(p.loai_thung) } : {}),
      // kết cấu giấy — convert raw code → ma_ky_hieu
      mat: toMk(p.mat),         mat_dl: p.mat_dl ? Number(p.mat_dl) : null,
      song_1: toMk(p.song_1),   song_1_dl: p.song_1_dl ? Number(p.song_1_dl) : null,
      mat_1: toMk(p.mat_1),     mat_1_dl: p.mat_1_dl ? Number(p.mat_1_dl) : null,
      song_2: toMk(p.song_2),   song_2_dl: p.song_2_dl ? Number(p.song_2_dl) : null,
      mat_2: toMk(p.mat_2),     mat_2_dl: p.mat_2_dl ? Number(p.mat_2_dl) : null,
      song_3: toMk(p.song_3),   song_3_dl: p.song_3_dl ? Number(p.song_3_dl) : null,
      mat_3: toMk(p.mat_3),     mat_3_dl: p.mat_3_dl ? Number(p.mat_3_dl) : null,
      // giá từ danh mục
      ...(p.gia_ban ? { gia_ban: Number(p.gia_ban) } : {}),
    })
  }

  const handleProductSelect = async (val: number) => {
    // Fetch full product detail to get kết cấu + addon fields
    try {
      const res = await productsApi.get(val)
      _applyProductToCI(res.data)
    } catch {
      // Fallback: dùng data từ option nếu fetch lỗi
      const opt = productOptions.find(o => o.value === val)
      if (opt) _applyProductToCI(opt.record)
    }
  }

  // ── Auto-generate tên hàng từ kích thước ─────────────────
  const autoGenName = (item: QuoteItem): string => {
    if (item.loai_thung === 'LOT') {
      return `Tấm ${item.so_lop}L`
    }
    if (item.dai && item.rong && item.cao != null) {
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
      const formulaTriggers = [
        'so_lop', 'to_hop_song', 'so_luong', 'loai_thung', 'dai', 'rong', 'cao',
        'kho_tt', 'dai_tt', 'dien_tich', 'khong_ct',
        'mat', 'mat_dl', 'song_1', 'song_1_dl', 'mat_1', 'mat_1_dl',
        'song_2', 'song_2_dl', 'mat_2', 'mat_2_dl', 'song_3', 'song_3_dl', 'mat_3', 'mat_3_dl',
        'loai_in', 'so_mau', 'do_phu', 'c_tham', 'can_man', 'chap_xa',
        'boi', 'be_lo', 'dan', 'ghim', 'do_kho',
      ]
      // so_luong ảnh hưởng hao_hút → formula recalc, nhưng không unlock giá đã lock từ catalog
      const giaBanResetTriggers = formulaTriggers.filter(k => k !== 'so_luong')
      const hasFormulaChange = Object.keys(patch).some(k => formulaTriggers.includes(k))
      const hasGiaBanResetChange = Object.keys(patch).some(k => giaBanResetTriggers.includes(k))
      if (hasGiaBanResetChange && !Object.prototype.hasOwnProperty.call(patch, 'gia_ban')) {
        giaBanManualRef.current = false
      }

      // Auto-set nhom_san_pham from loai_thung group
      if ('loai_thung' in patch) {
        const opt = LOAI_THUNG_OPTIONS.find(o => o.value === patch.loai_thung)
        next.nhom_san_pham = opt ? (opt as { group?: string }).group?.toLowerCase() ?? null : null
      }

      // Clear loai_be when switching to non-die-cut type
      if ('loai_thung' in patch && !DIE_CUT_TYPES.has(patch.loai_thung ?? '')) {
        next.loai_be = null
        next.kho_sx = null
        next.dai_sx = null
      }

      // Auto-calculate kho_tt, dai_tt, dien_tich when relevant fields change
      const dimTriggers: (keyof QuoteItem)[] = ['loai_thung', 'dai', 'rong', 'cao', 'so_lop', 'be_so_con', 'loai_be']
      const hasDimChange = Object.keys(patch).some(k => dimTriggers.includes(k as keyof QuoteItem))
      if (hasDimChange && !next.khong_ct) {
        const calc = calcBoxDimensions(
          next.loai_thung, next.dai, next.rong, next.cao, next.so_lop,
          next.be_so_con ?? 1, next.loai_be,
        )
        if (calc) {
          next.kho_tt = calc.kho_tt
          next.dai_tt = calc.dai_tt
          next.dien_tich = calc.dien_tich
          next.kho_sx = calc.kho_sx
          next.dai_sx = calc.dai_sx
        }
      }

      // Khi khong_ct=true: tự tính dien_tich từ kho_tt * dai_tt nhập tay
      const khoTriggers: (keyof QuoteItem)[] = ['kho_tt', 'dai_tt', 'khong_ct']
      const hasKhoChange = Object.keys(patch).some(k => khoTriggers.includes(k as keyof QuoteItem))
      if (hasKhoChange && next.khong_ct && next.kho_tt && next.dai_tt) {
        next.dien_tich = Math.round(next.kho_tt * next.dai_tt / 10000 * 10000) / 10000
      }

      // Auto-lookup giá giấy tem từ danh mục
      const temTriggers: (keyof QuoteItem)[] = ['tem_loai_giay', 'tem_gsm']
      if (Object.keys(patch).some(k => temTriggers.includes(k as keyof QuoteItem)) && next.tem_loai_giay) {
        const match = temPaperList.find(p =>
          p.loai_giay === next.tem_loai_giay &&
          (p.gsm == null || Number(p.gsm) === (next.tem_gsm ?? 0))
        ) ?? temPaperList.find(p =>
          p.loai_giay === next.tem_loai_giay && p.gsm == null
        )
        if (match) next.tem_don_gia_kg = Number(match.don_gia_kg)
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
          } else if (next.dai && next.rong && next.cao != null) {
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

      const hasPaperChange = Object.keys(patch).some(k => [
        'mat', 'mat_dl', 'song_1', 'song_1_dl', 'mat_1', 'mat_1_dl',
        'song_2', 'song_2_dl', 'mat_2', 'mat_2_dl', 'song_3', 'song_3_dl', 'mat_3', 'mat_3_dl',
      ].includes(k))
      if (hasPaperChange) {
        next.ma_ky_hieu = buildPaperSymbol(next, paperCodes)
        // Auto-fill don_gia_m2 từ gia_ban từng lớp: sum(gia_ban_kg × dl / 1000)
        // Chỉ điền khi có đủ giá cho tất cả lớp; user vẫn có thể sửa tay sau đó
        const computed = calcDonGiaM2(next, giaBanMap)
        if (computed !== null) next.don_gia_m2 = computed
      }

      return next
    })

  // Sync kho_tt/dai_tt/dien_tich into state whenever dim inputs change
  useEffect(() => {
    if (currentItem.khong_ct) return
    const calc = calcBoxDimensions(
      currentItem.loai_thung, currentItem.dai, currentItem.rong, currentItem.cao,
      currentItem.so_lop, currentItem.be_so_con ?? 1, currentItem.loai_be,
    )
    if (!calc) return
    setCurrentItem(prev => ({
      ...prev,
      kho_tt: calc.kho_tt,
      dai_tt: calc.dai_tt,
      dien_tich: calc.dien_tich,
      kho_sx: calc.kho_sx,
      dai_sx: calc.dai_sx,
    }))
  }, [
    currentItem.khong_ct, currentItem.loai_thung,
    currentItem.dai, currentItem.rong, currentItem.cao,
    currentItem.so_lop, currentItem.be_so_con, currentItem.loai_be,
  ])

  useEffect(() => {
    if (!canCalculateItemPrice(currentItem)) return
    const timer = window.setTimeout(() => {
      applyFormulaPrice(currentItem)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [
    currentItem.so_lop, currentItem.to_hop_song, currentItem.so_luong,
    currentItem.don_gia_m2,
    currentItem.loai_thung, currentItem.dai, currentItem.rong, currentItem.cao,
    currentItem.mat, currentItem.mat_dl, currentItem.song_1, currentItem.song_1_dl,
    currentItem.mat_1, currentItem.mat_1_dl, currentItem.song_2, currentItem.song_2_dl,
    currentItem.mat_2, currentItem.mat_2_dl, currentItem.song_3, currentItem.song_3_dl,
    currentItem.mat_3, currentItem.mat_3_dl, currentItem.loai_in, currentItem.so_mau,
    currentItem.do_phu, currentItem.c_tham, currentItem.can_man, currentItem.chap_xa,
    currentItem.boi, currentItem.be_lo, currentItem.dan,
    currentItem.ghim, currentItem.do_kho, applyFormulaPrice,
  ])

  const handleAddItem = async () => {
    if (!currentItem.ten_hang) {
      message.warning('Vui lòng nhập tên hàng')
      return
    }
    // Apply computed dims at save time (in case state sync lagged behind)
    const _saveCalc = !currentItem.khong_ct
      ? calcBoxDimensions(currentItem.loai_thung, currentItem.dai, currentItem.rong, currentItem.cao,
          currentItem.so_lop, currentItem.be_so_con ?? 1, currentItem.loai_be)
      : null
    const itemToSave: QuoteItem = {
      ...currentItem,
      ma_ky_hieu: currentItem.ma_ky_hieu || buildPaperSymbol(currentItem, paperCodes),
      ...(_saveCalc ? {
        kho_tt: _saveCalc.kho_tt, dai_tt: _saveCalc.dai_tt, dien_tich: _saveCalc.dien_tich,
        kho_sx: _saveCalc.kho_sx, dai_sx: _saveCalc.dai_sx,
      } : {}),
      // Finance Giá bán là giá thật — dùng cho tong_tien, BOM, downstream logic
      gia_ban: finance.gia_ban || currentItem.gia_ban,
    }
    let newItems: QuoteItem[]
    if (editingIdx !== null) {
      newItems = items.map((it, i) => i === editingIdx ? { ...itemToSave, stt: it.stt } : it)
      setItems(newItems)
      setEditingIdx(null)
    } else {
      newItems = [...items, { ...itemToSave, stt: items.length + 1 }]
      setItems(newItems)
    }
    // Auto-update tong_tien_hang = Σ (gia_ban * so_luong); gia_ban giữ nguyên gia_ban_cuoi từ công thức
    const tongTienHang = newItems.reduce((sum, it) => sum + (it.gia_ban || 0) * (it.so_luong || 0), 0)
    updateFinance({ tong_tien_hang: tongTienHang })
    setCurrentItem(emptyItem())
    giaBanManualRef.current = false
    setProductOptions([])
  }

  const handleEditItem = (idx: number) => {
    const item = items[idx]
    // Recalc dims in case item was saved before auto-calc was implemented
    let loadedItem = item
    if (!item.khong_ct && item.loai_thung && item.dai && item.rong) {
      const calc = calcBoxDimensions(
        item.loai_thung, item.dai, item.rong, item.cao,
        item.so_lop, item.be_so_con ?? 1, item.loai_be,
      )
      if (calc) {
        loadedItem = {
          ...item,
          kho_tt: calc.kho_tt,
          dai_tt: calc.dai_tt,
          dien_tich: calc.dien_tich,
          kho_sx: calc.kho_sx,
          dai_sx: calc.dai_sx,
        }
      }
    }
    setCurrentItem(loadedItem)
    giaBanManualRef.current = false
    // Load finance.gia_ban từ giá đã lưu; lock nếu item có product từ catalog
    const savedGiaBan = Number(item.gia_ban || 0)
    financeGiaBanLockRef.current = savedGiaBan > 0 && !!(item.product_id)
    if (savedGiaBan > 0) {
      setFinance(prev => recalcFinance({ ...prev, gia_ban: savedGiaBan }))
    }
    setEditingIdx(idx)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    else if (editingIdx !== null && idx < editingIdx) setEditingIdx(editingIdx - 1)
    const tongTienHang = newItems.reduce((sum, it) => sum + (it.gia_ban || 0) * (it.so_luong || 0), 0)
    updateFinance({ tong_tien_hang: tongTienHang })
  }

  // Sao chép dòng → load vào editor để chỉnh sửa trước khi thêm
  const handleCopyItem = (idx: number) => {
    const { id: _id, stt: _stt, ...rest } = items[idx]
    setCurrentItem({ ...rest, stt: items.length + 1 })
    giaBanManualRef.current = false
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
  const doSave = async () => {
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
        items: items.map(({ id: _id, ...rest }) => ({
          ...rest,
          ma_ky_hieu: rest.ma_ky_hieu || buildPaperSymbol(rest, paperCodes),
        })),
      }
      if (isEdit) updateMutation.mutate(payload)
      else createMutation.mutate(payload)
    } catch {
      // validateFields() tự hiện lỗi inline trên form, không cần xử lý thêm
    }
  }

  const handleSubmit = () => {
    if (items.length === 0) { message.warning('Báo giá cần ít nhất 1 mặt hàng'); return }
    if (editingIdx !== null) {
      if (confirmOpenRef.current) return
      confirmOpenRef.current = true
      Modal.confirm({
        title: `Dòng ${editingIdx + 1} đang được chỉnh sửa`,
        content: 'Bạn chưa bấm "Cập nhật dòng". Lưu báo giá sẽ bỏ qua thay đổi chưa lưu của dòng này.',
        okText: 'Tiếp tục lưu',
        cancelText: 'Quay lại cập nhật dòng',
        onOk: doSave,
        afterClose: () => { confirmOpenRef.current = false },
      })
      return
    }
    doSave()
  }

  // isReadonly: khoá khi đã duyệt/huỷ/hết hạn.
  // SALE_ADMIN chỉ sửa được 'moi', TRUONG_PHONG/ADMIN sửa được cả 'cho_duyet'.
  const editableStatuses = canApprove ? ['moi', 'cho_duyet'] : ['moi']
  const isReadonly = isEdit && !!quoteData && !editableStatuses.includes(quoteData.trang_thai)

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
      title: 'Mã Ký Hiệu',
      dataIndex: 'ma_ky_hieu',
      width: 150,
      render: (v: string | null, r: QuoteItem) => v || buildPaperSymbol(r, paperCodes) || '—',
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
      width: 90,
      render: (v: string, r: QuoteItem) => {
        const opt = LOAI_IN_OPTIONS.find(o => o.value === v)
        const hasIn = opt && opt.value !== 'khong_in'
        if (!hasIn && !r.co_tem_offset) return '—'
        return (
          <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
            {hasIn && <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{opt!.label}</Tag>}
            {r.co_tem_offset && <Tag color="magenta" style={{ fontSize: 10, margin: 0 }}>Offset</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Đơn giá',
      dataIndex: 'gia_ban',
      width: 115,
      align: 'right',
      render: (v: number, r: QuoteItem) => {
        if (v > 0) return <Text strong style={{ color: '#f5222d' }}>{v.toLocaleString('vi-VN')}</Text>
        if (r.ten_hang) return <Tag color="warning" style={{ fontSize: 11 }}>Chưa có giá</Tag>
        return '—'
      },
    },
    {
      title: 'Giá phôi',
      dataIndex: 'gia_phoi',
      width: 100,
      align: 'right' as const,
      render: (v: number) =>
        v > 0
          ? <Text style={{ color: '#52c41a', fontSize: 12 }}>{v.toLocaleString('vi-VN')}</Text>
          : <Text style={{ color: '#bfbfbf', fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Giá TP',
      dataIndex: 'gia_noi_bo',
      width: 100,
      align: 'right' as const,
      render: (v: number) =>
        v > 0
          ? <Text style={{ color: '#722ed1', fontSize: 12 }}>{v.toLocaleString('vi-VN')}</Text>
          : <Text style={{ color: '#bfbfbf', fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Thành tiền',
      width: 115,
      align: 'right',
      render: (_: unknown, r: QuoteItem) => {
        const tt = (r.gia_ban || 0) * (r.so_luong || 0)
        return tt ? <Text strong style={{ color: '#1677ff' }}>{tt.toLocaleString('vi-VN')}</Text> : '—'
      },
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'ghi_chu',
      width: 140,
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Xưởng SX',
      dataIndex: 'ten_phan_xuong',
      width: 110,
      render: (v: string | null) => v
        ? <Tag color="cyan" style={{ fontSize: 10 }}>{v}</Tag>
        : <Tag color="default" style={{ fontSize: 10, color: '#aaa' }}>Theo đơn</Tag>,
    },
    !isReadonly ? {
      title: '',
      key: 'act',
      width: 110,
      render: (_: unknown, _row: QuoteItem, idx: number) => (
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
  const boxCalc = !ci.khong_ct
    ? calcBoxDimensions(ci.loai_thung, ci.dai, ci.rong, ci.cao, ci.so_lop, ci.be_so_con ?? 1, ci.loai_be)
    : null

  return (
    <div style={{ maxWidth: 1600 }}>
      <style>{`
        .editing-row > td { background-color: #e6f7ff !important; outline: 2px solid #1677ff; }
        .no-price-row > td { background-color: #fffbe6 !important; }
      `}</style>
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
              {isEdit && quoteData?.trang_thai === 'moi' && !canApprove && (
                <Popconfirm
                  title="Gửi báo giá để trưởng phòng duyệt?"
                  description="Sau khi gửi, bạn sẽ không thể chỉnh sửa nữa."
                  onConfirm={() => {
                    const zeroItems = items.filter(it => !(it.gia_ban > 0))
                    if (zeroItems.length > 0) {
                      Modal.confirm({
                        title: 'Có mặt hàng chưa có giá bán',
                        content: `${zeroItems.length} mặt hàng có giá bán = 0. Vẫn tiếp tục gửi duyệt?`,
                        okText: 'Gửi duyệt',
                        cancelText: 'Xem lại',
                        onOk: () => submitMutation.mutate(),
                      })
                    } else {
                      submitMutation.mutate()
                    }
                  }}
                  okText="Gửi duyệt"
                  cancelText="Huỷ"
                >
                  <Button icon={<SendOutlined />} loading={submitMutation.isPending}>
                    Gửi duyệt
                  </Button>
                </Popconfirm>
              )}
              {isEdit && (quoteData?.trang_thai === 'moi' || quoteData?.trang_thai === 'cho_duyet') && canApprove && (
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
                  notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ để tìm...'}
                  onChange={() => { setProductOptions([]); loadProductOptions('') }}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Ngày hết hạn" name="ngay_het_han" initialValue={!isEdit ? dayjs().add(30, 'day') : undefined}>
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
                onDropdownVisibleChange={handleProductDropdownOpen}
                onClear={() => {
                  setCurrentItem(prev => ({ ...emptyItem(), stt: prev.stt, so_luong: prev.so_luong }))
                  giaBanManualRef.current = false
                  setProductOptions([])
                }}
                notFoundContent={productSearching ? <Spin size="small" /> : (headerForm.getFieldValue('customer_id') ? 'Không tìm thấy' : 'Gõ tên / mã AMIS...')}
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
                  hasFormulaPriceData(ci)
                    ? 'Bấm để tính theo công thức giá giấy + gián tiếp + gia công + hao hụt'
                    : 'Nhập đủ kích thước, số lượng, sóng và các lớp giấy để tính giá'
                }
              >
                <InputNumber
                  size="small"
                  style={{ width: '100%', borderColor: ci.gia_ban ? undefined : '#ff4d4f' }}
                  placeholder="Giá bán/thùng"
                  value={ci.gia_ban || undefined}
                  onChange={v => {
                    giaBanManualRef.current = true
                    setCI({ gia_ban: v || 0 })
                  }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  min={0}
                  addonAfter={
                    hasFormulaPriceData(ci) ? (
                      isCalcLoading
                        ? <Spin size="small" />
                        : (
                          <span
                            style={{ cursor: 'pointer', fontSize: 10, color: '#1890ff' }}
                            onClick={() => {
                              giaBanManualRef.current = false
                              applyFormulaPrice(ci, true)
                            }}
                          >
                            Gợi ý
                          </span>
                        )
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
                  <Col span={9}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Mã Giấy Đồng Cấp</Text></Col>
                  <Col span={8}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Định lượng</Text></Col>
                </Row>

                {/* Mặt (lớp mặt ngoài) */}
                <LayerRow label="Mặt" mkField="mat" dlField="mat_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />

                {/* Sóng 1 + Mặt 1 */}
                <LayerRow
                  label={`Sóng ${getSongType(ci.to_hop_song, 0)}`}
                  mkField="song_1" dlField="song_1_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
                <LayerRow label="Mặt 1" mkField="mat_1" dlField="mat_1_dl"
                  ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />

                {/* 5+ lớp: Sóng 2 + Mặt 2 */}
                {ci.so_lop >= 5 && <>
                  <LayerRow
                    label={`Sóng ${getSongType(ci.to_hop_song, 1)}`}
                    mkField="song_2" dlField="song_2_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
                  <LayerRow label="Mặt 2" mkField="mat_2" dlField="mat_2_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
                </>}

                {/* 7 lớp: Sóng 3 + Mặt 3 */}
                {ci.so_lop >= 7 && <>
                  <LayerRow
                    label={`Sóng ${getSongType(ci.to_hop_song, 2)}`}
                    mkField="song_3" dlField="song_3_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
                  <LayerRow label="Mặt 3" mkField="mat_3" dlField="mat_3_dl"
                    ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
                </>}

                <Row style={{ marginTop: 6 }}>
                  <Col span={7}><Text style={{ fontSize: 11 }}>Mã Ký Hiệu</Text></Col>
                  <Col span={17}>
                    <Tag color="geekblue" style={{ margin: 0 }}>
                      {ci.ma_ky_hieu || buildPaperSymbol(ci, paperCodes) || '—'}
                    </Tag>
                  </Col>
                </Row>

                <Divider style={{ margin: '6px 0' }} />
                <Row style={{ marginTop: 2 }} align="middle">
                  <Col span={14}>
                    <Checkbox checked={ci.lay_gia_moi_nl}
                      onChange={e => setCI({ lay_gia_moi_nl: e.target.checked })}>
                      <Text style={{ fontSize: 11 }}>Lấy giá mới NL</Text>
                    </Checkbox>
                  </Col>
                </Row>
                {!hideCostDetails && <Row style={{ marginTop: 4 }} gutter={4} align="middle">
                  <Col span={8}><Text style={{ fontSize: 11 }}>Đơn giá m²</Text></Col>
                  <Col span={16}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={ci.don_gia_m2 || undefined}
                      onChange={v => setCI({ don_gia_m2: v })}
                      placeholder="0"
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Col>
                </Row>}
              </div>
            </Col>

            {/* MIDDLE: Kích thước & In ấn */}
            <Col span={12}>
              <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6 }}>
                <Text strong style={{ fontSize: 12, color: '#52c41a' }}>KÍCH THƯỚC & IN ẤN</Text>

                {/* Box dimensions */}
                <Row gutter={6} style={{ marginTop: 6 }}>
                  <Col span={6}>
                    <Text style={{ fontSize: 11 }}>Loại thùng / hộp</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={ci.loai_thung || undefined}
                      onChange={v => setCI({ loai_thung: v })}
                      allowClear
                      options={LOAI_THUNG_GROUPED}
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
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={!ci.khong_ct ? (boxCalc?.kho_tt ?? ci.kho_tt ?? undefined) : (ci.kho_tt || undefined)}
                      onChange={v => setCI({ kho_tt: v })} placeholder="auto" step={0.1}
                      readOnly={!ci.khong_ct && boxCalc != null} />
                  </Col>
                  <Col span={3}>
                    <Text style={{ fontSize: 11 }}>Dài TT (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={!ci.khong_ct ? (boxCalc?.dai_tt ?? ci.dai_tt ?? undefined) : (ci.dai_tt || undefined)}
                      onChange={v => setCI({ dai_tt: v })} placeholder="auto" step={0.1}
                      readOnly={!ci.khong_ct && boxCalc != null} />
                  </Col>
                </Row>
                {/* Computed dimensions row */}
                {boxCalc && (
                  <Row style={{ marginTop: 3 }} align="middle">
                    <Col span={24}>
                      <Space size={10} wrap>
                        <Text style={{ fontSize: 10, color: '#595959' }}>
                          Kho: <b>{boxCalc.kho1}</b> × Dài: <b>{boxCalc.dai1}</b> cm
                        </Text>
                        <Text style={{ fontSize: 10, color: '#1890ff' }}>
                          KKH: <b>{boxCalc.kho_ke_hoach}</b> cm
                        </Text>
                        <Text style={{ fontSize: 10, color: '#52c41a' }}>
                          Số dao: <b>{boxCalc.so_dao}</b>
                        </Text>
                        {boxCalc.hai_manh && (
                          <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>2 mảnh</Tag>
                        )}
                      </Space>
                    </Col>
                  </Row>
                )}
                {/* Loại bế — chỉ hiện khi là hộp/khay die-cut */}
                {ci.loai_thung && DIE_CUT_TYPES.has(ci.loai_thung) && (
                  <Row gutter={6} style={{ marginTop: 4 }}>
                    <Col span={8}>
                      <Text style={{ fontSize: 11, color: '#722ed1', fontWeight: 600 }}>Loại bế khuôn</Text>
                      <Select
                        size="small"
                        style={{ width: '100%' }}
                        allowClear
                        placeholder="Chọn loại bế..."
                        value={ci.loai_be || undefined}
                        onChange={v => setCI({ loai_be: v ?? null })}
                        options={LOAI_BE_OPTIONS}
                      />
                    </Col>
                    {ci.kho_sx && ci.dai_sx ? (
                      <Col span={16}>
                        <Text style={{ fontSize: 11 }}>Khổ SX × Dài SX (cm)</Text>
                        <div>
                          <Text style={{ fontSize: 12, color: '#722ed1', fontWeight: 600 }}>
                            {ci.kho_sx} × {ci.dai_sx}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                            (trước khuôn bế)
                          </Text>
                        </div>
                      </Col>
                    ) : null}
                  </Row>
                )}
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
                    <InputNumber size="small" style={{ width: '100%' }}
                      value={!ci.khong_ct ? (boxCalc?.dien_tich ?? ci.dien_tich ?? undefined) : (ci.dien_tich || undefined)}
                      onChange={v => setCI({ dien_tich: v })} placeholder="0" step={0.0001}
                      readOnly={!ci.khong_ct && boxCalc != null}
                    />
                  </Col>
                  {!hideCostDetails && ci.dien_tich && ci.don_gia_m2 ? (
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

                {/* Tem Offset */}
                <Row gutter={6} style={{ marginTop: 6 }} align="middle">
                  <Col>
                    <Switch
                      size="small"
                      checked={ci.co_tem_offset}
                      onChange={v => {
                        const updates: Partial<typeof ci> = { co_tem_offset: v }
                        if (v) {
                          const inAddon = getAddonPrice('in_offset')
                          if (inAddon) updates.tem_gia_in_1000to = inAddon.don_gia_m2
                        }
                        setCI(updates)
                      }}
                    />
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#722ed1' }}>Tem offset bồi</Text>
                  </Col>
                  {ci.co_tem_offset && (() => {
                    const offsetResult = calcOffsetCost(ci.so_luong, ci)
                    return offsetResult ? (
                      <Col>
                        <Text style={{ fontSize: 11, color: '#722ed1' }}>
                          ≈ {offsetResult.gia_ban_tem_per_cai.toLocaleString('vi-VN')} đ/cái
                          <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>({offsetResult.so_to} tờ{ci.tem_hai_manh ? ', 2 mảnh' : ''})</Text>
                        </Text>
                      </Col>
                    ) : null
                  })()}
                </Row>
                {ci.co_tem_offset && (
                  <Card size="small" style={{ marginTop: 6, background: '#faf0ff', border: '1px solid #d3adf7' }}>
                    <Row gutter={6}>
                      <Col span={8}>
                        <Text style={{ fontSize: 10 }}>Loại giấy</Text>
                        <Select size="small" style={{ width: '100%' }} allowClear placeholder="DUP/Ivory/Couche"
                          value={ci.tem_loai_giay || undefined}
                          onChange={v => {
                            const dm = temPaperList.find(p =>
                              p.loai_giay === v &&
                              (p.gsm == null || Number(p.gsm) === (ci.tem_gsm ?? 0))
                            ) ?? temPaperList.find(p => p.loai_giay === v && p.gsm == null)
                            setCI({ tem_loai_giay: v ?? null, ...(dm ? { tem_don_gia_kg: Number(dm.don_gia_kg) } : {}) })
                          }}
                          options={TEM_LOAI_GIAY_OPTIONS}
                        />
                      </Col>
                      <Col span={8}>
                        <Text style={{ fontSize: 10 }}>GSM (g/m²)</Text>
                        <Select size="small" style={{ width: '100%' }} allowClear placeholder="Chọn GSM"
                          value={ci.tem_gsm ?? undefined}
                          onChange={v => {
                            const dm = ci.tem_loai_giay ? (
                              temPaperList.find(p =>
                                p.loai_giay === ci.tem_loai_giay &&
                                (p.gsm == null || Number(p.gsm) === (v ?? 0))
                              ) ?? temPaperList.find(p => p.loai_giay === ci.tem_loai_giay && p.gsm == null)
                            ) : null
                            setCI({ tem_gsm: v ?? null, ...(dm ? { tem_don_gia_kg: Number(dm.don_gia_kg) } : {}) })
                          }}
                          options={[200, 230, 250, 300, 350].map(g => ({ value: g, label: `${g} g/m²` }))}
                        />
                      </Col>
                    </Row>
                    {/* Thùng 2 mảnh + auto-calc */}
                    <Row gutter={6} style={{ marginTop: 4 }} align="middle">
                      <Col>
                        <Button
                          size="small"
                          type={ci.tem_hai_manh ? 'primary' : 'default'}
                          style={{ fontSize: 11 }}
                          onClick={() => {
                            const next = !ci.tem_hai_manh
                            const updates: Partial<typeof ci> = { tem_hai_manh: next }
                            if (ci.dai && ci.rong && ci.cao != null) {
                              const dims = calcOffsetSheetDims(ci.dai, ci.rong, ci.cao, next)
                              updates.tem_dai_to = dims.dai_to
                              updates.tem_rong_to = dims.rong_to
                            }
                            setCI(updates)
                          }}
                        >
                          {ci.tem_hai_manh ? '2 mảnh ✓' : 'Thùng 2 mảnh'}
                        </Button>
                      </Col>
                      {ci.tem_hai_manh && (
                        <Col>
                          <Checkbox
                            checked={ci.tem_khac_thiet_ke}
                            onChange={e => setCI({ tem_khac_thiet_ke: e.target.checked })}
                          >
                            <Text style={{ fontSize: 10 }}>Khác thiết kế (×2 kẹp màu/khuôn)</Text>
                          </Checkbox>
                        </Col>
                      )}
                      {(ci.dai && ci.rong && ci.cao != null) ? (
                        <Col>
                          <Button
                            size="small"
                            style={{ fontSize: 11 }}
                            onClick={() => {
                              const dims = calcOffsetSheetDims(ci.dai!, ci.rong!, ci.cao!, ci.tem_hai_manh)
                              setCI({ tem_dai_to: dims.dai_to, tem_rong_to: dims.rong_to })
                            }}
                          >
                            Auto kích thước tờ
                          </Button>
                          <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                            {(() => {
                              const d = calcOffsetSheetDims(ci.dai!, ci.rong!, ci.cao!, ci.tem_hai_manh)
                              return `≈ ${d.dai_to} × ${d.rong_to} cm`
                            })()}
                          </Text>
                        </Col>
                      ) : null}
                    </Row>
                    <Row gutter={6} style={{ marginTop: 4 }}>
                      <Col span={6}>
                        <Text style={{ fontSize: 10 }}>Dài tờ (cm)</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={1}
                          value={ci.tem_dai_to ?? undefined}
                          onChange={v => setCI({ tem_dai_to: v })}
                        />
                      </Col>
                      <Col span={6}>
                        <Text style={{ fontSize: 10 }}>Rộng tờ (cm)</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={1}
                          value={ci.tem_rong_to ?? undefined}
                          onChange={v => setCI({ tem_rong_to: v })}
                        />
                      </Col>
                      <Col span={6}>
                        <Text style={{ fontSize: 10 }}>SP/tờ</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={1}
                          value={ci.tem_sp_per_to}
                          onChange={v => setCI({ tem_sp_per_to: v ?? 2 })}
                        />
                      </Col>
                      <Col span={6}>
                        <Text style={{ fontSize: 10 }}>Bù hao (tờ)</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0}
                          value={ci.tem_waste_to}
                          onChange={v => setCI({ tem_waste_to: v ?? 150 })}
                        />
                      </Col>
                    </Row>
                    <Row gutter={6} style={{ marginTop: 4 }} align="middle">
                      <Col span={6}>
                        <Text style={{ fontSize: 10 }}>Số màu</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} max={8}
                          value={ci.tem_so_mau}
                          onChange={v => setCI({ tem_so_mau: v ?? 0 })}
                        />
                      </Col>
                      {ci.tem_so_mau > 0 && (
                        <Col span={9}>
                          <Text style={{ fontSize: 9 }}>Kẹp màu (đ/màu)</Text>
                          <InputNumber size="small" style={{ width: '100%' }} min={0} step={10000} placeholder="đ/màu"
                            value={ci.tem_gia_kem_mau ?? undefined}
                            onChange={v => setCI({ tem_gia_kem_mau: v })}
                            formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                          />
                        </Col>
                      )}
                      {ci.tem_so_mau > 0 && ci.tem_gia_in_1000to && (
                        <Col>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {ci.tem_gia_in_1000to.toLocaleString('vi-VN')} đ/1000 tờ/màu
                          </Text>
                        </Col>
                      )}
                    </Row>
                    {/* Addon services: checkboxes 1 hàng, inputs bên dưới */}
                    <Row gutter={8} style={{ marginTop: 4 }} align="middle">
                      <Col>
                        <Checkbox checked={ci.tem_co_can_mang} onChange={e => {
                          const addon = e.target.checked ? getAddonPrice('can_mang') : undefined
                          setCI({ tem_co_can_mang: e.target.checked, ...(addon ? { tem_gia_can_mang_m2: addon.don_gia_m2 } : {}) })
                        }}><Text style={{ fontSize: 10 }}>Cán màng</Text></Checkbox>
                      </Col>
                      <Col>
                        <Checkbox checked={ci.tem_co_uv} onChange={e => {
                          const addon = e.target.checked ? getAddonPrice('uv') : undefined
                          setCI({ tem_co_uv: e.target.checked, ...(addon ? { tem_gia_uv_m2: addon.don_gia_m2 } : {}) })
                        }}><Text style={{ fontSize: 10 }}>UV</Text></Checkbox>
                      </Col>
                      <Col>
                        <Checkbox checked={ci.tem_co_suppo} onChange={e => {
                          const addon = e.target.checked ? getAddonPrice('suppo') : undefined
                          setCI({ tem_co_suppo: e.target.checked, ...(addon ? { tem_gia_suppo_m2: addon.don_gia_m2 } : {}) })
                        }}><Text style={{ fontSize: 10 }}>Suppo</Text></Checkbox>
                      </Col>
                      <Col>
                        <Checkbox checked={ci.tem_co_luoi} onChange={e => {
                          const addon = e.target.checked ? getAddonPrice('luoi') : undefined
                          setCI({ tem_co_luoi: e.target.checked, ...(addon ? { tem_gia_luoi_m2: addon.don_gia_m2 } : {}) })
                        }}><Text style={{ fontSize: 10 }}>Lưới</Text></Checkbox>
                      </Col>
                      <Col>
                        <Checkbox checked={ci.tem_co_khuon_be} onChange={e => {
                          setCI({ tem_co_khuon_be: e.target.checked })
                        }}><Text style={{ fontSize: 10 }}>Khuôn bế</Text></Checkbox>
                      </Col>
                    </Row>
                    {(ci.tem_co_can_mang || ci.tem_co_uv || ci.tem_co_suppo || ci.tem_co_luoi || ci.tem_co_khuon_be) && (
                      <Row gutter={6} style={{ marginTop: 3 }}>
                        {ci.tem_co_can_mang && (
                          <Col span={6}>
                            <Text style={{ fontSize: 9 }}>Cán màng đ/m²</Text>
                            <InputNumber size="small" style={{ width: '100%' }} min={0} step={1000} placeholder="đ/m²"
                              value={ci.tem_gia_can_mang_m2 ?? undefined}
                              onChange={v => setCI({ tem_gia_can_mang_m2: v })}
                              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                            />
                          </Col>
                        )}
                        {ci.tem_co_uv && (
                          <Col span={6}>
                            <Text style={{ fontSize: 9 }}>UV đ/m²</Text>
                            <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                              value={ci.tem_gia_uv_m2 ?? undefined}
                              onChange={v => setCI({ tem_gia_uv_m2: v })}
                              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                            />
                          </Col>
                        )}
                        {ci.tem_co_suppo && (
                          <Col span={6}>
                            <Text style={{ fontSize: 9 }}>Suppo đ/m²</Text>
                            <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                              value={ci.tem_gia_suppo_m2 ?? undefined}
                              onChange={v => setCI({ tem_gia_suppo_m2: v })}
                              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                            />
                          </Col>
                        )}
                        {ci.tem_co_luoi && (
                          <Col span={6}>
                            <Text style={{ fontSize: 9 }}>Lưới đ/m²</Text>
                            <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                              value={ci.tem_gia_luoi_m2 ?? undefined}
                              onChange={v => setCI({ tem_gia_luoi_m2: v })}
                              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                            />
                          </Col>
                        )}
                        {ci.tem_co_khuon_be && (
                          <>
                            <Col span={8}>
                              <Text style={{ fontSize: 9 }}>Khuôn bế (đ)</Text>
                              <InputNumber size="small" style={{ width: '100%' }} min={0} step={100000} placeholder="đ"
                                value={ci.tem_gia_khuon_be ?? undefined}
                                onChange={v => setCI({ tem_gia_khuon_be: v })}
                                formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                              />
                            </Col>
                            <Col span={8}>
                              <Text style={{ fontSize: 9 }}>Phân bổ (cái)</Text>
                              <InputNumber size="small" style={{ width: '100%' }} min={1} step={1000} placeholder="10000"
                                value={ci.tem_khuon_be_phan_bo}
                                onChange={v => setCI({ tem_khuon_be_phan_bo: v ?? 10000 })}
                                formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                              />
                            </Col>
                          </>
                        )}
                      </Row>
                    )}
                    {/* Breakdown chi phí offset */}
                    {(() => {
                      const r = calcOffsetCost(ci.so_luong, ci)
                      if (!r || r.detail.tong_chi_phi === 0) return null
                      const fmt = (v: number) => v.toLocaleString('vi-VN')
                      return (
                        <Row gutter={4} style={{ marginTop: 6, padding: '4px 0', borderTop: '1px dashed #d3adf7' }}>
                          <Col span={24}>
                            <Text style={{ fontSize: 10, color: '#555' }}>
                              {r.so_to} tờ{ci.tem_hai_manh ? ' (2 mảnh)' : ''} × {r.dien_tich_to.toFixed(4)} m² &nbsp;|&nbsp;
                              {r.detail.chi_phi_giay > 0 && <>Giấy: <b>{fmt(r.detail.chi_phi_giay)}</b> &nbsp;</>}
                              {r.detail.chi_phi_in > 0 && <>In: <b>{fmt(r.detail.chi_phi_in)}</b> &nbsp;</>}
                              {r.detail.chi_phi_can_mang > 0 && <>CM: <b>{fmt(r.detail.chi_phi_can_mang)}</b> &nbsp;</>}
                              {r.detail.chi_phi_khuon_be > 0 && <>KB: <b>{fmt(r.detail.chi_phi_khuon_be)}</b> &nbsp;</>}
                              {r.detail.chi_phi_uv > 0 && <>UV: <b>{fmt(r.detail.chi_phi_uv)}</b> &nbsp;</>}
                              {r.detail.chi_phi_suppo > 0 && <>Suppo: <b>{fmt(r.detail.chi_phi_suppo)}</b> &nbsp;</>}
                              {r.detail.chi_phi_luoi > 0 && <>Lưới: <b>{fmt(r.detail.chi_phi_luoi)}</b> &nbsp;</>}
                              → <b style={{ color: '#722ed1' }}>{fmt(r.detail.tong_chi_phi)} đ tổng</b>
                              &nbsp;/ <b>{fmt(r.gia_ban_tem_per_cai)} đ/cái</b>
                            </Text>
                          </Col>
                        </Row>
                      )
                    })()}
                  </Card>
                )}

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
                        <Text style={{ fontSize: 11 }}>Chạp Xã</Text>
                      </Checkbox>
                      <Checkbox checked={ci.do_phu} onChange={e => setCI({ do_phu: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Độ phủ</Text>
                      </Checkbox>
                      <Checkbox checked={ci.dan} onChange={e => setCI({ dan: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Dán</Text>
                      </Checkbox>
                      <Checkbox checked={ci.boi} onChange={e => setCI({ boi: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Bồi</Text>
                      </Checkbox>
                      <Checkbox checked={ci.be_lo} onChange={e => setCI({ be_lo: e.target.checked })}>
                        <Text style={{ fontSize: 11 }}>Bế Lỗ</Text>
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
                  <Col span={4}>
                    <Text style={{ fontSize: 11 }}>Con bế/lần</Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={ci.be_so_con ?? 1}
                      onChange={(v: number) => setCI({ be_so_con: v > 1 ? v : null })}
                      options={[1, 2, 3, 4, 6, 8].map(n => ({ value: n, label: `${n} con` }))}
                    />
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
                    <Text style={{ fontSize: 11 }}>Xưởng SX (dòng này)</Text>
                    <Select
                      size="small"
                      allowClear
                      placeholder="Dùng xưởng của đơn"
                      style={{ width: '100%', marginBottom: 4 }}
                      value={ci.phan_xuong_id ?? undefined}
                      onChange={v => setCI({ phan_xuong_id: v ?? null })}
                      options={phanXuongList
                        .filter((p: { trang_thai: boolean }) => p.trang_thai)
                        .map((p: { id: number; ten_xuong: string }) => ({ value: p.id, label: p.ten_xuong }))}
                    />
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
                        value={finance[field as keyof typeof finance] as number}
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
                    <Input size="small" placeholder="Tên CP khác 1"
                      addonBefore={<span style={{ fontSize: 10, color: '#888' }}>CP1</span>}
                      value={finance.chi_phi_khac_1_ten}
                      onChange={e => updateFinance({ chi_phi_khac_1_ten: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      addonBefore={<span style={{ fontSize: 10, color: '#888' }}>₫</span>}
                      value={finance.chi_phi_khac_1}
                      onChange={v => updateFinance({ chi_phi_khac_1: v || 0 })}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }}>
                  <Col span={12}>
                    <Input size="small" placeholder="Tên CP khác 2"
                      addonBefore={<span style={{ fontSize: 10, color: '#888' }}>CP2</span>}
                      value={finance.chi_phi_khac_2_ten}
                      onChange={e => updateFinance({ chi_phi_khac_2_ten: e.target.value })} />
                  </Col>
                  <Col span={12}>
                    <InputNumber size="small" style={{ width: '100%' }}
                      addonBefore={<span style={{ fontSize: 10, color: '#888' }}>₫</span>}
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
                      onChange={v => { financeGiaBanLockRef.current = true; updateFinance({ gia_ban: v || 0 }) }}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>Giá Phôi</Text></Col>
                  <Col span={12}>
                    <Text strong style={{ color: '#52c41a', fontSize: 13 }}>
                      {finance.gia_phoi > 0
                        ? finance.gia_phoi.toLocaleString('vi-VN') + ' đ'
                        : '—'}
                    </Text>
                  </Col>
                </Row>
                <Row gutter={4} style={{ marginTop: 4 }} align="middle">
                  <Col span={12}><Text style={{ fontSize: 11 }}>Giá TP (nội bộ)</Text></Col>
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
                    locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                    rowKey={(_, idx) => String(idx)}
          dataSource={items}
          columns={itemColumns}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          rowClassName={(row, idx) => {
            if (idx === editingIdx) return 'editing-row'
            if (row.ten_hang && !(row.gia_ban > 0)) return 'no-price-row'
            return ''
          }}
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
                    locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
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
                locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
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
