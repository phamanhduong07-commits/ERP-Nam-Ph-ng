import React, { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Col, DatePicker, Descriptions, Divider, Drawer, Empty, Form, Input, InputNumber,
  message as antdMessage, Modal, Row, Select, Space, Spin, Statistic, Table, Tabs, Tooltip, Typography, Tag, App
} from 'antd'
import { DeleteOutlined, EditOutlined, ExportOutlined, EyeOutlined, FileTextOutlined, PrinterOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

import { yeuCauApi, deliveriesApi, YEU_CAU_TRANG_THAI_LABELS, YEU_CAU_TRANG_THAI_COLORS, CONG_NO_LABELS, CONG_NO_COLORS } from '../../api/deliveries'
import type { YeuCauGiaoHang, DeliveryOrder } from '../../api/deliveries'
import { xeApi, loXeApi, taiXeApi } from '../../api/simpleApis'
import client from '../../api/client'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoTPRow, TonKhoPhoiLsxRow } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { customersApi } from '../../api/customers'
import { billingApi } from '../../api/billing'
import { usePhapNhanForPrint, usePhapNhanList } from '../../hooks/usePhapNhan'
import { COMPANY_CONFIGS, exportExcelWithTemplate } from '../../utils/exportUtils'
import { systemApi } from '../../api/system'

const GH_FILTER_KEY = 'gh-do-filter'

const { Text } = Typography

const DO_TRANG_THAI_LABELS: Record<string, string> = {
  nhap: 'Nháp',
  da_xuat: 'Đã xuất',
  da_giao: 'Đã giao',
  huy: 'Huỷ',
}
const DO_TRANG_THAI_COLORS: Record<string, string> = {
  nhap: 'default',
  da_xuat: 'blue',
  da_giao: 'green',
  huy: 'red',
}

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'

const fmtMoney = (v: number) =>
  v ? new Intl.NumberFormat('vi-VN').format(v) : '0'

export default function TabGiaoHang(_props?: { initialSelectedPOKeys?: number[] }) {
  const { message } = App.useApp()
  const companyInfo = usePhapNhanForPrint()
  const navigate = useNavigate()
  const { data: templates = [] } = useQuery({
    queryKey: ['print-templates'],
    queryFn: systemApi.getTemplates,
    staleTime: 0,
  })

  const { data: phapNhanList = [] } = usePhapNhanList()
  const qc = useQueryClient()

  // ── Detail drawer ─────────────────────────────────────────────────────────
  const [detailId, setDetailId] = useState<number | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  // ── Adjust modal ──────────────────────────────────────────────────────────
  type AdjItem = { item_id: number; so_lenh: string | null; ten_hang: string; dvt: string; don_gia: number; so_luong: number; thanh_tien: number }
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjItems, setAdjItems] = useState<AdjItem[]>([])
  const [adjGhiChu, setAdjGhiChu] = useState('')
  const adjTotal = adjItems.reduce((s, it) => s + it.thanh_tien, 0)

  const openAdjust = (order: DeliveryOrder) => {
    setAdjItems(order.items.map(it => ({
      item_id: it.id,
      so_lenh: it.so_lenh,
      ten_hang: it.ten_hang,
      dvt: it.dvt,
      don_gia: it.don_gia,
      so_luong: it.so_luong,
      thanh_tien: it.thanh_tien,
    })))
    setAdjGhiChu('')
    setShowAdjust(true)
  }

  const adjustMut = useMutation({
    mutationFn: ({ id, items, ghi_chu }: { id: number; items: AdjItem[]; ghi_chu: string }) =>
      deliveriesApi.adjustItems(id, items.map(it => ({ item_id: it.item_id, so_luong_moi: it.so_luong })), ghi_chu),
    onSuccess: (res: any) => {
      message.success(res.data?.message ?? 'Đã điều chỉnh phiếu bán hàng')
      setShowAdjust(false)
      qc.invalidateQueries({ queryKey: ['delivery-detail', detailId] })
      qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi điều chỉnh'),
  })
  const { data: detailOrder, isLoading: loadingDetail } = useQuery({
    queryKey: ['delivery-detail', detailId],
    queryFn: () => deliveriesApi.get(detailId!).then(r => r.data),
    enabled: !!detailId,
  })

  const openDetail = (row: DeliveryOrder) => {
    setDetailId(row.id)
    setShowDetail(true)
  }

  // ── Master data ────────────────────────────────────────────────────────────
  const { data: allWarehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => warehousesApi.list().then(r => r.data) })
  const { data: xeList = [] } = useQuery({ queryKey: ['xe'], queryFn: () => xeApi.list().then(r => r.data) })
  const { data: taiXeList = [] } = useQuery({ queryKey: ['tai-xe'], queryFn: () => taiXeApi.list().then(r => r.data) })
  const { data: loXeList = [] } = useQuery({ queryKey: ['lo-xe'], queryFn: () => loXeApi.list().then(r => r.data) })
  const { data: tripRate } = useQuery({ queryKey: ['hr-trip-rate'], queryFn: () => client.get('/hr/trip-rate').then(r => r.data) })
  const { data: customers = [] } = useQuery({ queryKey: ['customers-all'], queryFn: () => customersApi.all().then(r => r.data) })

  const pickableWarehouses = allWarehouses.filter(w => ['PHOI', 'THANH_PHAM', 'KHO_KHAC'].includes(w.loai_kho))

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('ton-kho-tp')

  // ── 1. Tồn kho Thành phẩm (Thùng) — debounce 400ms ─────────────────────────
  const [tpInputText, setTPInputText] = useState({ ten_khach: '', so_lenh: '' })
  const [tpFilter, setTPFilter] = useState({ ten_khach: '', so_lenh: '' })
  const [tpKhoFilter, setTpKhoFilter] = useState<number | null>(null)
  const tpDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: tonKhoTP = [], isLoading: loadingTP } = useQuery({
    queryKey: ['warehouse-ton-kho-tp', tpFilter],
    queryFn: () => warehouseApi.getTonKhoTpLsx(tpFilter).then(r => r.data),
  })
  const filteredTonKhoTP = tpKhoFilter
    ? tonKhoTP.filter(r => r.warehouse_id === tpKhoFilter)
    : tonKhoTP
  const [selectedTPKeys, setSelectedTPKeys] = useState<React.Key[]>([])

  // ── 2. Tồn kho Phôi (Giấy tấm) — debounce 400ms ────────────────────────────
  const [phoiInputKhach, setPhoiInputKhach] = useState('')
  const [phoiFilter, setPhoiFilter] = useState({ search: '' })
  const [phoiKhachFilter, setPhoiKhachFilter] = useState('')
  const phoiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: tonKhoPhoi = [], isLoading: loadingPhoi } = useQuery({
    queryKey: ['warehouse-ton-kho-phoi-lsx', phoiFilter],
    queryFn: () => warehouseApi.getTonKhoPhoiLsx(phoiFilter).then(r => r.data),
  })
  const filteredTonKhoPhoi = phoiKhachFilter
    ? tonKhoPhoi.filter(r => r.ten_khach_hang?.toLowerCase().includes(phoiKhachFilter.toLowerCase()))
    : tonKhoPhoi
  const [selectedPhoiKeys, setSelectedPhoiKeys] = useState<React.Key[]>([])

  // ── 3. Yêu cầu giao hàng ───────────────────────────────────────────────────
  const [ycDateRange, setYcDateRange] = useState<[string, string] | null>(null)
  const [ycTenKhachInput, setYcTenKhachInput] = useState('')
  const [ycTenKhach, setYcTenKhach] = useState('')
  const ycDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: yeuCauList = [], isLoading: loadingYC } = useQuery({
    queryKey: ['yeu-cau-giao-hang', ycTenKhach, ycDateRange],
    queryFn: () => yeuCauApi.list({
      trang_thai: 'moi',
      ten_khach: ycTenKhach || undefined,
      tu_ngay: ycDateRange?.[0] || undefined,
      den_ngay: ycDateRange?.[1] || undefined,
    }).then(r => r.data),
  })

  // ── 4. Lịch sử Phiếu BH — filter persistence + debounce ───────────────────
  const loadSavedFilter = () => {
    try {
      const raw = sessionStorage.getItem(GH_FILTER_KEY)
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return null
  }
  const saved = loadSavedFilter()
  const [doFilter, setDOFilterState] = useState<{ tu_ngay: string; den_ngay: string; ten_khach?: string; so_phieu?: string; phap_nhan_id?: number }>(
    saved?.doFilter ?? { tu_ngay: dayjs().subtract(7, 'day').format('YYYY-MM-DD'), den_ngay: dayjs().format('YYYY-MM-DD') }
  )
  const [doStatusFilter, setDoStatusFilterState] = useState<string | null>(saved?.doStatusFilter ?? null)
  const [doShortcut, setDoShortcutState] = useState<string | null>(saved?.doShortcut ?? null)

  // Input texts (debounced)
  const [doTenKhachInput, setDoTenKhachInput] = useState(saved?.doFilter?.ten_khach ?? '')
  const [doSoPhieuInput, setDoSoPhieuInput] = useState(saved?.doFilter?.so_phieu ?? '')
  const doDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setDOFilter = (next: typeof doFilter) => {
    setDOFilterState(next)
    sessionStorage.setItem(GH_FILTER_KEY, JSON.stringify({ doFilter: next, doStatusFilter, doShortcut }))
  }
  const setDoStatusFilter = (v: string | null) => {
    setDoStatusFilterState(v)
    sessionStorage.setItem(GH_FILTER_KEY, JSON.stringify({ doFilter, doStatusFilter: v, doShortcut }))
  }
  const setDoShortcut = (v: string | null) => {
    setDoShortcutState(v)
    sessionStorage.setItem(GH_FILTER_KEY, JSON.stringify({ doFilter, doStatusFilter, doShortcut: v }))
  }

  const { data: deliveryList = [], isLoading: loadingDO, isError: isErrorDO, error: errorDO, refetch: refetchDO } = useQuery({
    queryKey: ['deliveries', doFilter],
    queryFn: () => deliveriesApi.list(doFilter).then(r => r.data),
    refetchOnMount: 'always',
  })

  const filteredDeliveryList = useMemo(() => {
    let list = deliveryList
    if (doStatusFilter) list = list.filter(d => d.trang_thai === doStatusFilter)
    if (doShortcut === 'chua_thu') list = list.filter(d => d.trang_thai_cong_no === 'chua_thu')
    return list
  }, [deliveryList, doStatusFilter, doShortcut])

  // ── Xác nhận giao hàng modal ─────────────────────────────────────────────
  const [xacNhanModalOpen, setXacNhanModalOpen] = useState(false)
  const [xacNhanOrderId, setXacNhanOrderId] = useState<number | null>(null)
  const [xacNhanForm] = Form.useForm()

  // ── Modals logic ──────────────────────────────────────────────────────────
  const [showDOModal, setShowDOModal] = useState(false)
  const [isRequest, setIsRequest] = useState(false)
  const [selectedYC, setSelectedYC] = useState<YeuCauGiaoHang | null>(null)
  const [doForm] = Form.useForm()
  const [doItems, setDOItems] = useState<any[]>([])
  const doTotalM2 = doItems.reduce((s, it) => s + Number(it.dien_tich || 0), 0)
  const defaultTripRate = Number(tripRate?.don_gia_m2 || 0)
  const estimatedTripMoney = doTotalM2 * defaultTripRate

  // ── Form watch for trip salary breakdown ────────────────────────────────────
  const watchedTaiXeId = Form.useWatch('tai_xe_id', doForm)
  const watchedLoXeId = Form.useWatch('lo_xe_id', doForm)
  const watchedLoXeId2 = Form.useWatch('lo_xe_id_2', doForm)

  const tripBreakdown = useMemo(() => {
    if (!defaultTripRate || !doTotalM2) return []
    const quy = doTotalM2 * defaultTripRate
    const crew: { id: number; name: string; heSo: number; role: string }[] = []
    if (watchedTaiXeId) {
      const tx = taiXeList.find(x => x.id === watchedTaiXeId)
      if (tx) crew.push({ id: tx.id, name: tx.ho_ten, heSo: tx.he_so_chuyen ?? 1.0, role: 'Tài xế' })
    }
    if (watchedLoXeId) {
      const lx = loXeList.find(x => x.id === watchedLoXeId)
      if (lx) crew.push({ id: lx.id, name: lx.ho_ten, heSo: lx.he_so_chuyen ?? 0.3, role: 'Lơ xe' })
    }
    if (watchedLoXeId2) {
      const lx2 = loXeList.find(x => x.id === watchedLoXeId2)
      if (lx2) crew.push({ id: lx2.id, name: lx2.ho_ten, heSo: lx2.he_so_chuyen ?? 0.3, role: 'Lơ xe 2' })
    }
    if (!crew.length) return [{ name: '—', role: '', heSo: 1, luong: quy }]
    const totalHeSo = crew.reduce((s, c) => s + c.heSo, 0)
    return crew.map(c => ({ ...c, luong: Math.round(quy * c.heSo / totalHeSo) }))
  }, [watchedTaiXeId, watchedLoXeId, watchedLoXeId2, doTotalM2, defaultTripRate, taiXeList, loXeList])

  const openDOModalFromTP = () => {
    const selectedRows = tonKhoTP.filter(r => selectedTPKeys.includes(r.production_order_id))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }
    
    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      product_id: r.product_id,
      sales_order_item_id: r.sales_order_item_id,
      so_lenh: r.so_lenh,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: r.dvt || 'Thùng',
      don_gia: r.don_gia || 0,
      thanh_tien: r.ton_kho * (r.don_gia || 0),
      dien_tich: r.dien_tich || 0,
      trong_luong: r.trong_luong || 0,
      ghi_chu: '',
    })))
    
    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      customer_id: selectedRows[0].customer_id,
      dia_chi_giao: selectedRows[0].dia_chi_giao,
      warehouse_id: selectedRows[0].warehouse_id,
      phap_nhan_id: selectedRows[0].phap_nhan_id,
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const openYCModalFromTP = () => {
    const selectedRows = tonKhoTP.filter(r => selectedTPKeys.includes(r.production_order_id))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }

    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      product_id: r.product_id,
      sales_order_item_id: r.sales_order_item_id,
      so_lenh: r.so_lenh,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: r.dvt || 'Thùng',
      dien_tich: r.dien_tich || 0,
      trong_luong: r.trong_luong || 0,
    })))

    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      customer_id: selectedRows[0].customer_id,
      dia_chi_giao: selectedRows[0].dia_chi_giao,
      warehouse_id: selectedRows[0].warehouse_id,
      phap_nhan_id: selectedRows[0].phap_nhan_id,
    })
    setIsRequest(true)
    setShowDOModal(true)
  }

  const openDOModalFromPhoi = () => {
    const selectedRows = tonKhoPhoi.filter(r => selectedPhoiKeys.includes(`${r.production_order_id}-${r.warehouse_id}`))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }

    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: 'Tấm',
      don_gia: 0,
      thanh_tien: 0,
      dien_tich: r.chieu_kho && r.chieu_cat ? r.chieu_kho * r.chieu_cat * r.ton_kho / 1_000_000 : 0,
      trong_luong: 0,
      ghi_chu: '',
    })))
    
    const r0 = selectedRows[0]
    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      customer_id: customers.find(c => c.ten_viet_tat === r0.ten_khach_hang)?.id,
      warehouse_id: r0.warehouse_id,
      phap_nhan_id: r0.phap_nhan_sx_id,
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const openYCModalFromPhoi = () => {
    const selectedRows = tonKhoPhoi.filter(r => selectedPhoiKeys.includes(`${r.production_order_id}-${r.warehouse_id}`))
    if (!selectedRows.length) { message.warning('Chọn ít nhất 1 dòng tồn kho'); return }

    setDOItems(selectedRows.map(r => ({
      production_order_id: r.production_order_id,
      ten_hang: r.ten_hang,
      so_luong: r.ton_kho,
      dvt: 'Tấm',
      dien_tich: r.chieu_kho && r.chieu_cat ? r.chieu_kho * r.chieu_cat * r.ton_kho / 1_000_000 : 0,
      trong_luong: 0,
    })))

    const r0 = selectedRows[0]
    doForm.resetFields()
    doForm.setFieldsValue({
      ngay_xuat: dayjs(),
      customer_id: customers.find(c => c.ten_viet_tat === r0.ten_khach_hang)?.id,
      warehouse_id: r0.warehouse_id,
      phap_nhan_id: r0.phap_nhan_sx_id,
    })
    setIsRequest(true)
    setShowDOModal(true)
  }

  const openDOModalFromYC = (yc: YeuCauGiaoHang) => {
    setSelectedYC(yc)
    setDOItems(yc.items.map(it => ({
      production_order_id: it.production_order_id,
      ten_hang: it.ten_hang,
      so_luong: it.so_luong,
      dvt: it.dvt,
      don_gia: 0,
      thanh_tien: 0,
      dien_tich: it.dien_tich,
      trong_luong: it.trong_luong,
      ghi_chu: '',
    })))
    doForm.resetFields()
    doForm.setFieldsValue({ 
      ngay_xuat: dayjs(),
      customer_id: yc.customer_id,
      dia_chi_giao: yc.dia_chi_giao,
      nguoi_nhan: yc.nguoi_nhan,
      warehouse_id: yc.items[0]?.warehouse_id
    })
    setIsRequest(false)
    setShowDOModal(true)
  }

  const createYCMutation = useMutation({
    mutationFn: (payload: any) => yeuCauApi.create(payload).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo yêu cầu giao hàng thành công')
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      setShowDOModal(false)
      setSelectedTPKeys([])
      setSelectedPhoiKeys([])
      setActiveTab('yeu-cau')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo yêu cầu'),
  })

  const createDOMutation = useMutation({
    mutationFn: (payload: any) => deliveriesApi.create(payload).then(r => r.data),
    onSuccess: () => {
      message.success('Tạo phiếu bán hàng thành công')
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
      qc.invalidateQueries({ queryKey: ['warehouse-ton-kho-tp'] })
      qc.invalidateQueries({ queryKey: ['warehouse-ton-kho-phoi'] })
      setShowDOModal(false)
      setSelectedYC(null)
      setSelectedTPKeys([])
      setSelectedPhoiKeys([])
      setActiveTab('phieu-ban-hang')
      // Force immediate refetch so the new phiếu appears without waiting for invalidation
      setTimeout(() => refetchDO(), 100)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, trang_thai }: { id: number; trang_thai: string }) =>
      deliveriesApi.updateStatus(id, trang_thai),
    onSuccess: () => {
      message.success('Đổi trạng thái thành công')
      qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi đổi trạng thái'),
  })

  const xacNhanMutation = useMutation({
    mutationFn: ({ id, ngay_giao, ten_nguoi_nhan, ghi_chu }: { id: number; ngay_giao: string; ten_nguoi_nhan: string; ghi_chu?: string }) =>
      deliveriesApi.xacNhan(id, { ngay_giao, ten_nguoi_nhan, ghi_chu }),
    onSuccess: () => {
      message.success('Xác nhận giao hàng thành công')
      setXacNhanModalOpen(false)
      xacNhanForm.resetFields()
      qc.invalidateQueries({ queryKey: ['deliveries'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xác nhận giao hàng'),
  })

  const handleStatusChange = (id: number, v: string) => {
    if (v === 'da_giao') {
      setXacNhanOrderId(id)
      xacNhanForm.setFieldsValue({ ngay_giao: dayjs(), ten_nguoi_nhan: '', ghi_chu: '' })
      setXacNhanModalOpen(true)
    } else {
      updateStatusMutation.mutate({ id, trang_thai: v })
    }
  }

  const deleteYCMutation = useMutation({
    mutationFn: (id: number) => yeuCauApi.delete(id),
    onSuccess: () => {
      message.success('Đã xoá yêu cầu giao hàng')
      qc.invalidateQueries({ queryKey: ['yeu-cau-giao-hang'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá YC'),
  })

  // ── Modal ghi nhận công nợ (chọn VAT + upload ảnh) ──────────────────────────
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceDeliveryId, setInvoiceDeliveryId] = useState<number | null>(null)
  const [invoiceVat, setInvoiceVat] = useState<number>(10)
  const [invoicePhotoFile, setInvoicePhotoFile] = useState<File | null>(null)

  const openInvoiceModal = (deliveryId: number) => {
    setInvoiceDeliveryId(deliveryId)
    setInvoiceVat(10)
    setInvoicePhotoFile(null)
    setInvoiceModalOpen(true)
  }

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ deliveryId, vatPct, photoFile }: {
      deliveryId: number
      vatPct: number
      photoFile: File | null
    }) => {
      const invoice = await billingApi.createFromDelivery(deliveryId, vatPct)
      if (photoFile) {
        await billingApi.uploadPhoto(invoice.id, photoFile)
      }
      return invoice
    },
    onSuccess: () => {
      message.success('Ghi nhận công nợ thành công')
      setInvoiceModalOpen(false)
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['delivery-detail', detailId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi ghi nhận công nợ'),
  })

  const printHtml = (html: string) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:0;visibility:hidden'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) { message.error('Không thể tạo khung in'); return }
    doc.open(); doc.write(html); doc.close()
    iframe.contentWindow?.addEventListener('load', () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    })
  }

  const handlePrint = async (order: DeliveryOrder) => {
    let ro: DeliveryOrder
    try {
      ro = (await deliveriesApi.get(order.id)).data
    } catch {
      message.error('Không thể tải dữ liệu in')
      return
    }

    // Resolve company info từ phap_nhan (explicit trên phiếu hoặc từ kho)
    const pn = ro.phap_nhan_id ? phapNhanList.find(p => p.id === ro.phap_nhan_id) : undefined
    if (!pn) {
      antdMessage.error('Phiếu giao hàng chưa có pháp nhân nên không thể in')
      return
    }
    const _nm = pn?.ten_phap_nhan.toUpperCase() ?? ''
    const fallbackCfg = _nm.includes('VISUNPACK') ? COMPANY_CONFIGS['VISUNPACK']
      : (_nm.includes('L.A') || _nm.includes('LONG AN')) ? COMPANY_CONFIGS['NAM PHUONG LONG AN']
      : COMPANY_CONFIGS['NAM PHUONG']
    const co = pn
      ? { ...fallbackCfg, ten: pn.ten_phap_nhan, dia_chi: pn.dia_chi ?? fallbackCfg?.dia_chi, so_dien_thoai: pn.so_dien_thoai ?? fallbackCfg?.so_dien_thoai }
      : (companyInfo ?? fallbackCfg)
    const logoSrc = pn?.logo_path
      ? `/${pn.logo_path.replace(/^\//, '')}`
      : (fallbackCfg?.logo || '/logo_namphuong.png')

    const isPhoi = ro.loai_kho === 'PHOI'

    const vi = new Intl.NumberFormat('vi-VN')
    const viDec = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
    const fmtD = (v: number | null | undefined) => v ? parseFloat(v.toFixed(2)).toString() : ''
    const fmtDateStr = (v: string | null | undefined) => {
      if (!v) return '—'
      const d = new Date(v)
      return isNaN(d.getTime()) ? v : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    }

    const totSL   = ro.items.reduce((s, it) => s + it.so_luong, 0)
    const totM2   = ro.tong_dien_tich
    const totM3   = ro.tong_the_tich
    const totKg   = ro.tong_trong_luong
    const totTien = ro.tong_thanh_toan

    let tableHtml: string
    if (isPhoi) {
      tableHtml = `<table>
        <thead><tr>
          <th style="text-align:center;width:28px">STT</th>
          <th>Số PO</th><th>Số LSX</th><th>Ngày PO</th>
          <th>Quy cách/Kết cấu</th><th>Khổ × Cắt (mm)</th>
          <th style="text-align:right">Số lượng</th><th>ĐVT</th>
          <th style="text-align:right">M²</th>
          <th style="text-align:right">Kg</th>
          <th>Ghi chú</th>
        </tr></thead>
        <tbody>${ro.items.map((it,i) => {
          const khoCat = it.kho_tt && it.dai_tt ? `${fmtD(it.kho_tt)}×${fmtD(it.dai_tt)}` : '—'
          const m2 = it.dien_tich && it.dien_tich > 0 ? it.dien_tich
            : (it.kho_tt && it.dai_tt ? it.kho_tt * it.dai_tt * it.so_luong / 1_000_000 : 0)
          return `<tr>
            <td style="text-align:center">${i+1}</td>
            <td>${it.so_don_item||'—'}</td>
            <td><b>${it.so_lenh||'—'}</b></td>
            <td>${fmtDateStr(it.ngay_po)}</td>
            <td>${it.quy_cach||it.ket_cau||'—'}</td>
            <td>${khoCat}</td>
            <td style="text-align:right"><b>${vi.format(it.so_luong)}</b></td>
            <td>${it.dvt}</td>
            <td style="text-align:right">${m2 > 0 ? viDec.format(m2) : '—'}</td>
            <td style="text-align:right">${it.trong_luong && it.trong_luong > 0 ? viDec.format(it.trong_luong) : '—'}</td>
            <td>${it.ghi_chu||''}</td>
          </tr>`
        }).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#E8F5E9;">
          <td colspan="6" style="text-align:right">Tổng cộng:</td>
          <td style="text-align:right">${vi.format(totSL)}</td>
          <td></td>
          <td style="text-align:right">${totM2 ? viDec.format(totM2) : '—'}</td>
          <td style="text-align:right">${totKg ? viDec.format(totKg) : '—'}</td>
          <td></td>
        </tr></tfoot>
      </table>`
    } else {
      tableHtml = `<table>
        <colgroup>
          <col style="width:30px"><col style="width:90px"><col style="width:90px"><col style="width:72px">
          <col style="width:auto"><col style="width:auto"><col style="width:36px">
          <col style="width:58px"><col style="width:80px"><col style="width:88px">
        </colgroup>
        <thead><tr>
          <th style="text-align:center">STT</th>
          <th>Số PO</th><th>Số LSX</th><th>Ngày PO</th>
          <th>Quy cách/Kết cấu</th><th>Tên hàng</th><th>ĐVT</th>
          <th style="text-align:right">Số lượng</th>
          <th style="text-align:right">Đơn giá</th>
          <th style="text-align:right">Thành tiền</th>
        </tr></thead>
        <tbody>${ro.items.map((it,i) => {
          return `<tr>
            <td style="text-align:center">${i+1}</td>
            <td>${it.so_don_item||'—'}</td>
            <td><b>${it.so_lenh||'—'}</b></td>
            <td>${fmtDateStr(it.ngay_po)}</td>
            <td>${it.quy_cach||it.ket_cau||'—'}</td>
            <td>${it.ten_hang}</td>
            <td>${it.dvt}</td>
            <td style="text-align:right"><b>${vi.format(it.so_luong)}</b></td>
            <td style="text-align:right">${it.don_gia ? vi.format(it.don_gia) : '—'}</td>
            <td style="text-align:right">${it.thanh_tien ? vi.format(it.thanh_tien) : '—'}</td>
          </tr>`
        }).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#E8F5E9;">
          <td colspan="7" style="text-align:right">Tổng cộng:</td>
          <td style="text-align:right">${vi.format(totSL)}</td>
          <td></td>
          <td style="text-align:right">${vi.format(totTien)}đ</td>
        </tr></tfoot>
      </table>`
    }

    const summaryHtml = `<div class="summary-box">
      <div class="s-item"><span class="s-label">Tổng số lượng:</span> <b>${vi.format(totSL)}</b></div>
      ${totM2 ? `<div class="s-item"><span class="s-label">Tổng diện tích:</span> <b>${viDec.format(totM2)} m²</b></div>` : ''}
      ${totM3 ? `<div class="s-item"><span class="s-label">Tổng thể tích:</span> <b>${viDec.format(totM3)} m³</b></div>` : ''}
      ${totKg ? `<div class="s-item"><span class="s-label">Tổng trọng lượng:</span> <b>${viDec.format(totKg)} kg</b></div>` : ''}
      ${!isPhoi && totTien ? `<div class="s-item"><span class="s-label">Tổng tiền hàng:</span> <b>${vi.format(totTien)} đ</b></div>` : ''}
    </div>`

    // Tìm đúng mẫu in theo pháp nhân của phiếu; thiếu thì báo lỗi và dừng.
    const doTemplates = templates.filter(t => ['DELIVERY_ORDER', 'DELIVERY_NOTE', 'PHIẾU GIAO HÀNG'].includes(t.ma_mau?.toUpperCase()))
    const tpl = doTemplates.find(t => t.phap_nhan_id === ro.phap_nhan_id)
    if (!tpl?.html_content) {
      antdMessage.error('Không tìm thấy mẫu in phiếu giao hàng đúng pháp nhân')
      return
    }
                
    try {
      if (tpl?.html_content) {
        const ngayDate = ro.ngay_xuat ? new Date(ro.ngay_xuat) : null

        // Tạo rows khớp với cột template đã thiết kế
        const templateCols = tpl ? ((tpl?.variables_meta as any)?.columns || []) : undefined
        const metaAny = (tpl.variables_meta as any)
        let tplCols = metaAny?.columns as Array<{key:string}> | undefined
        // Fallback: template cũ lưu selectedColumns trong easy_config
        if (!tplCols?.length && metaAny?.easy_config) {
          try { const cfg = JSON.parse(metaAny.easy_config); if (cfg?.selectedColumns?.length) tplCols = cfg.selectedColumns } catch { /* ignore */ }
        }
        const bodyRows = tplCols?.length
          ? ro.items.map((it, i) => {
              const m2 = it.dien_tich && it.dien_tich > 0 ? it.dien_tich
                : (it.kho_tt && it.dai_tt ? it.kho_tt * it.dai_tt * it.so_luong / 1_000_000 : 0)
              const cells = tplCols.map(col => {
                let val = ''
                switch (col.key) {
                  case 'stt':           val = String(i + 1); break
                  case 'ten_hang':      val = it.ten_hang ?? (it.quy_cach || it.ket_cau || '—'); break
                  case 'ma_amis': case 'ma_hang': case 'ma_sp':
                    val = (it as any).ma_amis ?? ''; break
                  case 'quy_cach': case 'ket_cau': case 'kich_thuoc':
                    val = it.quy_cach || it.ket_cau || '—'; break
                  case 'so_po': case 'so_don_item': val = it.so_don_item || '—'; break
                  case 'so_lsx': case 'so_lenh':   val = it.so_lenh || '—'; break
                  case 'ngay_po':       val = fmtDateStr(it.ngay_po); break
                  case 'kho_cat':
                    val = it.kho_tt && it.dai_tt ? `${fmtD(it.kho_tt)}×${fmtD(it.dai_tt)}` : '—'; break
                  case 'so_luong': case 'so_luong_thuc':
                    val = vi.format(it.so_luong); break
                  case 'dvt':           val = it.dvt; break
                  case 'total_m2':      val = m2 > 0 ? viDec.format(m2) : '—'; break
                  case 'trong_luong': case 'kg':
                    val = it.trong_luong ? viDec.format(it.trong_luong) : '—'; break
                  case 'the_tich': case 'm3':
                    val = it.the_tich ? viDec.format(it.the_tich) : '—'; break
                  case 'don_gia': case 'gia_ban':
                    val = it.don_gia ? vi.format(it.don_gia) : '—'; break
                  case 'thanh_tien':    val = it.thanh_tien ? vi.format(it.thanh_tien) : '—'; break
                  case 'so_lop':        val = (it as any).so_lop ?? ''; break
                  case 'to_hop_song':   val = (it as any).to_hop_song ?? ''; break
                  case 'ghi_chu':       val = it.ghi_chu || ''; break
                }
                const isNum = ['so_luong','so_luong_thuc','total_m2','trong_luong','the_tich',
                  'don_gia','gia_ban','thanh_tien','kg','m3'].includes(col.key)
                return `<td${isNum ? ' style="text-align:right"' : ''}>${val}</td>`
              }).join('')
              return `<tr>${cells}</tr>`
            }).join('')
          : '' // không có meta → template giữ nguyên thead mẫu, không inject rows

        const vars: Record<string, string> = {
          // — tên biến khớp PrintTemplatePage —
          logo_img:         `<img src="${logoSrc}" style="height:60px;max-width:100%;object-fit:contain;" />`,
          company_name:     co?.ten ?? '',
          company_details:  [
            co?.dia_chi             ? `Địa chỉ: ${co.dia_chi}` : '',
            (pn as any)?.ma_so_thue ? `MST: ${(pn as any).ma_so_thue}` : '',
            co?.so_dien_thoai       ? `SĐT: ${co.so_dien_thoai}` : '',
          ].filter(Boolean).join(' - '),
          subtitle:         isPhoi ? 'Phiếu xuất kho phôi' : 'Phiếu giao hàng',
          document_number:  ro.so_phieu,
          document_date:    fmtDateStr(ro.ngay_xuat),
          document_day:     ngayDate ? String(ngayDate.getDate()).padStart(2,'0') : '',
          document_month:   ngayDate ? String(ngayDate.getMonth()+1).padStart(2,'0') : '',
          document_year:    ngayDate ? String(ngayDate.getFullYear()) : '',
          status:           ro.trang_thai ?? '',
          customer_name:    ro.ten_khach ?? '',
          delivery_address: ro.dia_chi_giao ?? '',
          warehouse_name:   ro.ten_kho ?? '',
          driver_name:      ro.ten_tai_xe ?? '',
          assistant_1:      ro.ten_lo_xe ?? '',
          assistant_2:      ro.ten_lo_xe_2 ?? '',
          total_m2:         totM2 ? viDec.format(totM2) : '',
          total_so_luong:   vi.format(totSL),
          body_html:        bodyRows,
          footer_html:      '',
          // — alias cho template viết tay —
          logo_url:     logoSrc,
          so_phieu:     ro.so_phieu,
          ngay_giao:    fmtDateStr(ro.ngay_xuat),
          khach_hang:   ro.ten_khach ?? '',
          nguoi_nhan:   ro.nguoi_nhan ?? '',
          dia_chi_kh:   ro.dia_chi_giao ?? '',
          tai_xe:       ro.ten_tai_xe ?? '',
          bien_so:      ro.bien_so ?? ro.xe_van_chuyen ?? '',
          phu_xe_1:     ro.ten_lo_xe ?? '',
          phu_xe_2:     ro.ten_lo_xe_2 ?? '',
          so_seal:      ro.so_seal ?? '',
          ghi_chu:      ro.ghi_chu ?? '',
          tong_sl:      vi.format(totSL),
          tong_m2:      totM2 ? viDec.format(totM2) : '',
          tong_m3:      totM3 ? viDec.format(totM3) : '',
          tong_kg:      totKg ? viDec.format(totKg) : '',
          tong_tien:    totTien ? vi.format(totTien) : '',
          items_html:   tableHtml,
          summary_html: summaryHtml,
        }
        const filled = Object.entries(vars).reduce(
          (html, [k, v]) => html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
          tpl.html_content
        )
        printHtml(filled)
        return
      }
    } catch {
      message.error('Chưa cấu hình biểu mẫu in. Vào Danh mục → Cấu hình biểu mẫu in để thiết lập.')
    }
  }

  const handleSaveModal = async () => {
    const vals = await doForm.validateFields()
    if (isRequest) {
      createYCMutation.mutate({
        ngay_yeu_cau: vals.ngay_xuat.format('YYYY-MM-DD'),
        customer_id: vals.customer_id,
        dia_chi_giao: vals.dia_chi_giao,
        nguoi_nhan: vals.nguoi_nhan,
        ghi_chu: vals.ghi_chu,
        items: doItems.map(it => ({
          production_order_id: it.production_order_id,
          warehouse_id: vals.warehouse_id,
          so_luong: it.so_luong,
          dvt: it.dvt,
          dien_tich: it.dien_tich,
          trong_luong: it.trong_luong,
          ghi_chu: it.ghi_chu,
        })),
      })
    } else {
      createDOMutation.mutate({
        ...vals,
        ngay_xuat: vals.ngay_xuat.format('YYYY-MM-DD'),
        yeu_cau_id: selectedYC?.id,
        tien_van_chuyen: estimatedTripMoney || undefined,
        items: doItems.map(it => ({
          ...it,
          production_order_id: it.production_order_id || undefined,
          product_id: it.product_id || undefined,
          paper_material_id: it.paper_material_id || undefined,
          don_gia: it.don_gia || undefined,
        })),
      })
    }
  }

  // ── Export Excel Tab 4 ────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const config = [
      { key: 'so_phieu', label: 'Số phiếu', width: 18 },
      { key: 'ngay_xuat', label: 'Ngày xuất', width: 12 },
      { key: 'ten_khach', label: 'Khách hàng', width: 28 },
      { key: 'ten_tai_xe', label: 'Tài xế', width: 18 },
      { key: 'ten_lo_xe', label: 'Lơ xe', width: 18 },
      { key: 'ten_lo_xe_2', label: 'Lơ xe 2', width: 18 },
      { key: 'tong_thanh_toan', label: 'Tổng thanh toán', width: 16 },
      { key: 'trang_thai_cong_no_label', label: 'Công nợ', width: 14 },
      { key: 'trang_thai_label', label: 'Trạng thái', width: 12 },
      { key: 'created_by_name', label: 'Người lập', width: 18 },
    ]
    const rows = filteredDeliveryList.map(d => ({
      ...d,
      ngay_xuat: d.ngay_xuat ? dayjs(d.ngay_xuat).format('DD/MM/YYYY') : '',
      trang_thai_label: DO_TRANG_THAI_LABELS[d.trang_thai] || d.trang_thai,
      trang_thai_cong_no_label: CONG_NO_LABELS[d.trang_thai_cong_no] || d.trang_thai_cong_no,
    }))
    exportExcelWithTemplate(`phieu_ban_hang_${dayjs().format('YYYYMMDD')}`, 'Phiếu BH', rows, config)
  }

  // ── Columns ───────────────────────────────────────────────────────────────
  const tpCols: ColumnsType<TonKhoTPRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 118, fixed: 'left' as const,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Tên hàng', dataIndex: 'ten_hang', width: 140, ellipsis: true,
      render: (v: string | null) => <Tooltip title={v}><span style={{ fontSize: 12 }}>{v || '—'}</span></Tooltip> },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan_sx', width: 88,
      render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Nơi SX', dataIndex: 'order_ten_phan_xuong', width: 100, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Kho hiện tại', dataIndex: 'ten_kho_hien_tai', width: 110, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 120, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Loại', dataIndex: 'so_lop', width: 60, align: 'center' as const,
      render: (v: number | null, r: TonKhoTPRow) => {
        const label = v ? `${v}L` : (r.loai_thung || null)
        const color = v === 3 ? 'blue' : v === 5 ? 'purple' : v === 7 ? 'volcano' : 'default'
        return label
          ? <Tooltip title={r.loai_thung}><Tag color={color} style={{ fontSize: 10, padding: '0 4px' }}>{label}</Tag></Tooltip>
          : <Text type="secondary">—</Text>
      } },
    { title: 'Khổ', dataIndex: 'kho_tt', width: 60, align: 'right' as const,
      render: (v: number | null) => <span style={{ fontSize: 12 }}>{v != null ? v : '—'}</span> },
    { title: 'Cắt', dataIndex: 'dai_tt', width: 60, align: 'right' as const,
      render: (v: number | null) => <span style={{ fontSize: 12 }}>{v != null ? v : '—'}</span> },
    { title: 'Nhập (thùng)', dataIndex: 'tong_nhap', width: 95, align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 12 }}>{fmtN(v)}</span> },
    { title: 'Xuất (thùng)', dataIndex: 'tong_xuat', width: 95, align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 12 }}>{fmtN(v)}</span> },
    { title: 'Tồn (thùng)', dataIndex: 'ton_kho', width: 95, align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ fontSize: 12, color: v > 0 ? '#389e0d' : '#cf1322' }}>{fmtN(v)}</Text>
      ) },
  ]

  const phoiCols: ColumnsType<TonKhoPhoiLsxRow> = [
    { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 118, fixed: 'left' as const,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Tên hàng', dataIndex: 'ten_hang', width: 140, ellipsis: true,
      render: (v: string) => <Tooltip title={v}><span style={{ fontSize: 12 }}>{v || '—'}</span></Tooltip> },
    { title: 'Pháp nhân', dataIndex: 'ten_phap_nhan_sx', width: 88,
      render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Nơi SX', dataIndex: 'order_ten_phan_xuong', width: 100, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Kho hiện tại', dataIndex: 'ten_kho', width: 120, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 120, ellipsis: true,
      render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || '—'}</span> },
    { title: 'Khổ', dataIndex: 'chieu_kho', width: 60, align: 'right' as const,
      render: (v: number | null) => <span style={{ fontSize: 12 }}>{v != null ? v : '—'}</span> },
    { title: 'Cắt', dataIndex: 'chieu_cat', width: 60, align: 'right' as const,
      render: (v: number | null) => <span style={{ fontSize: 12 }}>{v != null ? v : '—'}</span> },
    { title: 'Nhập (tấm)', dataIndex: 'tong_nhap', width: 88, align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 12 }}>{fmtN(v)}</span> },
    { title: 'Xuất (tấm)', dataIndex: 'tong_xuat', width: 88, align: 'right' as const,
      render: (v: number) => <span style={{ fontSize: 12 }}>{fmtN(v)}</span> },
    { title: 'Tồn (tấm)', dataIndex: 'ton_kho', width: 88, align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ fontSize: 12, color: v > 0 ? '#fa8c16' : '#cf1322' }}>{fmtN(v)}</Text>
      ) },
  ]

  const ycCols: ColumnsType<YeuCauGiaoHang> = [
    { title: 'Số YC', dataIndex: 'so_yeu_cau', width: 160 },
    { title: 'Ngày YC', dataIndex: 'ngay_yeu_cau', width: 100, render: fmtDate },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'Tổng m²', dataIndex: 'tong_dien_tich', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? v.toFixed(2) : '—' },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 130,
      render: (v: string) => <Tag color={YEU_CAU_TRANG_THAI_COLORS[v]}>{YEU_CAU_TRANG_THAI_LABELS[v] || v}</Tag> },
    { title: '', width: 150,
      render: (_: unknown, r: YeuCauGiaoHang) => (
        <Space size={4}>
          <Button size="small" type="primary" onClick={() => openDOModalFromYC(r)}>Lập phiếu</Button>
          {r.trang_thai === 'moi' && (
            <Button
              size="small" danger icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: 'Xoá yêu cầu giao hàng?',
                  content: `Xoá YC ${r.so_yeu_cau}? Thao tác này không thể hoàn tác.`,
                  okText: 'Xoá', okType: 'danger', cancelText: 'Hủy',
                  onOk: () => deleteYCMutation.mutate(r.id),
                })
              }}
            />
          )}
        </Space>
      ) },
  ]

  const DO_NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
    nhap:    [{ value: 'da_xuat', label: 'Đánh dấu Đã xuất' }, { value: 'huy', label: 'Huỷ phiếu' }],
    da_xuat: [{ value: 'da_giao', label: 'Đánh dấu Đã giao' }, { value: 'huy', label: 'Huỷ phiếu' }],
    da_giao: [{ value: 'huy', label: 'Huỷ phiếu' }],
    huy:     [],
  }

  const doCols: ColumnsType<DeliveryOrder> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150, render: v => <Text code>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay_xuat', width: 95,
      render: (v: string, row: DeliveryOrder) => {
        const daysOld = v ? dayjs().diff(dayjs(v), 'day') : 0
        const isLate = row.trang_thai === 'nhap' && daysOld > 3
        const color = isLate ? (daysOld > 7 ? '#cf1322' : '#fa8c16') : undefined
        return <span style={{ color }}>{isLate && <WarningOutlined style={{ marginRight: 4 }} />}{fmtDate(v)}</span>
      } },
    { title: 'Khách hàng', dataIndex: 'ten_khach', ellipsis: true },
    { title: 'Tài xế', dataIndex: 'ten_tai_xe', width: 110 },
    { title: 'Lơ xe', dataIndex: 'ten_lo_xe', width: 110 },
    { title: 'Lơ xe 2', dataIndex: 'ten_lo_xe_2', width: 110,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Tổng TT', dataIndex: 'tong_thanh_toan', width: 120, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtMoney(v)}đ</Text> },
    { title: 'Công nợ', dataIndex: 'trang_thai_cong_no', width: 120,
      render: (v: string) => <Tag color={CONG_NO_COLORS[v]}>{CONG_NO_LABELS[v] || v}</Tag> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: (v: string) => <Tag color={DO_TRANG_THAI_COLORS[v]}>{DO_TRANG_THAI_LABELS[v] || v}</Tag> },
    { title: 'Người lập', dataIndex: 'created_by_name', width: 110, ellipsis: true,
      render: (v: string | null) => v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—' },
    {
      title: 'Thao tác', width: 200, fixed: 'right' as const,
      render: (_: unknown, row: DeliveryOrder) => {
        const nextOpts = DO_NEXT_STATUS[row.trang_thai] ?? []
        return (
          <Space size={4}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(row)} />
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(row)} />
            {nextOpts.length > 0 && (
              <Tooltip title={row.invoice_id ? "Đã có hóa đơn, không thể đổi trạng thái" : ""}>
                <Select
                  size="small"
                  placeholder="Đổi TT"
                  style={{ width: 120 }}
                  options={nextOpts}
                  loading={updateStatusMutation.isPending || xacNhanMutation.isPending}
                  onChange={(v: string) => handleStatusChange(row.id, v)}
                  value={null}
                  disabled={!!row.invoice_id}
                />
              </Tooltip>
            )}
            {['da_xuat', 'da_giao'].includes(row.trang_thai) && !row.da_dieu_chinh && (
              <Tooltip title={row.invoice_id ? "Đã có hóa đơn, không thể điều chỉnh" : "Điều chỉnh số lượng"}>
                <Button 
                  size="small" 
                  icon={<EditOutlined />} 
                  onClick={() => openAdjust(row)} 
                  disabled={!!row.invoice_id}
                />
              </Tooltip>
            )}
            {row.da_dieu_chinh && <Tag color="orange" style={{ margin: 0 }}>Đã ĐC</Tag>}
            {['da_xuat', 'da_giao'].includes(row.trang_thai) && !row.invoice_id && (
              <Button
                size="small"
                type="primary"
                ghost
                onClick={() => openInvoiceModal(row.id)}
              >
                HĐ
              </Button>
            )}
            {row.invoice_id && (
              <Tooltip title={`Hóa đơn: ${row.invoice_status === 'nhap' ? 'Nháp' : 'Đã phát hành'}`}>
                <Button
                  size="small"
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate(`/billing/invoices/${row.invoice_id}`)}
                >
                  Xem HĐ
                </Button>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'ton-kho-tp',
            label: <span>📦 1. Tồn kho Thành phẩm (Thùng)</span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={5}><Input placeholder="Tìm số lệnh..." allowClear value={tpInputText.so_lenh} onChange={e => {
                    const v = e.target.value; setTPInputText(f => ({ ...f, so_lenh: v }))
                    if (tpDebounceRef.current) clearTimeout(tpDebounceRef.current)
                    tpDebounceRef.current = setTimeout(() => setTPFilter(f => ({ ...f, so_lenh: v })), 400)
                  }} /></Col>
                  <Col span={5}><Input placeholder="Tên khách hàng..." allowClear value={tpInputText.ten_khach} onChange={e => {
                    const v = e.target.value; setTPInputText(f => ({ ...f, ten_khach: v }))
                    if (tpDebounceRef.current) clearTimeout(tpDebounceRef.current)
                    tpDebounceRef.current = setTimeout(() => setTPFilter(f => ({ ...f, ten_khach: v })), 400)
                  }} /></Col>
                  <Col span={6}>
                    <Select
                      placeholder="Lọc theo kho hiện tại"
                      style={{ width: '100%' }}
                      allowClear
                      onChange={(v: number | null) => setTpKhoFilter(v ?? null)}
                      options={pickableWarehouses.filter(w => w.loai_kho === 'THANH_PHAM').map(w => ({ value: w.id, label: w.ten_kho }))}
                    />
                  </Col>
                  <Col flex="auto" />
                  <Col>
                    <Space>
                      <Button icon={<FileTextOutlined />} disabled={!selectedTPKeys.length} onClick={openYCModalFromTP}>Tạo YC giao hàng ({selectedTPKeys.length})</Button>
                      <Button type="primary" icon={<FileTextOutlined />} disabled={!selectedTPKeys.length} onClick={openDOModalFromTP}>Lập phiếu BH trực tiếp ({selectedTPKeys.length})</Button>
                    </Space>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey="production_order_id"
                  loading={loadingTP}
                  dataSource={filteredTonKhoTP}
                  columns={tpCols}
                  rowSelection={{ selectedRowKeys: selectedTPKeys, onChange: setSelectedTPKeys }}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1050 }}
                />
                {selectedTPKeys.length > 0 && (() => {
                  const rows = tonKhoTP.filter(r => selectedTPKeys.includes(r.production_order_id))
                  const totSL = rows.reduce((s, r) => s + r.ton_kho, 0)
                  const totM2 = rows.reduce((s, r) => s + r.dien_tich, 0)
                  const totM3 = rows.reduce((s, r) => s + r.the_tich, 0)
                  const totKg = rows.reduce((s, r) => s + r.trong_luong, 0)
                  return (
                    <div style={{ marginTop: 8, padding: '10px 20px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 32 }}>
                      <Text strong style={{ color: '#389e0d' }}>Đã chọn {selectedTPKeys.length} lệnh:</Text>
                      <Statistic title="Số lượng (tấm)" value={totSL} precision={0} valueStyle={{ fontSize: 18, color: '#1677ff', fontWeight: 600 }} />
                      <Statistic title="Tổng m²" value={totM2} precision={2} valueStyle={{ fontSize: 18, fontWeight: 600 }} />
                      <Statistic title="Tổng m³" value={totM3} precision={3} valueStyle={{ fontSize: 18, fontWeight: 600 }} />
                      <Statistic title="Tổng Kg" value={totKg} precision={1} valueStyle={{ fontSize: 18, fontWeight: 600 }} suffix="kg" />
                    </div>
                  )
                })()}
              </Card>
            )
          },
          {
            key: 'ton-kho-phoi',
            label: <span>📑 2. Tồn kho Phôi (Giấy tấm)</span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={5}><Input placeholder="Tên khách hàng..." allowClear value={phoiInputKhach} onChange={e => {
                    const v = e.target.value; setPhoiInputKhach(v)
                    if (phoiDebounceRef.current) clearTimeout(phoiDebounceRef.current)
                    phoiDebounceRef.current = setTimeout(() => setPhoiKhachFilter(v), 400)
                  }} /></Col>
                  <Col span={5}>
                    <Select
                      placeholder="Lọc theo kho"
                      style={{ width: '100%' }}
                      allowClear
                      onChange={v => setPhoiFilter(f => ({ ...f, warehouse_id: v }))}
                      options={pickableWarehouses.filter(w => w.loai_kho === 'PHOI').map(w => ({ value: w.id, label: w.ten_kho }))}
                    />
                  </Col>
                  <Col span={5}><Input.Search placeholder="Tìm tên hàng..." onSearch={v => setPhoiFilter(f => ({ ...f, search: v }))} allowClear /></Col>
                  <Col flex="auto" />
                  <Col>
                    <Space>
                      <Button icon={<FileTextOutlined />} disabled={!selectedPhoiKeys.length} onClick={openYCModalFromPhoi}>Tạo YC giao hàng ({selectedPhoiKeys.length})</Button>
                      <Button type="primary" icon={<FileTextOutlined />} disabled={!selectedPhoiKeys.length} onClick={openDOModalFromPhoi}>Lập phiếu BH trực tiếp ({selectedPhoiKeys.length})</Button>
                    </Space>
                  </Col>
                </Row>
                <Table
                  size="small"
                  rowKey={r => `${r.production_order_id}-${r.warehouse_id}`}
                  loading={loadingPhoi}
                  dataSource={filteredTonKhoPhoi}
                  columns={phoiCols}
                  rowSelection={{ selectedRowKeys: selectedPhoiKeys, onChange: setSelectedPhoiKeys }}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 950 }}
                />
                {selectedPhoiKeys.length > 0 && (() => {
                  const rows = tonKhoPhoi.filter(r => selectedPhoiKeys.includes(`${r.production_order_id}-${r.warehouse_id}`))
                  const totSL = rows.reduce((s, r) => s + r.ton_kho, 0)
                  const totM2 = rows.reduce((s, r) => s + (r.dien_tich ?? (r.chieu_kho && r.chieu_cat ? r.chieu_kho * r.chieu_cat * r.ton_kho / 1_000_000 : 0)), 0)
                  const totM3 = rows.reduce((s, r) => s + (r.the_tich ?? 0), 0)
                  const totKg = rows.reduce((s, r) => s + (r.trong_luong ?? 0), 0)
                  return (
                    <div style={{ marginTop: 8, padding: '10px 20px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 32 }}>
                      <Text strong style={{ color: '#fa8c16' }}>Đã chọn {selectedPhoiKeys.length} lệnh:</Text>
                      <Statistic title="Số lượng (tấm)" value={totSL} precision={0} valueStyle={{ fontSize: 18, color: '#1677ff', fontWeight: 600 }} />
                      <Statistic title="Tổng m²" value={totM2} precision={2} valueStyle={{ fontSize: 18, fontWeight: 600 }} />
                      <Statistic title="Tổng m³" value={totM3} precision={3} valueStyle={{ fontSize: 18, fontWeight: 600 }} />
                      <Statistic title="Tổng Kg" value={totKg} precision={1} valueStyle={{ fontSize: 18, fontWeight: 600 }} suffix="kg" />
                    </div>
                  )
                })()}
              </Card>
            )
          },
          {
            key: 'yeu-cau',
            label: <span>🚚 3. Yêu cầu giao hàng <Badge count={yeuCauList.length} size="small" style={{ marginLeft: 4 }} /></span>,
            children: (
              <Card size="small">
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={6}>
                    <Input
                      placeholder="Tìm khách hàng..."
                      allowClear
                      value={ycTenKhachInput}
                      onChange={e => {
                        const v = e.target.value; setYcTenKhachInput(v)
                        if (ycDebounceRef.current) clearTimeout(ycDebounceRef.current)
                        ycDebounceRef.current = setTimeout(() => setYcTenKhach(v), 400)
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    <DatePicker.RangePicker
                      format="DD/MM/YYYY"
                      onChange={dates => setYcDateRange(dates ? [dates[0]!.format('YYYY-MM-DD'), dates[1]!.format('YYYY-MM-DD')] : null)}
                      placeholder={['Từ ngày', 'Đến ngày']}
                    />
                  </Col>
                </Row>
                <Table
                  size="small" rowKey="id" loading={loadingYC} dataSource={yeuCauList} columns={ycCols}
                  locale={{ emptyText: <Empty description="Không có yêu cầu giao hàng nào" /> }}
                  expandable={{
                    expandedRowRender: (row: YeuCauGiaoHang) => (
                      <Table size="small" rowKey="id" dataSource={row.items} pagination={false}
                        columns={[
                          { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130, render: (v: string | null) => v || 'Từ kho' },
                          { title: 'Tên hàng', dataIndex: 'ten_hang' },
                          { title: 'SL', dataIndex: 'so_luong', width: 80, align: 'right' as const, render: (v: number) => fmtN(v) },
                          { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                          { title: 'M²', dataIndex: 'dien_tich', width: 80, align: 'right' as const, render: (v: number) => v > 0 ? v.toFixed(2) : '—' },
                          { title: 'Kho', dataIndex: 'ten_kho', width: 130, render: (v: string | null) => v || '—' },
                        ]}
                      />
                    ),
                  }}
                />
              </Card>
            )
          },
          {
            key: 'phieu-ban-hang',
            label: <span>📜 4. Lịch sử Phiếu BH <Badge count={filteredDeliveryList.length} size="small" style={{ marginLeft: 4 }} /></span>,
            children: (
              <Card size="small">
                {/* Row 1: date + status + shortcuts */}
                <Row gutter={8} style={{ marginBottom: 8 }} align="middle">
                  <Col>
                    <DatePicker.RangePicker
                      format="DD/MM/YYYY"
                      value={[dayjs(doFilter.tu_ngay), dayjs(doFilter.den_ngay)]}
                      onChange={dates => setDOFilter({ ...doFilter, tu_ngay: dates?.[0]?.format('YYYY-MM-DD') || '', den_ngay: dates?.[1]?.format('YYYY-MM-DD') || '' })}
                    />
                  </Col>
                  <Col>
                    <Select
                      placeholder="Tất cả trạng thái"
                      allowClear
                      style={{ width: 160 }}
                      value={doStatusFilter}
                      onChange={(v: string | null) => { setDoStatusFilter(v ?? null); setDoShortcut(null) }}
                      options={Object.entries(DO_TRANG_THAI_LABELS).map(([k, label]) => ({ value: k, label }))}
                    />
                  </Col>
                  <Col>
                    <Space size={4}>
                      {(['da_xuat', 'da_giao'] as const).map(st => (
                        <Button
                          key={st}
                          size="small"
                          type={doStatusFilter === st ? 'primary' : 'default'}
                          onClick={() => { setDoStatusFilter(doStatusFilter === st ? null : st); setDoShortcut(null) }}
                        >
                          {DO_TRANG_THAI_LABELS[st]}
                        </Button>
                      ))}
                      <Button
                        size="small"
                        type={doShortcut === 'chua_thu' ? 'primary' : 'default'}
                        danger={doShortcut === 'chua_thu'}
                        onClick={() => { setDoShortcut(doShortcut === 'chua_thu' ? null : 'chua_thu'); setDoStatusFilter(null) }}
                      >
                        Chưa thu
                      </Button>
                    </Space>
                  </Col>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={() => refetchDO()} loading={loadingDO}>Tải lại</Button>
                  </Col>
                  <Col flex="auto" />
                  <Col>
                    <Button icon={<ExportOutlined />} onClick={handleExportExcel}>Xuất Excel</Button>
                  </Col>
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>{filteredDeliveryList.length} phiếu</Text>
                  </Col>
                </Row>
                {/* Row 2: text filters */}
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={6}>
                    <Input
                      placeholder="Tên khách hàng..."
                      allowClear
                      value={doTenKhachInput}
                      onChange={e => {
                        const v = e.target.value; setDoTenKhachInput(v)
                        if (doDebounceRef.current) clearTimeout(doDebounceRef.current)
                        doDebounceRef.current = setTimeout(() => setDOFilter({ ...doFilter, ten_khach: v || undefined }), 400)
                      }}
                    />
                  </Col>
                  <Col span={5}>
                    <Input
                      placeholder="Số phiếu..."
                      allowClear
                      value={doSoPhieuInput}
                      onChange={e => {
                        const v = e.target.value; setDoSoPhieuInput(v)
                        if (doDebounceRef.current) clearTimeout(doDebounceRef.current)
                        doDebounceRef.current = setTimeout(() => setDOFilter({ ...doFilter, so_phieu: v || undefined }), 400)
                      }}
                    />
                  </Col>
                  <Col span={5}>
                    <Select
                      placeholder="Pháp nhân"
                      allowClear
                      style={{ width: '100%' }}
                      onChange={(v: number | null) => setDOFilter({ ...doFilter, phap_nhan_id: v ?? undefined })}
                      options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
                    />
                  </Col>
                </Row>
                {isErrorDO && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 8 }}
                    message="Lỗi tải danh sách phiếu bán hàng"
                    description={(errorDO as any)?.response?.data?.detail || (errorDO as any)?.message || 'Không thể kết nối server'}
                  />
                )}
                <Table
                  size="small"
                  rowKey="id"
                  loading={loadingDO}
                  dataSource={filteredDeliveryList}
                  columns={doCols}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1300 }}
                  locale={{ emptyText: <Empty description="Không có phiếu bán hàng nào" /> }}
                  onRow={row => ({
                    onClick: e => { if ((e.target as HTMLElement).closest('button, .ant-select, .ant-btn')) return; openDetail(row) },
                    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') openDetail(row) },
                    tabIndex: 0,
                    style: { cursor: 'pointer' },
                  })}
                />
              </Card>
            )
          }
        ]}
      />

      {/* ── Detail Drawer ── */}
      <Drawer
        title={detailOrder ? `Chi tiết phiếu: ${detailOrder.so_phieu}` : 'Chi tiết phiếu bán hàng'}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        width={900}
        keyboard
        extra={
          detailOrder && (
            <Space>
              {['da_xuat', 'da_giao'].includes(detailOrder.trang_thai) && !detailOrder.da_dieu_chinh && (
                <Tooltip title={detailOrder.invoice_id ? "Đã có hóa đơn, không thể điều chỉnh số lượng" : ""}>
                  <Button 
                    icon={<EditOutlined />} 
                    onClick={() => openAdjust(detailOrder)}
                    disabled={!!detailOrder.invoice_id}
                  >
                    Điều chỉnh SL
                  </Button>
                </Tooltip>
              )}
              {detailOrder.da_dieu_chinh && (
                <Tag color="orange" style={{ margin: 0 }}>Đã điều chỉnh</Tag>
              )}
              <Button icon={<PrinterOutlined />} type="primary" onClick={() => handlePrint(detailOrder)}>In phiếu</Button>
            </Space>
          )
        }
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detailOrder ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Số phiếu"><Typography.Text code>{detailOrder.so_phieu}</Typography.Text></Descriptions.Item>
              <Descriptions.Item label="Ngày xuất">{fmtDate(detailOrder.ngay_xuat)}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng" span={2}>{detailOrder.ten_khach}</Descriptions.Item>
              <Descriptions.Item label="Kho xuất" span={2}>{detailOrder.ten_kho}</Descriptions.Item>
              <Descriptions.Item label="Người nhận">{detailOrder.nguoi_nhan || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao">{detailOrder.dia_chi_giao || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={DO_TRANG_THAI_COLORS[detailOrder.trang_thai]}>{DO_TRANG_THAI_LABELS[detailOrder.trang_thai] || detailOrder.trang_thai}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Công nợ">
                <Tag color={CONG_NO_COLORS[detailOrder.trang_thai_cong_no]}>{CONG_NO_LABELS[detailOrder.trang_thai_cong_no] || detailOrder.trang_thai_cong_no}</Tag>
              </Descriptions.Item>
              {(detailOrder as any).created_by_name && (
                <Descriptions.Item label="Người lập">{(detailOrder as any).created_by_name}</Descriptions.Item>
              )}
              {detailOrder.created_at && (
                <Descriptions.Item label="Ngày tạo">{fmtDate(detailOrder.created_at)}</Descriptions.Item>
              )}
            </Descriptions>

            {(detailOrder.ten_tai_xe || detailOrder.bien_so || detailOrder.xe_van_chuyen || detailOrder.ten_lo_xe || detailOrder.so_seal) && (
              <>
                <Divider style={{ margin: '4px 0' }}>Vận chuyển</Divider>
                <Descriptions bordered column={1} size="small">
                  {(detailOrder.bien_so || detailOrder.xe_van_chuyen) && (
                    <Descriptions.Item label="Số xe">{detailOrder.bien_so || detailOrder.xe_van_chuyen}</Descriptions.Item>
                  )}
                  {detailOrder.ten_tai_xe && <Descriptions.Item label="Tài xế">{detailOrder.ten_tai_xe}</Descriptions.Item>}
                  {detailOrder.ten_lo_xe && <Descriptions.Item label="Lơ xe">{detailOrder.ten_lo_xe}</Descriptions.Item>}
                  {detailOrder.ten_lo_xe_2 && <Descriptions.Item label="Lơ xe 2">{detailOrder.ten_lo_xe_2}</Descriptions.Item>}
                  {detailOrder.so_seal && <Descriptions.Item label="Số Seal">{detailOrder.so_seal}</Descriptions.Item>}
                  {detailOrder.ten_tuyen && <Descriptions.Item label="Tuyến VC">{detailOrder.ten_tuyen}</Descriptions.Item>}
                  {detailOrder.gui_kem_theo && <Descriptions.Item label="Gửi kèm theo">{detailOrder.gui_kem_theo}</Descriptions.Item>}
                </Descriptions>
              </>
            )}

            <Divider style={{ margin: '4px 0' }}>Hàng hóa</Divider>
            <Table
              size="small"
              rowKey="id"
              dataSource={detailOrder.items}
              pagination={false}
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 700, background: '#f6ffed' }}>
                  <Table.Summary.Cell index={0} colSpan={3}><Typography.Text strong>Tổng cộng</Typography.Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">{fmtN(detailOrder.items.reduce((s, it) => s + it.so_luong, 0))}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">{detailOrder.tong_dien_tich ? detailOrder.tong_dien_tich.toFixed(3) : '—'}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">{detailOrder.tong_trong_luong ? detailOrder.tong_trong_luong.toFixed(3) : '—'}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right"><Typography.Text type="danger" strong>{fmtMoney(detailOrder.tong_thanh_toan)}</Typography.Text></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
              columns={[
                { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130, render: v => v ? <Typography.Text code>{v}</Typography.Text> : '—' },
                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                { title: 'Số lượng', dataIndex: 'so_luong', width: 90, align: 'right' as const, render: (v: number) => <Typography.Text strong>{fmtN(v)}</Typography.Text> },
                { title: 'M²', dataIndex: 'dien_tich', width: 80, align: 'right' as const, render: (v: number) => v ? v.toFixed(2) : '—' },
                { title: 'Kg', dataIndex: 'trong_luong', width: 80, align: 'right' as const, render: (v: number) => v ? v.toFixed(2) : '—' },
                { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 110, align: 'right' as const, render: (v: number) => v ? <Typography.Text>{fmtMoney(v)}</Typography.Text> : '—' },
                { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
              ]}
            />

            {(detailOrder.tong_tien_hang > 0 || detailOrder.tien_van_chuyen > 0) && (
              <Descriptions bordered column={1} size="small">
                {detailOrder.tong_tien_hang > 0 && <Descriptions.Item label="Tổng tiền hàng"><Typography.Text>{fmtMoney(detailOrder.tong_tien_hang)} đ</Typography.Text></Descriptions.Item>}
                {detailOrder.tien_van_chuyen > 0 && <Descriptions.Item label="Tiền vận chuyển">{fmtMoney(detailOrder.tien_van_chuyen)} đ</Descriptions.Item>}
                {detailOrder.tong_thanh_toan > 0 && <Descriptions.Item label="Tổng thanh toán"><Typography.Text type="danger" strong style={{ fontSize: 14 }}>{fmtMoney(detailOrder.tong_thanh_toan)} đ</Typography.Text></Descriptions.Item>}
              </Descriptions>
            )}
            {detailOrder.ghi_chu && (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Ghi chú">{detailOrder.ghi_chu}</Descriptions.Item>
              </Descriptions>
            )}
          </Space>
        ) : null}
      </Drawer>

      {/* ── Modal DO/YC ── */}
      <Modal title={isRequest ? "Tạo yêu cầu giao hàng" : "Lập phiếu bán hàng"} open={showDOModal} onCancel={() => setShowDOModal(false)} onOk={handleSaveModal} width={1100}>
        <Form form={doForm} layout="vertical">
          <Row gutter={12}>
            <Col span={6}><Form.Item name="ngay_xuat" label={isRequest ? "Ngày yêu cầu" : "Ngày xuất"} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}>
              <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
                <Select placeholder="Chọn khách hàng" showSearch optionFilterProp="label" options={customers.map(c => ({ label: c.ten_viet_tat, value: c.id }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true }]}>
                <Select placeholder="Chọn kho" options={allWarehouses.map(w => ({ label: w.ten_kho, value: w.id }))} />
              </Form.Item>
            </Col>
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="phap_nhan_id" label="Pháp nhân bán hàng" rules={[{ required: true, message: 'Chọn pháp nhân' }]}>
                  <Select placeholder="Chọn pháp nhân" options={phapNhanList.map(p => ({ label: p.ten_phap_nhan, value: p.id }))} />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="xe_id" label="Xe">
                  <Select placeholder="Chọn xe" allowClear options={xeList.map(x => ({ label: x.bien_so, value: x.id }))} />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="tai_xe_id" label="Tài xế">
                  <Select placeholder="Chọn tài xế" allowClear showSearch optionFilterProp="label"
                    options={taiXeList.map(x => ({ label: x.ho_ten, value: x.id }))} />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="lo_xe_id" label="Lơ xe">
                  <Select placeholder="Chọn lơ xe" allowClear showSearch optionFilterProp="label"
                    options={loXeList.map(x => ({ label: x.ho_ten, value: x.id }))} />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="lo_xe_id_2" label="Lơ xe 2">
                  <Select placeholder="Chọn lơ xe 2" allowClear showSearch optionFilterProp="label"
                    options={loXeList.map(x => ({ label: x.ho_ten, value: x.id }))} />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={6}>
                <Form.Item name="so_seal" label="Số Seal">
                  <Input placeholder="Số seal..." />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={12}>
                <Form.Item name="gui_kem_theo" label="Gửi kèm theo">
                  <Input placeholder="Chứng từ gửi kèm..." />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={12}>
                <Form.Item name="dia_chi_giao" label="Địa chỉ giao">
                  <Input placeholder="Địa chỉ giao hàng..." />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={12}>
                <Form.Item name="nguoi_nhan" label="Người nhận">
                  <Input placeholder="Tên người nhận tại điểm giao..." />
                </Form.Item>
              </Col>
            )}
            {!isRequest && (
              <Col span={24}>
                <Form.Item name="ghi_chu" label="Ghi chú">
                  <Input.TextArea rows={2} placeholder="Ghi chú cho phiếu bán hàng..." />
                </Form.Item>
              </Col>
            )}
          </Row>
          {!isRequest && defaultTripRate > 0 && (
            <Card size="small" style={{ marginBottom: 12, background: '#f0f9ff', border: '1px solid #bae0ff' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <Text strong style={{ color: '#0958d9' }}>
                  Lương chuyến: {fmtN(doTotalM2)} m² × {fmtMoney(defaultTripRate)} = {fmtMoney(estimatedTripMoney)} đ
                </Text>
                {tripBreakdown.length > 0 && tripBreakdown[0].name !== '—' && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {tripBreakdown.map((p, i) => (
                      <Tag key={i} color="blue">{p.role} {p.name}: {fmtMoney(p.luong)} đ</Tag>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
          {!isRequest && !defaultTripRate && (
            <Alert style={{ marginBottom: 12 }} type="warning" showIcon message="Chưa có đơn giá m² mặc định cho tiền chuyến" />
          )}
        </Form>
        <Table
          size="small"
          rowKey={(_, idx) => idx ?? 0}
          dataSource={doItems}
          pagination={false}
          columns={[
            { title: 'Nguồn', dataIndex: 'so_lenh', width: 120, render: (v: any) => v || 'Từ kho' },
            { title: 'Tên hàng', dataIndex: 'ten_hang' },
            {
              title: 'Số lượng', width: 120,
              render: (_: any, row: any, idx: number) => (
                <InputNumber
                  size="small" style={{ width: '100%' }} value={row.so_luong}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, so_luong: v || 0, thanh_tien: (v || 0) * (it.don_gia || 0) } : it))}
                />
              )
            },
            !isRequest && {
              title: 'Đơn giá', width: 140,
              render: (_: any, row: any, idx: number) => (
                <InputNumber
                  size="small" style={{ width: '100%' }} value={row.don_gia}
                  onChange={v => setDOItems(prev => prev.map((it, i) => i === idx ? { ...it, don_gia: v || 0, thanh_tien: (v || 0) * (it.so_luong || 0) } : it))}
                />
              )
            },
            !isRequest && { title: 'Thành tiền', width: 140, render: (_: any, row: any) => fmtMoney(row.thanh_tien), align: 'right' },
          ].filter(Boolean) as any}
          summary={() => !isRequest ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Text strong type="danger">{fmtMoney(doItems.reduce((s, it) => s + (it.thanh_tien || 0), 0))}</Text></Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null}
        />
        {/* Running totals M²/Kg/M³ */}
        {(() => {
          const totSL  = doItems.reduce((s, it) => s + (it.so_luong || 0), 0)
          const totM2  = doItems.reduce((s, it) => s + (it.dien_tich || 0), 0)
          const totKg  = doItems.reduce((s, it) => s + (it.trong_luong || 0), 0)
          const totM3  = doItems.reduce((s, it) => s + (it.the_tich || 0), 0)
          return (
            <div style={{ marginTop: 8, padding: '6px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <span><Text type="secondary">Tổng SL:</Text> <Text strong>{fmtN(totSL)}</Text></span>
              {totM2 > 0 && <span><Text type="secondary">Tổng M²:</Text> <Text strong style={{ color: '#1677ff' }}>{totM2.toFixed(2)}</Text></span>}
              {totKg > 0 && <span><Text type="secondary">Tổng Kg:</Text> <Text strong style={{ color: '#fa8c16' }}>{totKg.toFixed(1)}</Text></span>}
              {totM3 > 0 && <span><Text type="secondary">Tổng M³:</Text> <Text strong>{totM3.toFixed(3)}</Text></span>}
            </div>
          )
        })()}
      </Modal>

      {/* Modal ghi nhận công nợ — chọn VAT + upload ảnh phiếu giao */}
      <Modal
        title="Ghi nhận công nợ"
        open={invoiceModalOpen}
        onCancel={() => setInvoiceModalOpen(false)}
        confirmLoading={createInvoiceMutation.isPending}
        onOk={() => {
          if (!invoiceDeliveryId) return
          createInvoiceMutation.mutate({
            deliveryId: invoiceDeliveryId,
            vatPct: invoiceVat,
            photoFile: invoicePhotoFile,
          })
        }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Thuế VAT:</div>
            <Select
              value={invoiceVat}
              onChange={setInvoiceVat}
              style={{ width: '100%' }}
              options={[
                { label: '0%', value: 0 },
                { label: '5%', value: 5 },
                { label: '8%', value: 8 },
                { label: '10%', value: 10 },
              ]}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>
              Ảnh phiếu giao có chữ ký KH <Text type="secondary">(tùy chọn)</Text>:
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ width: '100%' }}
              onChange={e => setInvoicePhotoFile(e.target.files?.[0] ?? null)}
            />
            {invoicePhotoFile && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đã chọn: {invoicePhotoFile.name}
              </Text>
            )}
          </div>
        </Space>
      </Modal>

      {/* ── Modal điều chỉnh số lượng PBH ── */}
      <Modal
        title="Điều chỉnh số lượng phiếu bán hàng"
        open={showAdjust}
        onCancel={() => setShowAdjust(false)}
        onOk={() => detailId && adjustMut.mutate({ id: detailId, items: adjItems, ghi_chu: adjGhiChu })}
        okText="Gửi điều chỉnh"
        confirmLoading={adjustMut.isPending}
        width={780}
        destroyOnHidden
      >
        <Table
          size="small"
          dataSource={adjItems}
          rowKey="item_id"
          pagination={false}
          style={{ marginBottom: 12 }}
          summary={() => (
            <Table.Summary.Row style={{ background: '#fffbe6', fontWeight: 700 }}>
              <Table.Summary.Cell index={0} colSpan={3}>Tổng tiền hàng mới</Table.Summary.Cell>
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} align="right">
                <Typography.Text strong style={{ color: '#fa8c16' }}>
                  {adjTotal.toLocaleString('vi-VN')} đ
                </Typography.Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
          columns={[
            {
              title: 'LSX', dataIndex: 'so_lenh', width: 120,
              render: (v: string | null) => v ? <Typography.Text code style={{ fontSize: 11 }}>{v}</Typography.Text> : '—',
            },
            { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
            { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
            {
              title: 'Số lượng', width: 120, align: 'right' as const,
              render: (_: any, _row: AdjItem, idx: number) => (
                <InputNumber
                  size="small" style={{ width: '100%' }} min={0}
                  value={adjItems[idx].so_luong}
                  onChange={v => setAdjItems(prev => prev.map((it, i) => i === idx
                    ? { ...it, so_luong: v ?? 0, thanh_tien: (v ?? 0) * it.don_gia }
                    : it))}
                />
              ),
            },
            {
              title: 'Đơn giá', dataIndex: 'don_gia', width: 130, align: 'right' as const,
              render: (v: number) => <Typography.Text type="secondary">{v.toLocaleString('vi-VN')}</Typography.Text>,
            },
            {
              title: 'Thành tiền', width: 130, align: 'right' as const,
              render: (_: any, _row: AdjItem, idx: number) => (
                <Typography.Text strong style={{ color: '#52c41a' }}>
                  {adjItems[idx].thanh_tien.toLocaleString('vi-VN')}
                </Typography.Text>
              ),
            },
          ]}
        />
        <Input.TextArea
          rows={2}
          placeholder="Lý do điều chỉnh (bắt buộc nếu có hóa đơn đã phát hành)..."
          value={adjGhiChu}
          onChange={e => setAdjGhiChu(e.target.value)}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
          Nếu hóa đơn đã phát hành, yêu cầu điều chỉnh sẽ được gửi chờ KT Trưởng duyệt.
        </Typography.Text>
      </Modal>

      {/* Modal xác nhận giao hàng */}
      <Modal
        title="Xác nhận giao hàng thực tế"
        open={xacNhanModalOpen}
        onCancel={() => { setXacNhanModalOpen(false); xacNhanForm.resetFields() }}
        onOk={() => {
          xacNhanForm.validateFields().then(vals => {
            if (!xacNhanOrderId) return
            xacNhanMutation.mutate({
              id: xacNhanOrderId,
              ngay_giao: vals.ngay_giao.format('YYYY-MM-DD'),
              ten_nguoi_nhan: vals.ten_nguoi_nhan,
              ghi_chu: vals.ghi_chu || undefined,
            })
          })
        }}
        confirmLoading={xacNhanMutation.isPending}
        okText="Xác nhận đã giao"
        cancelText="Huỷ"
      >
        <Form form={xacNhanForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="ngay_giao" label="Ngày giao thực tế" rules={[{ required: true, message: 'Chọn ngày giao' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ten_nguoi_nhan" label="Tên người nhận (tại khách hàng)" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ảnh biên nhận: tải lên sau qua nút <b>Media</b> trên phiếu bán hàng.
          </Typography.Text>
        </Form>
      </Modal>
    </Space>
  )
}
