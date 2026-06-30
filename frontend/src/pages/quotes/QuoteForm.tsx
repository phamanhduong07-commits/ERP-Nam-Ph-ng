import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Button, Card, Row, Col, Table, Space, Typography, Spin, Modal, message } from 'antd'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import {
  quotesApi, buildPaperSymbol, calcBoxDimensions, calcDonGiaM2,
  LOAI_THUNG_OPTIONS, DIE_CUT_TYPES,
} from '../../api/quotes'
import type { QuoteItem, CreateQuotePayload } from '../../api/quotes'
import { temPaperPricesApi } from '../../api/temPaperPrices'
import { offsetAddonPricesApi } from '../../api/offsetAddonPrices'
import type { OffsetAddonPrice } from '../../api/offsetAddonPrices'
import { productsApi, type ProductFull } from '../../api/products'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { useAuthStore } from '../../store/auth'
import EmptyState from '../../components/EmptyState'

import {
  buildGhiChu, emptyItem, ADDON_TRIGGER_KEYS,
  DEFAULT_FINANCE, type QuoteFinance,
} from './quoteHelpers'
import { usePaperOptions } from './hooks/usePaperOptions'
import CauTrucModal from './components/CauTrucModal'
import QuoteToolbar from './components/QuoteToolbar'
import QuoteHeaderForm from './components/QuoteHeaderForm'
import QuoteItemEditor from './components/QuoteItemEditor'
import QuoteItemsTable from './components/QuoteItemsTable'
import TaoDonHangModal, { type TaoDonHangResult } from './components/TaoDonHangModal'

const { Text } = Typography

interface AxiosErrorLike { response?: { data?: { detail?: string } } }
function apiErrorMsg(e: unknown, fallback: string): string {
  return (e as AxiosErrorLike)?.response?.data?.detail || fallback
}

// Chuyển format loai_thung cũ → code mới
function normalizeLoaiThung(v: string | null): string | null {
  if (!v) return null
  const VALID_CODES = new Set(['A1','A3','A5','A5_DAY','A5_NAP','A7','GOI_GIUA','GOI_SUON','LOT','KHAC',
    'HOP_CAI','HOP_CAI_CHAU','HOP_GIAY','HOP_PIZZA','HOP_DAY_NGAN','HOP_DUOI_CA','HOP_PIZZA_CO_TAY','KHAY_1','KHAY_2','KHAY_3'])
  if (VALID_CODES.has(v)) return v
  if (v.startsWith('A1-')) return 'A1'
  if (v.startsWith('A3-')) return 'A3'
  if (v.startsWith('A5-')) return 'A5_DAY'
  if (v.startsWith('A7-')) return 'A7'
  const n = v.normalize('NFC')
  if (n === 'Gói giữa')   return 'GOI_GIUA'
  if (n === 'Gói sườn')   return 'GOI_SUON'
  if (n === 'Tấm lót')    return 'LOT'
  if (n === 'Tấm lót bế') return 'LOT'
  if (n === 'Tấm bế')     return 'LOT'
  return v
}

export default function QuoteForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [headerForm] = Form.useForm()

  // ── State ──────────────────────────────────────────────────
  const [items, setItems] = useState<QuoteItem[]>([])
  const [currentItem, setCurrentItem] = useState<QuoteItem>(emptyItem())
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [customerOptions, setCustomerOptions] = useState<{ value: number; label: string; ma_kh: string }[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [isCalcLoading, setIsCalcLoading] = useState(false)
  const [finance, setFinance] = useState<QuoteFinance>(DEFAULT_FINANCE)
  const [cauTrucModal, setCauTrucModal] = useState(false)
  const [productOptions, setProductOptions] = useState<{ value: number; label: string; record: ProductFull }[]>([])
  const [productSearching, setProductSearching] = useState(false)
  const [selectItemsModal, setSelectItemsModal] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveToProductLoading, setSaveToProductLoading] = useState(false)

  const role = useAuthStore(s => s.user?.role)
  const canApprove = role === 'ADMIN' || role === 'GIAM_DOC' || role === 'TRUONG_PHONG_SALE_ADMIN'

  const giaBanManualRef     = useRef(false)
  const financeGiaBanLockRef = useRef(false)
  const priceCalcSeq        = useRef(0)
  const confirmOpenRef      = useRef(false)
  const autosaveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Queries ────────────────────────────────────────────────
  const { mkList, byMk, paperCodes, rawToMk, giaBanMap } = usePaperOptions()

  const { data: phapNhanRaw } = useQuery({ queryKey: ['phap-nhan'], queryFn: () => phapNhanApi.list().then(r => r.data) })
  const phapNhanList = Array.isArray(phapNhanRaw) ? phapNhanRaw : []

  const { data: phanXuongRaw } = useQuery({ queryKey: ['phan-xuong'], queryFn: () => warehouseApi.listPhanXuong().then(r => r.data) })
  const phanXuongList = Array.isArray(phanXuongRaw) ? phanXuongRaw : []

  const { data: nhanVienRaw } = useQuery({ queryKey: ['sale-users'], queryFn: () => customersApi.saleUsers().then(r => r.data) })
  const nhanVienList = Array.isArray(nhanVienRaw) ? nhanVienRaw : []

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

  const { data: quoteData, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.get(Number(id)).then(r => r.data),
    enabled: isEdit,
  })

  const getAddonPrice = (loai: string): OffsetAddonPrice | undefined =>
    offsetAddonList.find(p => p.loai_addon === loai)

  // ── Load existing quote ────────────────────────────────────
  useEffect(() => {
    if (!quoteData) return
    headerForm.setFieldsValue({
      customer_id:       quoteData.customer_id,
      ngay_bao_gia:      dayjs(quoteData.ngay_bao_gia),
      ngay_het_han:      quoteData.ngay_het_han ? dayjs(quoteData.ngay_het_han) : null,
      phap_nhan_id:      quoteData.phap_nhan_id ?? null,
      phap_nhan_sx_id:   quoteData.phap_nhan_sx_id ?? null,
      phan_xuong_id:     quoteData.phan_xuong_id ?? null,
      nv_phu_trach_id:   quoteData.nv_phu_trach_id,
      nv_theo_doi_id:    quoteData.nv_theo_doi_id ?? null,
      so_bg_copy:        quoteData.so_bg_copy,
      ghi_chu:           quoteData.ghi_chu,
      dieu_khoan:        quoteData.dieu_khoan,
    })
    setItems(quoteData.items)
    setFinance(recalcFinance({
      chi_phi_bang_in:       Number(quoteData.chi_phi_bang_in),
      chi_phi_khuon:         Number(quoteData.chi_phi_khuon),
      chi_phi_van_chuyen:    Number(quoteData.chi_phi_van_chuyen),
      tong_tien_hang:        Number(quoteData.tong_tien_hang),
      ty_le_vat:             Number(quoteData.ty_le_vat),
      tien_vat:              0,
      chi_phi_hang_hoa_dv:   0,
      tong_cong:             0,
      chi_phi_khac_1_ten:    quoteData.chi_phi_khac_1_ten || '',
      chi_phi_khac_1:        Number(quoteData.chi_phi_khac_1),
      chi_phi_khac_2_ten:    quoteData.chi_phi_khac_2_ten || '',
      chi_phi_khac_2:        Number(quoteData.chi_phi_khac_2),
      chiet_khau:            Number(quoteData.chiet_khau),
      gia_ban:               Number(quoteData.gia_ban),
      gia_phoi:              Number(quoteData.items?.[0]?.gia_phoi || 0),
      gia_xuat_phoi_vsp:     Number(quoteData.gia_xuat_phoi_vsp),
    }))
    if (quoteData.customer) {
      setCustomerOptions([{
        value: quoteData.customer_id,
        label: `${quoteData.customer.ten_viet_tat}${quoteData.customer.ten_don_vi ? ' – ' + quoteData.customer.ten_don_vi : ''}`,
        ma_kh: quoteData.customer.ma_kh,
      }])
    }
  }, [quoteData, headerForm])

  // ── Finance helpers ────────────────────────────────────────
  const recalcFinance = useCallback((f: QuoteFinance): QuoteFinance => {
    const tienVat = Math.round(f.tong_tien_hang * f.ty_le_vat / 100)
    const chiPhiHhDv = f.tong_tien_hang + tienVat
    const tongCong = chiPhiHhDv + f.chi_phi_bang_in + f.chi_phi_khuon + f.chi_phi_van_chuyen
      + f.chi_phi_khac_1 + f.chi_phi_khac_2 - f.chiet_khau
    return { ...f, tien_vat: tienVat, chi_phi_hang_hoa_dv: chiPhiHhDv, tong_cong: tongCong }
  }, [])

  const updateFinance = useCallback((patch: Partial<QuoteFinance>) => {
    setFinance(prev => recalcFinance({ ...prev, ...patch }))
  }, [recalcFinance])

  const handleGiaBanChange = useCallback((v: number) => {
    financeGiaBanLockRef.current = true
    updateFinance({ gia_ban: v })
  }, [updateFinance])

  // ── Price calculation ──────────────────────────────────────
  const hasFormulaPriceData = (item: QuoteItem) => {
    if (![3, 5, 7].includes(item.so_lop)) return false
    if (!item.loai_thung || item.loai_thung === 'KHAC') return false
    const needsCao = item.loai_thung !== 'LOT'
    if (!item.dai || !item.rong || !item.to_hop_song || !item.so_luong) return false
    if (needsCao && item.cao == null) return false
    const layers: [keyof QuoteItem, keyof QuoteItem][] = [
      ['mat', 'mat_dl'], ['song_1', 'song_1_dl'], ['mat_1', 'mat_1_dl'],
    ]
    if (item.so_lop >= 5) layers.push(['song_2', 'song_2_dl'], ['mat_2', 'mat_2_dl'])
    if (item.so_lop >= 7) layers.push(['song_3', 'song_3_dl'], ['mat_3', 'mat_3_dl'])
    return layers.every(([codeKey, dlKey]) => Boolean(item[codeKey]) && Boolean(item[dlKey]))
  }

  const applyFormulaPrice = useCallback(async (item: QuoteItem, force = false) => {
    if (!force && !((!giaBanManualRef.current) && hasFormulaPriceData(item))) return
    const seq = ++priceCalcSeq.current
    if (force) setIsCalcLoading(true)
    try {
      const res = await quotesApi.calculateItemPrice(item)
      if (seq !== priceCalcSeq.current) return
      const giaBan = Number(res.data.gia_ban || 0)
      const giaPhoi = Number(res.data.gia_phoi || 0)
      const giaNB = Number(res.data.gia_noi_bo || 0)
      if (giaBan > 0) {
        if (force || !giaBanManualRef.current) {
          setCurrentItem(prev => ({ ...prev, gia_ban: giaBan, gia_phoi: giaPhoi, gia_noi_bo: giaNB }))
        }
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

  // ── Mutations ──────────────────────────────────────────────
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

  const autosaveMutation = useMutation({
    mutationFn: (data: Partial<CreateQuotePayload>) => quotesApi.update(Number(id), data),
    onSuccess: () => setLastSavedAt(new Date()),
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
    mutationFn: ({ items, ngay_giao_hang, dia_chi_giao, dien_thoai_giao }: TaoDonHangResult) =>
      quotesApi.taoDonHang(Number(id), items, { ngay_giao_hang, dia_chi_giao, dien_thoai_giao }),
    onSuccess: (res) => {
      message.success(`Đã tạo đơn hàng ${res.data.so_don}`)
      setSelectItemsModal(false)
      navigate('/sales/orders')
    },
    onError: (e: unknown) => message.error(apiErrorMsg(e, 'Lỗi tạo đơn')),
  })

  // ── Customer / Product search ──────────────────────────────
  const handleCustomerSearch = async (q: string) => {
    if (!q || q.length < 1) return
    setCustomerSearching(true)
    try {
      const res = await customersApi.list({ search: q, page_size: 30 })
      setCustomerOptions(res.data.items.map(c => ({
        value: c.id,
        label: `${c.ten_viet_tat}${c.ten_don_vi ? ' – ' + c.ten_don_vi : ''}`,
        ma_kh: c.ma_kh,
      })))
    } finally {
      setCustomerSearching(false)
    }
  }

  const loadProductOptions = async (q: string) => {
    const customerId = headerForm.getFieldValue('customer_id') as number | undefined
    if (!customerId && (!q || q.length < 1)) return
    setProductSearching(true)
    try {
      const res = await productsApi.list({
        search: q, page_size: 50,
        ...(customerId ? { ma_kh_id: customerId } : {}),
      })
      setProductOptions(res.data.items.map(p => ({
        value: p.id,
        label: p.ten_hang,
        record: p,
      })))
    } finally {
      setProductSearching(false)
    }
  }

  const handleProductDropdownOpen = (open: boolean) => {
    if (open && productOptions.length === 0) loadProductOptions('')
  }

  const _deriveToHopSong = (p: ProductFull): string | null => {
    const parts: string[] = []
    if (p.song_1) parts.push('B')
    if (p.song_2) parts.push('C')
    if (p.song_3) parts.push('E')
    return parts.join('') || null
  }

  const _applyProductToCI = (p: ProductFull) => {
    const toMk = (raw: string | null) => raw ? (rawToMk[raw] ?? raw) : null
    const productGiaBan = p.gia_ban ? Number(p.gia_ban) : 0
    giaBanManualRef.current = false
    financeGiaBanLockRef.current = productGiaBan > 0
    if (productGiaBan > 0) {
      setFinance(prev => recalcFinance({ ...prev, gia_ban: productGiaBan }))
    }
    setCurrentItem(prev => ({
      ...prev,
      product_id: p.id,
      ma_amis: p.ma_amis,
      loai: p.ma_amis ?? null,
      ten_hang: p.ten_hang,
      dvt: p.dvt,
      so_lop: p.so_lop,
      to_hop_song: _deriveToHopSong(p),
      ...(p.dai != null ? { dai: Number(p.dai) } : {}),
      ...(p.rong != null ? { rong: Number(p.rong) } : {}),
      ...(p.cao != null ? { cao: Number(p.cao) } : {}),
      loai_in: (p.loai_in === 1 ? 'flexo' : p.loai_in === 2 ? 'ky_thuat_so' : 'khong_in'),
      so_mau: p.so_mau ?? 0,
      ghim: p.ghim ?? false,
      dan: p.dan ?? false,
      chap_xa: !!(p.chap_xa),
      boi: !!(p.boi),
      be_so_con: p.be_so_con ?? 0,
      c_tham: (p.chong_tham === 1 ? '1 mặt' : p.chong_tham === 2 ? '2 mặt' : null),
      can_man: (p.can_mang === 1 ? '1 mặt' : p.can_mang === 2 ? '2 mặt' : null),
      loai_lan: p.loai_lan === 'bang' ? 'lan_bang' : p.loai_lan === 'am_duong' ? 'lan_am_duong' : null,
      ...(p.loai_thung != null ? { loai_thung: normalizeLoaiThung(p.loai_thung) } : {}),
      loai_be:    p.loai_be    ?? null,
      be_hai_manh: p.be_hai_manh ?? false,
      ho_mo:  p.ho_mo  ?? null,
      ho_nap: p.ho_nap ?? null,
      ho_day: p.ho_day ?? null,
      co_be:  p.co_be  ?? false,
      be_lo:  p.be_lo  ?? false,
      do_kho: p.do_kho ?? false,
      do_phu: p.do_phu ?? false,
      may_in: p.may_in ?? null,
      ban_ve_kt: p.ban_ve_kt ?? null,
      nhom_san_pham: p.nhom_san_pham ?? null,
      ghi_chu: p.ghi_chu ?? null,
      mat:    toMk(p.mat),    mat_dl:    p.mat_dl    ? Number(p.mat_dl)    : null,
      song_1: toMk(p.song_1), song_1_dl: p.song_1_dl ? Number(p.song_1_dl) : null,
      mat_1:  toMk(p.mat_1),  mat_1_dl:  p.mat_1_dl  ? Number(p.mat_1_dl)  : null,
      song_2: toMk(p.song_2), song_2_dl: p.song_2_dl ? Number(p.song_2_dl) : null,
      mat_2:  toMk(p.mat_2),  mat_2_dl:  p.mat_2_dl  ? Number(p.mat_2_dl)  : null,
      song_3: toMk(p.song_3), song_3_dl: p.song_3_dl ? Number(p.song_3_dl) : null,
      mat_3:  toMk(p.mat_3),  mat_3_dl:  p.mat_3_dl  ? Number(p.mat_3_dl)  : null,
      // Tem offset specs
      co_tem_offset:    p.co_tem_offset    ?? false,
      tem_loai_giay:    p.tem_loai_giay    ?? null,
      tem_gsm:          p.tem_gsm          != null ? Number(p.tem_gsm)    : null,
      tem_dai_to:       p.tem_dai_to       != null ? Number(p.tem_dai_to) : null,
      tem_rong_to:      p.tem_rong_to      != null ? Number(p.tem_rong_to): null,
      tem_sp_per_to:    p.tem_sp_per_to    ?? 1,
      tem_waste_to:     p.tem_waste_to     ?? 0,
      tem_so_mau:       p.tem_so_mau       ?? 0,
      tem_co_can_mang:  p.tem_co_can_mang  ?? false,
      tem_co_khuon_be:  p.tem_co_khuon_be  ?? false,
      tem_co_uv:        p.tem_co_uv        ?? false,
      tem_co_suppo:     p.tem_co_suppo     ?? false,
      tem_co_luoi:      p.tem_co_luoi      ?? false,
      tem_hai_manh:     p.tem_hai_manh     ?? false,
      tem_khac_thiet_ke: p.tem_khac_thiet_ke ?? false,
      ...(p.gia_ban ? { gia_ban: Number(p.gia_ban) } : {}),
    }))
  }

  const handleProductSelect = async (val: number) => {
    try {
      const res = await productsApi.get(val)
      _applyProductToCI(res.data)
    } catch {
      const opt = productOptions.find(o => o.value === val)
      if (opt) _applyProductToCI(opt.record)
    }
  }

  const handleProductClear = () => {
    setCurrentItem(prev => ({ ...emptyItem(), stt: prev.stt, so_luong: prev.so_luong }))
    giaBanManualRef.current = false
    setProductOptions([])
  }

  const handleSaveCurrentItemToProduct = async () => {
    const productId = currentItem.product_id
    if (productId == null) return
    setSaveToProductLoading(true)
    try {
      const ci = currentItem
      await productsApi.update(productId, {
        ten_hang: ci.ten_hang,
        dvt: ci.dvt,
        dai: ci.dai ?? null,
        rong: ci.rong ?? null,
        cao: ci.cao ?? null,
        so_lop: ci.so_lop,
        so_mau: ci.so_mau ?? 0,
        gia_ban: ci.gia_ban ?? 0,
        ghim: ci.ghim ?? false,
        dan: ci.dan ?? false,
        loai_thung: ci.loai_thung ?? null,
        loai_in: ci.loai_in === 'flexo' ? 1 : ci.loai_in === 'ky_thuat_so' ? 2 : 0,
        chap_xa: ci.chap_xa ? 1 : 0,
        loai_lan: ci.loai_lan === 'lan_bang' ? 'bang' : ci.loai_lan === 'lan_am_duong' ? 'am_duong' : null,
        chong_tham: ci.c_tham === '1 mặt' ? 1 : ci.c_tham === '2 mặt' ? 2 : 0,
        boi: ci.boi ? 1 : 0,
        be_so_con: ci.be_so_con ?? 0,
        can_mang: ci.can_man === '1 mặt' ? 1 : ci.can_man === '2 mặt' ? 2 : 0,
        mat: ci.mat ?? null,     mat_dl: ci.mat_dl ?? null,
        song_1: ci.song_1 ?? null, song_1_dl: ci.song_1_dl ?? null,
        mat_1: ci.mat_1 ?? null,   mat_1_dl: ci.mat_1_dl ?? null,
        song_2: ci.song_2 ?? null, song_2_dl: ci.song_2_dl ?? null,
        mat_2: ci.mat_2 ?? null,   mat_2_dl: ci.mat_2_dl ?? null,
        song_3: ci.song_3 ?? null, song_3_dl: ci.song_3_dl ?? null,
        mat_3: ci.mat_3 ?? null,   mat_3_dl: ci.mat_3_dl ?? null,
        loai_be:     ci.loai_be     ?? null,
        be_hai_manh: ci.be_hai_manh ?? false,
        ho_mo:  ci.ho_mo  ?? null,
        ho_nap: ci.ho_nap ?? null,
        ho_day: ci.ho_day ?? null,
        co_be:  ci.co_be  ?? false,
        be_lo:  ci.be_lo  ?? false,
        do_kho: ci.do_kho ?? false,
        do_phu: ci.do_phu ?? false,
        may_in: ci.may_in ?? null,
        ban_ve_kt: ci.ban_ve_kt ?? null,
        nhom_san_pham: ci.nhom_san_pham ?? null,
        ghi_chu: ci.ghi_chu ?? null,
        // Tem offset specs (không bao gồm các trường giá — đó là quote-specific)
        co_tem_offset:    ci.co_tem_offset    ?? false,
        tem_loai_giay:    ci.tem_loai_giay    ?? null,
        tem_gsm:          ci.tem_gsm          ?? null,
        tem_dai_to:       ci.tem_dai_to       ?? null,
        tem_rong_to:      ci.tem_rong_to      ?? null,
        tem_sp_per_to:    ci.tem_sp_per_to    ?? 1,
        tem_waste_to:     ci.tem_waste_to     ?? 0,
        tem_so_mau:       ci.tem_so_mau       ?? 0,
        tem_co_can_mang:  ci.tem_co_can_mang  ?? false,
        tem_co_khuon_be:  ci.tem_co_khuon_be  ?? false,
        tem_co_uv:        ci.tem_co_uv        ?? false,
        tem_co_suppo:     ci.tem_co_suppo     ?? false,
        tem_co_luoi:      ci.tem_co_luoi      ?? false,
        tem_hai_manh:     ci.tem_hai_manh     ?? false,
        tem_khac_thiet_ke: ci.tem_khac_thiet_ke ?? false,
      })
      message.success('Đã lưu vào danh mục sản phẩm')
      queryClient.invalidateQueries({ queryKey: ['products-full'] })
    } catch (e) {
      message.error(apiErrorMsg(e, 'Lỗi khi lưu vào danh mục'))
    } finally {
      setSaveToProductLoading(false)
    }
  }

  // ── Item editing (setCI with all auto-logic) ───────────────
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
      const giaBanResetTriggers = formulaTriggers.filter(k => k !== 'so_luong')
      const hasGiaBanResetChange = Object.keys(patch).some(k => giaBanResetTriggers.includes(k))
      if (hasGiaBanResetChange && !Object.prototype.hasOwnProperty.call(patch, 'gia_ban')) {
        giaBanManualRef.current = false
      }

      if ('loai_thung' in patch) {
        const opt = LOAI_THUNG_OPTIONS.find(o => o.value === patch.loai_thung)
        next.nhom_san_pham = opt ? ((opt as { group?: string }).group?.toLowerCase() ?? null) : null
      }

      if ('loai_thung' in patch && !DIE_CUT_TYPES.has(patch.loai_thung ?? '')) {
        next.loai_be = null; next.kho_sx = null; next.dai_sx = null; next.co_be = false
      }

      const dimTriggers: (keyof QuoteItem)[] = ['loai_thung', 'dai', 'rong', 'cao', 'so_lop', 'be_so_con', 'loai_be', 'be_hai_manh']
      const hasDimChange = Object.keys(patch).some(k => dimTriggers.includes(k as keyof QuoteItem))
      if (hasDimChange && !next.khong_ct) {
        const calc = calcBoxDimensions(next.loai_thung, next.dai, next.rong, next.cao, next.so_lop, next.be_so_con ?? 1, next.loai_be, next.be_hai_manh)
        if (calc) {
          next.kho_tt = calc.kho_tt; next.dai_tt = calc.dai_tt; next.dien_tich = calc.dien_tich
          next.kho_sx = calc.kho_sx; next.dai_sx = calc.dai_sx
        }
      }

      const khoTriggers: (keyof QuoteItem)[] = ['kho_tt', 'dai_tt', 'khong_ct']
      const hasKhoChange = Object.keys(patch).some(k => khoTriggers.includes(k as keyof QuoteItem))
      if (hasKhoChange && next.khong_ct && next.kho_tt && next.dai_tt) {
        next.dien_tich = Math.round(next.kho_tt * next.dai_tt / 10000 * 10000) / 10000
      }

      const temTriggers: (keyof QuoteItem)[] = ['tem_loai_giay', 'tem_gsm']
      if (Object.keys(patch).some(k => temTriggers.includes(k as keyof QuoteItem)) && next.tem_loai_giay) {
        const match = temPaperList.find(p =>
          p.loai_giay === next.tem_loai_giay &&
          (p.gsm == null || Number(p.gsm) === (next.tem_gsm ?? 0))
        ) ?? temPaperList.find(p => p.loai_giay === next.tem_loai_giay && p.gsm == null)
        if (match) next.tem_don_gia_kg = Number(match.don_gia_kg)
      }

      if (hasDimChange && !next.product_id) {
        const isAutoName = !next.ten_hang || next.ten_hang.startsWith('Thùng Carton') || next.ten_hang.startsWith('Tấm ')
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

      const hasAddonChange = Object.keys(patch).some(k => ADDON_TRIGGER_KEYS.includes(k as keyof QuoteItem))
      if (hasAddonChange) next.ghi_chu = buildGhiChu(next) || null

      const hasPaperChange = Object.keys(patch).some(k => [
        'mat', 'mat_dl', 'song_1', 'song_1_dl', 'mat_1', 'mat_1_dl',
        'song_2', 'song_2_dl', 'mat_2', 'mat_2_dl', 'song_3', 'song_3_dl', 'mat_3', 'mat_3_dl',
      ].includes(k))
      if (hasPaperChange) {
        next.ma_ky_hieu = buildPaperSymbol(next, paperCodes)
        const computed = calcDonGiaM2(next, giaBanMap)
        if (computed !== null) next.don_gia_m2 = computed
      }

      return next
    })

  // ── Auto-recalc dims effect ────────────────────────────────
  useEffect(() => {
    if (currentItem.khong_ct) return
    const calc = calcBoxDimensions(
      currentItem.loai_thung, currentItem.dai, currentItem.rong, currentItem.cao,
      currentItem.so_lop, currentItem.be_so_con ?? 1, currentItem.loai_be, currentItem.be_hai_manh,
    )
    if (!calc) return
    setCurrentItem(prev => ({ ...prev, kho_tt: calc.kho_tt, dai_tt: calc.dai_tt, dien_tich: calc.dien_tich, kho_sx: calc.kho_sx, dai_sx: calc.dai_sx }))
  }, [
    currentItem.khong_ct, currentItem.loai_thung,
    currentItem.dai, currentItem.rong, currentItem.cao,
    currentItem.so_lop, currentItem.be_so_con, currentItem.loai_be, currentItem.be_hai_manh,
  ])

  // ── Auto-price calc effect ─────────────────────────────────
  useEffect(() => {
    if (!(!giaBanManualRef.current && hasFormulaPriceData(currentItem))) return
    const timer = window.setTimeout(() => applyFormulaPrice(currentItem), 500)
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
    currentItem.boi, currentItem.be_lo, currentItem.dan, currentItem.ghim, currentItem.do_kho,
    applyFormulaPrice,
  ])

  // ── Autosave cleanup ───────────────────────────────────────
  useEffect(() => {
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current) }
  }, [])

  // ── Item CRUD handlers ─────────────────────────────────────
  const handleAddItem = async () => {
    if (!currentItem.ten_hang) { message.warning('Vui lòng nhập tên hàng'); return }
    const _saveCalc = !currentItem.khong_ct
      ? calcBoxDimensions(currentItem.loai_thung, currentItem.dai, currentItem.rong, currentItem.cao,
          currentItem.so_lop, currentItem.be_so_con ?? 1, currentItem.loai_be)
      : null
    const itemToSave: QuoteItem = {
      ...currentItem,
      ma_ky_hieu: currentItem.ma_ky_hieu || buildPaperSymbol(currentItem, paperCodes),
      ...(_saveCalc ? { kho_tt: _saveCalc.kho_tt, dai_tt: _saveCalc.dai_tt, dien_tich: _saveCalc.dien_tich, kho_sx: _saveCalc.kho_sx, dai_sx: _saveCalc.dai_sx } : {}),
      gia_ban: finance.gia_ban || currentItem.gia_ban,
    }
    let newItems: QuoteItem[]
    if (editingIdx !== null) {
      newItems = items.map((it, i) => i === editingIdx ? { ...itemToSave, stt: it.stt } : it)
      setEditingIdx(null)
    } else {
      newItems = [...items, { ...itemToSave, stt: items.length + 1 }]
    }
    setItems(newItems)
    const tongTienHang = newItems.reduce((sum, it) => sum + (it.gia_ban || 0) * (it.so_luong || 0), 0)
    updateFinance({ tong_tien_hang: tongTienHang })
    setCurrentItem(emptyItem())
    giaBanManualRef.current = false
    setProductOptions([])
  }

  const handleEditItem = (idx: number) => {
    const item = items[idx]
    let loadedItem = item
    if (!item.khong_ct && item.loai_thung && item.dai && item.rong) {
      const calc = calcBoxDimensions(item.loai_thung, item.dai, item.rong, item.cao, item.so_lop, item.be_so_con ?? 1, item.loai_be)
      if (calc) loadedItem = { ...item, kho_tt: calc.kho_tt, dai_tt: calc.dai_tt, dien_tich: calc.dien_tich, kho_sx: calc.kho_sx, dai_sx: calc.dai_sx }
    }
    setCurrentItem(loadedItem)
    giaBanManualRef.current = false
    const savedGiaBan = Number(item.gia_ban || 0)
    financeGiaBanLockRef.current = savedGiaBan > 0 && !!(item.product_id)
    if (savedGiaBan > 0) setFinance(prev => recalcFinance({ ...prev, gia_ban: savedGiaBan }))
    setEditingIdx(idx)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (item.product_id && item.ma_amis) {
      setProductOptions([{ value: item.product_id, label: `[${item.ma_amis}] ${item.ten_hang}`, record: { id: item.product_id, ma_amis: item.ma_amis, ten_hang: item.ten_hang } as ProductFull }])
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

  const handleCopyItem = (idx: number) => {
    const { id: _id, stt: _stt, ...rest } = items[idx]
    setCurrentItem({ ...rest, stt: items.length + 1 })
    giaBanManualRef.current = false
    setEditingIdx(null)
    if (rest.product_id && rest.ma_amis) {
      setProductOptions([{ value: rest.product_id, label: `[${rest.ma_amis}] ${rest.ten_hang}`, record: { id: rest.product_id, ma_amis: rest.ma_amis, ten_hang: rest.ten_hang } as ProductFull }])
    } else {
      setProductOptions([])
    }
    message.info('Đã sao chép — chỉnh sửa nếu cần rồi nhấn "Thêm vào danh sách"')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setCurrentItem(emptyItem())
    setEditingIdx(null)
    setProductOptions([])
  }

  const handleAutoName = () => {
    const ci = currentItem
    const name = ci.loai_thung === 'LOT'
      ? `Tấm ${ci.so_lop}L`
      : ci.dai && ci.rong && ci.cao != null
        ? `Thùng Carton ${ci.dai}x${ci.rong}x${ci.cao} ${ci.so_lop}L`
        : `Thùng Carton ${ci.so_lop}L`
    setCI({ ten_hang: name })
  }

  // ── Submit ─────────────────────────────────────────────────
  const doSave = async () => {
    try {
      const vals = await headerForm.validateFields()
      const payload: CreateQuotePayload = {
        customer_id:     vals.customer_id,
        ngay_bao_gia:    vals.ngay_bao_gia.format('YYYY-MM-DD'),
        ngay_het_han:    vals.ngay_het_han?.format('YYYY-MM-DD') || null,
        phap_nhan_id:    vals.phap_nhan_id || null,
        phap_nhan_sx_id: vals.phap_nhan_sx_id || null,
        phan_xuong_id:   vals.phan_xuong_id || null,
        nv_phu_trach_id: vals.nv_phu_trach_id || null,
        nv_theo_doi_id:  vals.nv_theo_doi_id || null,
        so_bg_copy:      vals.so_bg_copy || null,
        ghi_chu:         vals.ghi_chu || null,
        dieu_khoan:      vals.dieu_khoan || null,
        ...finance,
        items: items.map(({ id: _id, ...rest }) => ({
          ...rest,
          ma_ky_hieu: rest.ma_ky_hieu || buildPaperSymbol(rest, paperCodes),
        })),
      }
      if (isEdit) updateMutation.mutate(payload)
      else createMutation.mutate(payload)
    } catch { /* validateFields shows inline errors */ }
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

  const editableStatuses = canApprove ? ['moi', 'cho_duyet'] : ['moi']
  const isReadonly = isEdit && !!quoteData && !editableStatuses.includes(quoteData.trang_thai)

  const triggerAutosave = useCallback(() => {
    if (!isEdit || isReadonly) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      if (!headerForm.isFieldsTouched()) return
      try {
        const vals = headerForm.getFieldsValue(true) as Record<string, unknown>
        autosaveMutation.mutate(vals as Partial<CreateQuotePayload>)
      } catch { /* silent */ }
    }, 3000)
  }, [isEdit, isReadonly, headerForm, autosaveMutation])

  if (loadingQuote) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div style={{ maxWidth: 1600 }}>
      <style>{`
        .editing-row > td { background-color: #e6f7ff !important; outline: 2px solid #1677ff; }
        .no-price-row > td { background-color: #fffbe6 !important; }
      `}</style>

      <QuoteToolbar
        isEdit={isEdit}
        quoteData={quoteData}
        onBack={() => navigate('/quotes')}
        isReadonly={isReadonly}
        canApprove={canApprove}
        isPendingSave={createMutation.isPending || updateMutation.isPending}
        onSave={handleSubmit}
        isSubmitting={submitMutation.isPending}
        onSubmit={() => submitMutation.mutate()}
        isApproving={approveMutation.isPending}
        onApprove={() => approveMutation.mutate()}
        items={items}
        isCreatingOrder={taoDonMutation.isPending}
        onOpenCreateOrder={() => setSelectItemsModal(true)}
        lastSavedAt={lastSavedAt}
      />

      <QuoteHeaderForm
        form={headerForm}
        isEdit={isEdit}
        isReadonly={isReadonly}
        triggerAutosave={triggerAutosave}
        customerOptions={customerOptions}
        customerSearching={customerSearching}
        onCustomerSearch={handleCustomerSearch}
        onCustomerChange={() => { setProductOptions([]); loadProductOptions('') }}
        onCustomerCreated={(rec) =>
          setCustomerOptions(prev => [...prev, {
            value: rec.id as number,
            label: (rec.ten_viet_tat as string) ?? '',
            ma_kh: (rec.ma_kh as string) ?? '',
          }])
        }
        phapNhanList={phapNhanList}
        phanXuongList={phanXuongList}
        nhanVienList={nhanVienList}
      />

      {!isReadonly && (
        <QuoteItemEditor
          ci={currentItem}
          setCI={setCI}
          editingIdx={editingIdx}
          onAdd={handleAddItem}
          onCancelEdit={handleCancelEdit}
          mkList={mkList}
          byMk={byMk}
          paperCodes={paperCodes}
          productOptions={productOptions}
          productSearching={productSearching}
          onProductSearch={q => loadProductOptions(q)}
          onProductDropdownOpen={handleProductDropdownOpen}
          onProductSelect={handleProductSelect}
          onProductClear={handleProductClear}
          isCalcLoading={isCalcLoading}
          hasFormulaPriceData={hasFormulaPriceData}
          onCalcForce={() => { giaBanManualRef.current = false; applyFormulaPrice(currentItem, true) }}
          temPaperList={temPaperList}
          getAddonPrice={getAddonPrice}
          finance={finance}
          updateFinance={updateFinance}
          onGiaBanChange={handleGiaBanChange}
          phanXuongList={phanXuongList}
          onOpenCauTruc={() => setCauTrucModal(true)}
          onAutoName={handleAutoName}
          getCustomerId={() => headerForm.getFieldValue('customer_id') as number | undefined}
          onSaveToProduct={currentItem.product_id != null ? handleSaveCurrentItemToProduct : undefined}
          saveToProductLoading={saveToProductLoading}
          hideCostDetails={role === 'SALE_ADMIN' || role === 'SALE_ADMIN_TO_TRUONG'}
        />
      )}

      {/* Ghi chú & Điều khoản */}
      <Card style={{ marginBottom: 12 }}>
        <Form form={headerForm} layout="vertical" disabled={isReadonly} onValuesChange={triggerAutosave}>
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

      {/* Items table */}
      <Card title={<Text strong>Chi tiết mặt hàng ({items.length} dòng)</Text>}>
        <QuoteItemsTable
          items={items}
          editingIdx={editingIdx}
          isReadonly={isReadonly}
          paperCodes={paperCodes}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onCopy={handleCopyItem}
          hideCostDetails={role === 'SALE_ADMIN' || role === 'SALE_ADMIN_TO_TRUONG'}
        />
      </Card>

      {/* Kết cấu quick-select modal */}
      <CauTrucModal
        open={cauTrucModal}
        soLop={currentItem.so_lop}
        onClose={() => setCauTrucModal(false)}
        onSelect={(ct) => {
          setCI({
            so_lop: ct.so_lop, to_hop_song: ct.to_hop_song,
            mat: ct.mat,       mat_dl: ct.mat_dl,
            song_1: ct.song_1, song_1_dl: ct.song_1_dl,
            mat_1:  ct.mat_1,  mat_1_dl:  ct.mat_1_dl,
            song_2: ct.song_2, song_2_dl: ct.song_2_dl,
            mat_2:  ct.mat_2,  mat_2_dl:  ct.mat_2_dl,
            song_3: ct.song_3, song_3_dl: ct.song_3_dl,
            mat_3:  ct.mat_3,  mat_3_dl:  ct.mat_3_dl,
          })
          setCauTrucModal(false)
          message.success(`Đã chọn: ${ct.ten_cau_truc}`)
        }}
      />

      <TaoDonHangModal
        open={selectItemsModal}
        items={items}
        loading={taoDonMutation.isPending}
        onCancel={() => setSelectItemsModal(false)}
        onOk={(result) => taoDonMutation.mutate(result)}
      />
    </div>
  )
}
