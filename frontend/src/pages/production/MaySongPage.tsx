import { useState, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Row, Select, Space, Spin, Table, Tabs, Tag,
  TimePicker, Typography,
} from 'antd'
import { CaretRightOutlined, PauseOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type {
  ProductionOrder, ProductionOrderItem, ProductionOrderListItem,
  PhieuNhapPhoiSong, PhieuNhapPhoiSongListItem, PhieuNhapPhoiSongPayload,
  PauseOrderPayload, ResumeOrderPayload,
} from '../../api/productionOrders'
import { productionPlansApi } from '../../api/productionPlans'
import type { PlanLineResponse } from '../../api/productionPlans'
import { warehouseApi } from '../../api/warehouse'
import { calcBoxDimensions } from '../../api/quotes'
import { printProductionTagBatch } from '../../utils/exportUtils'

const { Text, Title } = Typography

// ─── Pallet constants ────────────────────────────────────────────────────────
const STACK_H_MM = 2000   // chiều cao xếp tối đa 1 cây (mm)
const MM_PER_SHEET: Record<number, number> = { 3: 6, 5: 9, 7: 15 }

/**
 * Số tấm/thùng trên 1 pallet:
 *   perCay = floor(2000 / dày_tấm)
 *   soCay  = dựa vào khổ (cm): ≥60→1 | <60→2 | <40→3 | <30→4 | <24→5
 */
function calcTamPerPallet(soLop: number, khoMm: number | null): number {
  const mmSheet = MM_PER_SHEET[soLop] ?? 7
  const perCay  = Math.floor(STACK_H_MM / mmSheet)
  const khoCm   = khoMm != null ? khoMm / 10 : 60
  const soCay   = khoCm < 24 ? 5
                : khoCm < 30 ? 4
                : khoCm < 40 ? 3
                : khoCm < 60 ? 2
                : 1
  return perCay * soCay
}

// kho_tt / dai_tt lưu đơn vị cm → *10 để ra mm dùng cho các tính toán
function getKhoMm(oi: ProductionOrderItem): number | null {
  if (oi.kho_tt != null) return Number(oi.kho_tt) * 10
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.kho_tt ? Math.ceil(dims.kho_tt / 5) * 5 * 10 : null
}

function getCatMm(oi: ProductionOrderItem): number | null {
  if (oi.dai_tt != null) return Number(oi.dai_tt) * 10
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.dai_tt ? Math.round(dims.dai_tt * 10) : null
}

// mm → chuỗi cm hiển thị
function mmToDisplayCm(mm: number | null | undefined): string {
  if (mm == null) return '?'
  return (mm / 10).toFixed(1).replace(/\.0$/, '')
}

function calcSoTam(oi: ProductionOrderItem, soThung: number): number | null {
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  if (!dims || dims.so_dao < 1) return null
  return Math.ceil(soThung / dims.so_dao)
}

// Tính số tấm từ list item — ưu tiên TT, fallback KH khi chưa nhập phiếu
function calcSoTamFromListItem(lsx: ProductionOrderListItem): number | null {
  const qty = Number(lsx.tong_sl_thuc_te) > 0
    ? Number(lsx.tong_sl_thuc_te)
    : Number(lsx.tong_sl_ke_hoach)
  if (qty === 0) return null
  if (!lsx.loai_thung || !lsx.dai || !lsx.rong || !lsx.cao) return qty
  const soLop = lsx.so_lop ?? 5
  const dims = calcBoxDimensions(lsx.loai_thung, Number(lsx.dai), Number(lsx.rong), Number(lsx.cao), soLop)
  if (!dims || dims.so_dao < 1) return qty
  return Math.ceil(qty / dims.so_dao)
}

function InfoRow({
  label, value, valueStyle,
}: { label: string; value: ReactNode; valueStyle?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
      <Text type="secondary" style={{ minWidth: 90, fontSize: 12, flexShrink: 0 }}>{label}</Text>
      <Text style={valueStyle}>{value ?? '—'}</Text>
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface InTemState {
  order: ProductionOrder
  phieu: PhieuNhapPhoiSong | null
  soTam: number
  soThung: number
  soPallet: number
  tamPerPallet: number
  khoMm: number | null
  catMm: number | null
  ke_hoach_qccl: string
  ke_hoach_ghi_chu: string
}

interface StatusTarget { id: number; so_lenh: string }

// ─── Component ───────────────────────────────────────────────────────────────
export default function MaySongPage() {
  const [activeTab, setActiveTab]       = useState('dang_sx')
  const [filterPxId, setFilterPxId]     = useState<number | undefined>()
  const [filterKhId, setFilterKhId]     = useState<number | undefined>()
  const [searchLenh, setSearchLenh]     = useState('')
  const [hoanthanhId, setHoanthanhId]   = useState<number | null>(null)
  const [pauseTarget, setPauseTarget]   = useState<StatusTarget | null>(null)
  const [inTemState, setInTemState]     = useState<InTemState | null>(null)
  const [inTemLoading, setInTemLoading] = useState(false)
  const [histTuNgay, setHistTuNgay]     = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'))
  const [histDenNgay, setHistDenNgay]   = useState(dayjs().format('YYYY-MM-DD'))
  const [pauseForm]       = Form.useForm()
  const [hoanthanhForm]   = Form.useForm()
  const qc = useQueryClient()

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: pxList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () =>
      warehouseApi.listPhanXuong().then(r =>
        r.data.filter(px => ['Hoàng Gia', 'Nam Thuận'].some(n => (px.ten_xuong ?? '').includes(n)))
      ),
    staleTime: 60_000,
  })

  const { data: khList = [] } = useQuery({
    queryKey: ['ke-hoach-list'],
    queryFn: () => productionPlansApi.list({ page_size: 100 }).then(r => r.data.items),
    staleTime: 60_000,
  })

  const { data: lsxRes, isLoading, refetch } = useQuery({
    queryKey: ['may-song-list', filterPxId],
    queryFn: () =>
      productionOrdersApi.list({ page_size: 200, phan_xuong_id: filterPxId }).then(r => r.data),
    refetchInterval: 60_000,
  })

  // Khi chọn KH: lấy set so_lenh trong KH đó để filter
  const { data: khDetail } = useQuery({
    queryKey: ['ke-hoach-detail', filterKhId],
    queryFn: () => productionPlansApi.get(filterKhId!).then(r => r.data),
    enabled: filterKhId != null,
    staleTime: 60_000,
  })
  const khSoLenhSet: Set<string> | null = khDetail
    ? new Set(khDetail.lines.map(l => l.so_lenh).filter((s): s is string => !!s))
    : null

  // Lọc và hiển thị Tab 1
  // Khi chọn KH cụ thể: hiện tất cả LSX trong KH đó (kể cả hoan_thanh) để có thể nhập phôi bổ sung
  // Khi không chọn KH: chỉ hiện LSX đang hoạt động (bỏ hoan_thanh/huy/mua_ngoai)
  const lsxItems = (lsxRes?.items ?? []).filter(o => {
    if (['huy', 'mua_ngoai'].includes(o.trang_thai)) return false
    if (!khSoLenhSet && o.trang_thai === 'hoan_thanh') return false
    if (khSoLenhSet && !khSoLenhSet.has(o.so_lenh)) return false
    if (searchLenh && !o.so_lenh.toLowerCase().includes(searchLenh.toLowerCase())) return false
    return true
  })

  const { data: hoanthanhOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['may-song-order', hoanthanhId],
    queryFn: () => productionOrdersApi.get(hoanthanhId!).then(r => r.data),
    enabled: hoanthanhId !== null,
  })

  // Plan line tương ứng với LSX đang hoàn thành (để pre-fill khổ/cắt/QCCL)
  const hoanthanhPlanLine: PlanLineResponse | null = hoanthanhOrder
    ? (khDetail?.lines.find(l => l.so_lenh === hoanthanhOrder.so_lenh) ?? null)
    : null

  const { data: allPhieu = [], isLoading: phieuLoading, refetch: refetchPhieu } = useQuery({
    queryKey: ['all-phieu', histTuNgay, histDenNgay],
    queryFn: () =>
      productionOrdersApi.listAllPhieu({ tu_ngay: histTuNgay, den_ngay: histDenNgay }).then(r => r.data),
    enabled: activeTab === 'lich_su',
    staleTime: 30_000,
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const invalidateList = useCallback(
    () => qc.invalidateQueries({ queryKey: ['may-song-list'] }),
    [qc],
  )

  const startMut = useMutation({
    mutationFn: (id: number) => productionOrdersApi.start(id),
    onSuccess: () => { message.success('Đã bắt đầu sản xuất'); invalidateList() },
    onError:   () => message.error('Lỗi khi bắt đầu'),
  })

  const pauseMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PauseOrderPayload }) =>
      productionOrdersApi.pause(id, data),
    onSuccess: () => {
      message.success('Đã tạm dừng')
      invalidateList()
      setPauseTarget(null)
      pauseForm.resetFields()
    },
    onError: () => message.error('Lỗi khi tạm dừng'),
  })

  const resumeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ResumeOrderPayload }) =>
      productionOrdersApi.resume(id, data),
    onSuccess: () => {
      message.success('Đã tiếp tục sản xuất')
      invalidateList()
    },
    onError: () => message.error('Lỗi khi tiếp tục'),
  })

  const completeMut = useMutation({
    mutationFn: (id: number) => productionOrdersApi.complete(id),
    onSuccess: () => {
      message.success('Lệnh SX đã hoàn thành! ✓')
      invalidateList()
    },
    onError: () => message.error('Lỗi khi hoàn thành'),
  })

  const createPhieu = useMutation({
    mutationFn: (vars: { orderId: number; data: PhieuNhapPhoiSongPayload }) =>
      productionOrdersApi.createPhieu(vars.orderId, vars.data).then(r => r.data),
    onSuccess: (phieu, vars) => {
      message.success('Đã lưu phiếu — lệnh SX hoàn thành!')
      invalidateList()
      if (hoanthanhOrder) {
        const planLine = khDetail?.lines.find(l => l.so_lenh === hoanthanhOrder.so_lenh) ?? null
        openInTem(hoanthanhOrder, phieu, planLine?.qccl ?? '', planLine?.ghi_chu ?? '')
      }
      completeMut.mutate(vars.orderId)
      setHoanthanhId(null)
      hoanthanhForm.resetFields()
    },
    onError: () => message.error('Lỗi khi lưu phiếu, vui lòng thử lại'),
  })

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = (r: ProductionOrderListItem) => {
    startMut.mutate(r.id)
  }

  const handleComplete = (r: ProductionOrderListItem) => {
    setHoanthanhId(r.id)
  }

  const openInTem = (order: ProductionOrder, phieu: PhieuNhapPhoiSong | null, keHoachQccl = '', keHoachGhiChu = '') => {
    const oi    = order.items[0]
    const soLop = oi?.so_lop ?? oi?.product?.so_lop ?? 5
    const khoMm = phieu?.items[0]?.chieu_kho != null
      ? phieu.items[0].chieu_kho * 10
      : getKhoMm(oi)
    const catMm = phieu?.items[0]?.chieu_cat != null
      ? phieu.items[0].chieu_cat * 10
      : getCatMm(oi)
    const tamPerPallet = calcTamPerPallet(soLop, khoMm)

    // Số thùng: lấy từ phiếu (thực tế) hoặc fallback = KH
    const soThung = phieu
      ? phieu.items.reduce((s, it) => s + Number(it.so_luong_thuc_te ?? 0), 0)
      : order.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0)

    // Số tấm: lấy so_tam đã lưu → tính từ SL TT → fallback 1 tấm = 1 thùng
    const soTam = phieu
      ? phieu.items.reduce((s, it, idx) => {
          if (it.so_tam != null) return s + it.so_tam
          const oi2 = order.items.find(x => x.id === it.production_order_item_id) ?? order.items[idx]
          const slTT = Number(it.so_luong_thuc_te ?? 0)
          const computed = oi2 && slTT > 0
            ? (calcSoTam(oi2, slTT) ?? slTT)
            : 0
          return s + computed
        }, 0)
      : order.items.reduce((s, i) => {
          const kh = Number(i.so_luong_ke_hoach)
          return s + (calcSoTam(i, kh) ?? kh)
        }, 0)

    const soPallet = soTam > 0 ? Math.ceil(soTam / tamPerPallet) : 1
    setInTemState({ order, phieu, soTam, soThung, soPallet, tamPerPallet, khoMm, catMm, ke_hoach_qccl: keHoachQccl, ke_hoach_ghi_chu: keHoachGhiChu })
  }

  const handleInTemBo = async (lsx: ProductionOrderListItem) => {
    setInTemLoading(true)
    try {
      const [orderRes, phieuListRes] = await Promise.all([
        productionOrdersApi.get(lsx.id),
        productionOrdersApi.listPhieu(lsx.id),
      ])
      const latest = phieuListRes.data.length > 0
        ? phieuListRes.data[phieuListRes.data.length - 1]
        : null
      const planLine = khDetail?.lines.find(l => l.so_lenh === lsx.so_lenh) ?? null
      openInTem(orderRes.data, latest, planLine?.qccl ?? '', planLine?.ghi_chu ?? '')
    } catch {
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setInTemLoading(false)
    }
  }

  const handleHoanthanhSubmit = (values: Record<string, unknown>) => {
    if (!hoanthanhOrder) return
    const oi    = hoanthanhOrder.items[0]
    const khoCm = hoanthanhPlanLine?.kho1   ?? (getKhoMm(oi) != null ? getKhoMm(oi)! / 10 : null)
    const catCm = hoanthanhPlanLine?.dai_tt ?? (getCatMm(oi) != null ? getCatMm(oi)! / 10 : null)
    const soDao = hoanthanhPlanLine?.so_dao ?? null
    const slTT  = values.so_luong_thuc_te as number
    const soTam = soDao != null ? Math.ceil(slTT / soDao) : (calcSoTam(oi, slTT) ?? null)
    createPhieu.mutate({
      orderId: hoanthanhOrder.id,
      data: {
        ngay: (values.ngay as dayjs.Dayjs)?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
        ca:           values.ca as string,
        ghi_chu:      (values.ghi_chu as string | null) ?? null,
        gio_bat_dau:  values.gio_bat_dau  ? (values.gio_bat_dau  as dayjs.Dayjs).format('HH:mm') : null,
        gio_ket_thuc: values.gio_ket_thuc ? (values.gio_ket_thuc as dayjs.Dayjs).format('HH:mm') : null,
        items: hoanthanhOrder.items.map((orderItem, idx) => ({
          production_order_item_id: orderItem.id,
          so_luong_ke_hoach: Number(orderItem.so_luong_ke_hoach),
          so_luong_thuc_te:  idx === 0 ? slTT : 0,
          so_luong_loi:      idx === 0 ? ((values.so_luong_loi as number | null) ?? null) : null,
          chieu_kho:         idx === 0 ? khoCm : null,
          chieu_cat:         idx === 0 ? catCm : null,
          so_tam:            idx === 0 ? soTam : null,
        })),
      },
    })
  }

  const handlePrint = async () => {
    if (!inTemState) return
    const { order, phieu, soTam, soThung, soPallet, khoMm, catMm, ke_hoach_qccl, ke_hoach_ghi_chu } = inTemState
    const oi       = order.items[0]
    const khoCmStr = khoMm != null ? mmToDisplayCm(khoMm) : '?'
    const catCmStr = catMm != null ? mmToDisplayCm(catMm) : '?'

    // sl_tam_nho = soTam / so_dao (số phôi chia cho số dao)
    const dims = oi?.loai_thung && oi?.dai && oi?.rong && oi?.cao
      ? calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), oi.so_lop ?? 3)
      : null
    const so_dao = Math.max(1, dims?.so_dao ?? 1)
    const tamNho = soTam > 0 ? Math.round(soTam / so_dao) : 0

    // Ngày SX máy sóng: ngày nhập phôi thực tế, fallback ngày kế hoạch bắt đầu
    const ngaySxMaySong = phieu?.ngay ?? order.ngay_bat_dau_ke_hoach ?? ''

    await printProductionTagBatch({
      so_lenh:          order.so_lenh,
      ten_khach_hang:   order.ten_khach_hang ?? '',
      so_don_hang:      order.so_don ?? '',
      so_po_kh:         order.so_po_kh ?? '',
      loai_sp:          oi?.loai_thung ?? '',
      song:             oi?.to_hop_song ?? '',
      phan_xuong:       order.ten_phan_xuong ?? 'Nam Phương',
      qccl:             ke_hoach_qccl,
      ngay_chay_song:   ngaySxMaySong,
      ngay_giao_cu_chi: oi?.ngay_giao_hang ?? '',
      ngay_giao_kh:     order.ngay_hoan_thanh_ke_hoach ?? '',
      cong_doan:        oi?.cong_doan ?? '',
      ten_san_pham:     oi?.ten_hang ?? '',
      sl_tam_lon: soTam > 0
        ? `${khoCmStr} × ${catCmStr} cm | ${soTam.toLocaleString()} tấm | ${soPallet} pallet`
        : `${khoCmStr} × ${catCmStr} cm`,
      sl_tam_nho: tamNho > 0 ? `${tamNho.toLocaleString()} tấm` : '',
      sl_thung: soThung > 0
        ? `${soThung.toLocaleString()} ${oi?.dvt ?? 'thùng'}`
        : `${oi?.so_luong_ke_hoach ?? ''} ${oi?.dvt ?? 'thùng'}`,
      can_mang:   oi?.loai_in ? 'Có' : 'Không',
      chong_tham: 'Không',
      bo_phan:    'Máy Sóng',
      ghi_chu:    ke_hoach_ghi_chu,
    }, soPallet)
    setInTemState(null)
  }

  // ─── Cột bảng Tab 1 ────────────────────────────────────────────────────────

  const columns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Số lệnh',
      width: 145,
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.so_lenh}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(r.ngay_lenh).format('DD/MM/YY')}</Text>
          {'  '}
          <Tag color={TRANG_THAI_COLORS[r.trang_thai]} style={{ margin: '2px 0 0', fontSize: 11, lineHeight: '16px' }}>
            {TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Tên hàng',
      render: (_, r) => <Text strong>{r.ten_hang ?? '—'}</Text>,
    },
    {
      title: 'Khách hàng',
      width: 130,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.ten_khach_hang ?? '—'}</Text>,
    },
    {
      title: 'Khổ × Cắt',
      width: 105,
      align: 'center',
      render: (_, r) => {
        if (!r.kho_tt && !r.dai_tt) return <Text type="secondary">—</Text>
        const kho = r.kho_tt != null ? Number(r.kho_tt) : '?'
        const cat = r.dai_tt != null ? Number(r.dai_tt) : '?'
        return <Text style={{ fontWeight: 600 }}>{kho} × {cat} cm</Text>
      },
    },
    {
      title: 'Lớp · Sóng',
      width: 85,
      align: 'center',
      render: (_, r) => [r.so_lop ? `${r.so_lop}L` : null, r.to_hop_song].filter(Boolean).join(' · ') || '—',
    },
    {
      title: 'Số tấm',
      width: 80,
      align: 'right',
      render: (_, r) => {
        const soTam = calcSoTamFromListItem(r)
        return soTam != null
          ? <Text strong>{soTam.toLocaleString()}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Số thùng',
      width: 85,
      align: 'right',
      render: (_, r) => {
        const tt = Number(r.tong_sl_thuc_te)
        const kh = Number(r.tong_sl_ke_hoach)
        return tt > 0
          ? <Text strong>{tt.toLocaleString()}</Text>
          : <Text type="secondary">{kh.toLocaleString()}</Text>
      },
    },
    {
      title: 'KH / Nhập / Còn',
      width: 120,
      render: (_, r) => {
        const kh  = Number(r.tong_sl_ke_hoach)
        const tt  = Number(r.tong_sl_thuc_te)
        const con = kh - tt
        return (
          <div style={{ lineHeight: 1.5, fontSize: 12 }}>
            <div><Text type="secondary">KH: {kh.toLocaleString()}</Text></div>
            <div>Nhập: {tt.toLocaleString()}</div>
            {con > 0
              ? <Text strong style={{ color: '#cf1322' }}>Còn: {con.toLocaleString()}</Text>
              : tt > 0
                ? <Tag color="green" style={{ fontSize: 11, padding: '0 4px' }}>Đủ ✓</Tag>
                : null
            }
          </div>
        )
      },
    },
    {
      title: 'Ngày giao',
      width: 85,
      align: 'center',
      render: (_, r) => r.ngay_hoan_thanh_ke_hoach
        ? <Text style={{ fontSize: 12 }}>{dayjs(r.ngay_hoan_thanh_ke_hoach).format('DD/MM/YY')}</Text>
        : '—',
    },
    {
      title: 'Hành động',
      width: 220,
      fixed: 'right',
      render: (_, r) => {
        const st = r.trang_thai
        return (
          <Space size={4} wrap>
            {st === 'moi' && (
              <Button size="small" type="primary" icon={<CaretRightOutlined />}
                loading={startMut.isPending}
                onClick={() => handleStart(r)}>
                Bắt đầu
              </Button>
            )}
            {st === 'dang_chay' && (
              <Button size="small" danger icon={<PauseOutlined />}
                onClick={() => setPauseTarget({ id: r.id, so_lenh: r.so_lenh })}>
                Dừng
              </Button>
            )}
            {st === 'tam_dung' && (
              <Button size="small" type="primary" icon={<CaretRightOutlined />}
                loading={resumeMut.isPending}
                onClick={() => resumeMut.mutate({ id: r.id, data: { gio_tiep_tuc: dayjs().format('HH:mm') } })}>
                Tiếp tục
              </Button>
            )}
            {(st === 'dang_chay' || st === 'tam_dung') && (
              <Button size="small" type="primary"
                onClick={() => handleComplete(r)}>
                Hoàn thành
              </Button>
            )}
            <Button
              size="small"
              icon={<PrinterOutlined />}
              loading={inTemLoading}
              onClick={() => handleInTemBo(r)}
            >
              In tem
            </Button>
          </Space>
        )
      },
    },
  ]

  // ─── Cột bảng Tab 2 (Lịch sử) ─────────────────────────────────────────────

  const allPhieuCols: ColumnsType<PhieuNhapPhoiSongListItem> = [
    { title: 'Số phiếu',   dataIndex: 'so_phieu',           width: 155 },
    { title: 'Số lệnh',    dataIndex: 'so_lenh',            width: 130, render: (v: string | null) => v ?? '—' },
    { title: 'Kho',        dataIndex: 'ten_kho',            width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'Ngày',       dataIndex: 'ngay',               width: 90  },
    { title: 'Ca',         dataIndex: 'ca',                 width: 60  },
    {
      title: 'Giờ',
      width: 105,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) =>
        r.gio_bat_dau || r.gio_ket_thuc
          ? `${r.gio_bat_dau ?? '?'} – ${r.gio_ket_thuc ?? '?'}`
          : '—',
    },
    {
      title: 'SL thực tế',
      dataIndex: 'tong_so_luong_thuc_te',
      align: 'right',
      width: 95,
      render: (v: number) => v?.toLocaleString() ?? '—',
    },
    {
      title: 'Tổng tấm',
      dataIndex: 'tong_so_tam',
      align: 'right',
      width: 90,
      render: (v: number) => v > 0 ? v.toLocaleString() : '—',
    },
    {
      title: 'Phôi lỗi',
      dataIndex: 'tong_so_luong_loi',
      align: 'right',
      width: 80,
      render: (v: number) => v > 0 ? <Text type="danger">{v.toLocaleString()}</Text> : '—',
    },
    { title: 'Người tạo', dataIndex: 'created_by_name', render: (v: string | null) => v ?? '—' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ margin: '0 0 16px' }}>Máy Sóng — Nhập Phôi & In Tem</Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ══════════════════════════════════════════════════════════════
          //  TAB 1 — Đang sản xuất
          // ══════════════════════════════════════════════════════════════
          {
            key: 'dang_sx',
            label: `Đang sản xuất (${lsxItems.length})`,
            children: (
              <>
                {/* Filter bar */}
                <Row gutter={8} style={{ marginBottom: 12 }} align="middle" wrap>
                  <Col>
                    <Select
                      placeholder="— Chọn kế hoạch SX —"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      style={{ width: 210, borderColor: !filterKhId ? '#faad14' : undefined }}
                      value={filterKhId}
                      onChange={v => setFilterKhId(v)}
                      options={khList.map(k => ({ value: k.id, label: k.so_ke_hoach }))}
                      status={!filterKhId ? 'warning' : undefined}
                    />
                  </Col>
                  <Col>
                    <Input
                      placeholder="Tìm số lệnh..."
                      allowClear
                      style={{ width: 150 }}
                      value={searchLenh}
                      onChange={e => setSearchLenh(e.target.value)}
                    />
                  </Col>
                  <Col>
                    <Select
                      placeholder="Tất cả xưởng"
                      allowClear
                      style={{ width: 155 }}
                      value={filterPxId}
                      onChange={v => setFilterPxId(v)}
                      options={pxList.map(px => ({ value: px.id, label: px.ten_xuong }))}
                    />
                  </Col>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
                  </Col>
                </Row>

                {/* Ghi chú khi chưa chọn KH */}
                {!filterKhId && (
                  <div style={{ marginBottom: 8, padding: '6px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, color: '#ad6800' }}>
                      Chọn kế hoạch sản xuất để thông số kỹ thuật (khổ, cắt, QCCL) tự điền khi Hoàn thành
                    </Text>
                  </div>
                )}

                {/* Bảng LSX */}
                <Table
                  dataSource={lsxItems}
                  columns={columns}
                  rowKey="id"
                  loading={isLoading || (filterKhId != null && !khDetail)}
                  pagination={{ pageSize: 50, showTotal: t => `${t} lệnh SX` }}
                  size="small"
                  scroll={{ x: 1200 }}
                  locale={{ emptyText: filterKhId ? 'Không có lệnh SX nào trong kế hoạch này' : 'Không có lệnh SX đang hoạt động' }}
                  onRow={(r) => {
                    if (!r.ngay_hoan_thanh_ke_hoach) return {}
                    const days = dayjs(r.ngay_hoan_thanh_ke_hoach).diff(dayjs(), 'day')
                    if (days < 0) return { style: { background: '#fff1f0' } }
                    if (days <= 2) return { style: { background: '#fffbe6' } }
                    return {}
                  }}
                />
              </>
            ),
          },

          // ══════════════════════════════════════════════════════════════
          //  TAB 2 — Lịch sử phiếu nhập
          // ══════════════════════════════════════════════════════════════
          {
            key: 'lich_su',
            label: 'Lịch sử phiếu nhập',
            children: (
              <>
                <Row gutter={8} style={{ marginBottom: 12 }} align="middle">
                  <Col>
                    <DatePicker
                      value={dayjs(histTuNgay)}
                      onChange={d => d && setHistTuNgay(d.format('YYYY-MM-DD'))}
                      placeholder="Từ ngày"
                      format="DD/MM/YYYY"
                    />
                  </Col>
                  <Col><Text type="secondary">—</Text></Col>
                  <Col>
                    <DatePicker
                      value={dayjs(histDenNgay)}
                      onChange={d => d && setHistDenNgay(d.format('YYYY-MM-DD'))}
                      placeholder="Đến ngày"
                      format="DD/MM/YYYY"
                    />
                  </Col>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={() => refetchPhieu()}>Tải lại</Button>
                  </Col>
                </Row>
                <Table
                  dataSource={allPhieu}
                  columns={allPhieuCols}
                  rowKey="id"
                  loading={phieuLoading}
                  pagination={{ pageSize: 50, showTotal: t => `${t} phiếu` }}
                  size="small"
                  scroll={{ x: 900 }}
                  locale={{ emptyText: 'Chưa có phiếu nhập nào trong khoảng ngày này' }}
                />
              </>
            ),
          },
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════
          Modal: Tạm dừng — ghi giờ + lý do
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        title={`Tạm dừng — ${pauseTarget?.so_lenh ?? ''}`}
        open={pauseTarget !== null}
        onCancel={() => { setPauseTarget(null); pauseForm.resetFields() }}
        onOk={() => pauseForm.submit()}
        okText="⏸ Tạm dừng"
        okButtonProps={{ danger: true }}
        confirmLoading={pauseMut.isPending}
        destroyOnHidden
        width={420}
      >
        <Form form={pauseForm} layout="vertical"
          onFinish={(values) => {
            if (!pauseTarget) return
            pauseMut.mutate({
              id: pauseTarget.id,
              data: {
                gio_bat_dau_dung: (values.gio_bat_dau_dung as dayjs.Dayjs).format('HH:mm'),
                ly_do:   values.ly_do as string,
                ghi_chu: (values.ghi_chu as string | null) ?? null,
              },
            })
          }}
        >
          <Form.Item name="gio_bat_dau_dung" label="Giờ dừng"
            rules={[{ required: true, message: 'Nhập giờ dừng' }]}
            initialValue={dayjs()}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do dừng"
            rules={[{ required: true, message: 'Nhập lý do' }]}
          >
            <Input placeholder="VD: Hết giấy, Sửa máy, Nghỉ cơm..." />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú (tuỳ chọn)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          Modal: Hoàn thành — ghi giờ + SL thực tế → tự tạo phiếu
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        title={`Hoàn thành — ${hoanthanhOrder?.so_lenh ?? '...'}`}
        open={hoanthanhId !== null}
        onCancel={() => { setHoanthanhId(null); hoanthanhForm.resetFields() }}
        onOk={() => hoanthanhForm.submit()}
        okText="✓ Hoàn thành"
        okButtonProps={{ type: 'primary' }}
        confirmLoading={createPhieu.isPending || completeMut.isPending}
        width={480}
        destroyOnHidden
      >
        {orderLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin size="large" /></div>
        ) : hoanthanhOrder ? (
          <>
            <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
              <Text strong style={{ fontSize: 14 }}>{hoanthanhOrder.items[0]?.ten_hang ?? '—'}</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  KH: {hoanthanhOrder.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0).toLocaleString()} thùng
                  {hoanthanhPlanLine?.kho1 ? ` | Khổ: ${hoanthanhPlanLine.kho1} cm` : ''}
                  {hoanthanhPlanLine?.dai_tt ? ` | Cắt: ${hoanthanhPlanLine.dai_tt} cm` : ''}
                  {hoanthanhPlanLine?.qccl ? ` | ${hoanthanhPlanLine.qccl}` : ''}
                </Text>
              </div>
            </div>
            <Form form={hoanthanhForm} layout="vertical" onFinish={handleHoanthanhSubmit} size="middle">
              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item name="ngay" label="Ngày" initialValue={dayjs()}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="ca" label="Ca" rules={[{ required: true, message: 'Chọn ca' }]}>
                    <Select options={['Ca 1', 'Ca 2', 'Ca 3', 'Ca đêm'].map(c => ({ value: c, label: c }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="gio_bat_dau" label="Giờ BĐ">
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item name="gio_ket_thuc" label="Giờ KT" initialValue={dayjs()}>
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="so_luong_thuc_te"
                label="Số lượng thực tế (thùng)"
                rules={[{ required: true, message: 'Nhập SL thực tế' }]}
                initialValue={hoanthanhOrder.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0)}
              >
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item name="so_luong_loi" label="Phôi lỗi (nếu có)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </>
        ) : null}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          Modal: Kiểm tra & In tem — xem trước đầy đủ
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        title={`Kiểm tra & In tem — ${inTemState?.order.so_lenh ?? ''}`}
        open={inTemState !== null}
        onCancel={() => setInTemState(null)}
        footer={[
          <Button key="cancel" onClick={() => setInTemState(null)}>Đóng</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={handlePrint}>
            In {inTemState?.soPallet ?? 1} tem
          </Button>,
        ]}
        width={540}
        destroyOnHidden
      >
        {inTemState && (() => {
          const { order, soTam, soThung, tamPerPallet, khoMm, catMm } = inTemState
          const oi       = order.items[0]
          const khoCmStr = khoMm != null ? mmToDisplayCm(khoMm) : '?'
          const catCmStr = catMm != null ? mmToDisplayCm(catMm) : '?'
          return (
            <>
              <div style={{ border: '2px solid #333', borderRadius: 6, padding: 12, marginBottom: 16, background: '#fafafa' }}>
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={14}>
                    <Text type="secondary" style={{ fontSize: 10 }}>KHÁCH HÀNG</Text>
                    <div><Text strong style={{ fontSize: 13 }}>{order.ten_khach_hang ?? '—'}</Text></div>
                  </Col>
                  <Col span={10}>
                    <Text type="secondary" style={{ fontSize: 10 }}>SỐ ĐH / PO KH</Text>
                    <div>
                      <Text style={{ fontSize: 12 }}>
                        {order.so_don ?? '—'}{order.so_po_kh ? ` / ${order.so_po_kh}` : ''}
                      </Text>
                    </div>
                  </Col>
                </Row>
                <div style={{ padding: '6px 0', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 10 }}>TÊN SẢN PHẨM</Text>
                  <div><Text strong style={{ fontSize: 15 }}>{oi?.ten_hang ?? '—'}</Text></div>
                </div>
                <Row gutter={6} style={{ marginBottom: 10 }}>
                  <Col span={7}>
                    <Text type="secondary" style={{ fontSize: 10 }}>LOẠI THÙNG</Text>
                    <div><Text>{oi?.loai_thung ?? '—'}</Text></div>
                  </Col>
                  <Col span={7}>
                    <Text type="secondary" style={{ fontSize: 10 }}>SÓNG</Text>
                    <div><Text strong>{oi?.to_hop_song ?? '—'}</Text></div>
                  </Col>
                  <Col span={10}>
                    <Text type="secondary" style={{ fontSize: 10 }}>QCCL / CÁN LẰN</Text>
                    <div><Text style={{ fontSize: 12 }}>{inTemState.ke_hoach_qccl || '—'}</Text></div>
                  </Col>
                </Row>
                {/* 3 ô số liệu chính */}
                <Row gutter={8} style={{ marginBottom: 10 }}>
                  <Col span={8}>
                    <div style={{ border: '2px solid #1677ff', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#e6f4ff' }}>
                      <div style={{ fontSize: 10, color: '#1677ff', fontWeight: 600, marginBottom: 2 }}>KHỔ × CẮT</div>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{khoCmStr} × {catCmStr}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>cm</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ border: '2px solid #722ed1', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#f9f0ff' }}>
                      <div style={{ fontSize: 10, color: '#722ed1', fontWeight: 600, marginBottom: 2 }}>SỐ TẤM</div>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{soTam > 0 ? soTam.toLocaleString() : '—'}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>tấm</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ border: '2px solid #52c41a', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#f6ffed' }}>
                      <div style={{ fontSize: 10, color: '#52c41a', fontWeight: 600, marginBottom: 2 }}>SỐ THÙNG</div>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{soThung > 0 ? soThung.toLocaleString() : '—'}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{oi?.dvt ?? 'thùng'}</div>
                    </div>
                  </Col>
                </Row>
                <Row gutter={8}>
                  {order.ngay_bat_dau_ke_hoach && (
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>NSX MÁY SÓNG</Text>
                      <div><Text style={{ fontSize: 12 }}>{order.ngay_bat_dau_ke_hoach}</Text></div>
                    </Col>
                  )}
                  {oi?.ngay_giao_hang && (
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>GIAO VỀ CỦ CHI</Text>
                      <div><Text strong style={{ color: '#d4380d', fontSize: 12 }}>{oi.ngay_giao_hang}</Text></div>
                    </Col>
                  )}
                  {order.ngay_hoan_thanh_ke_hoach && (
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 10 }}>GIAO CHO KH</Text>
                      <div><Text strong style={{ color: '#d4380d', fontSize: 12 }}>{order.ngay_hoan_thanh_ke_hoach}</Text></div>
                    </Col>
                  )}
                </Row>
              </div>

              {/* Thiết lập pallet */}
              <Divider style={{ margin: '10px 0' }} />
              <Row align="middle" gutter={12} style={{ marginBottom: 6 }}>
                <Col span={12}><Text>Tấm / pallet:</Text></Col>
                <Col span={12}>
                  <InputNumber
                    min={1}
                    value={tamPerPallet}
                    onChange={v => {
                      if (!v) return
                      const nTpp = Math.max(1, v)
                      setInTemState(s => s ? { ...s, tamPerPallet: nTpp, soPallet: s.soTam > 0 ? Math.ceil(s.soTam / nTpp) : 1 } : null)
                    }}
                    addonAfter="tấm"
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
              {soTam > 0 && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                  {soTam.toLocaleString()} tấm ÷ {tamPerPallet} tấm/pallet
                  {' = '}<Text strong>{inTemState.soPallet} pallet</Text>
                </Text>
              )}
              <Row align="middle" gutter={12}>
                <Col span={12}><Text strong>Số pallet cần in tem:</Text></Col>
                <Col span={12}>
                  <InputNumber
                    min={1} max={99}
                    value={inTemState.soPallet}
                    onChange={v => setInTemState(s => s ? { ...s, soPallet: v ?? 1 } : null)}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            </>
          )
        })()}
      </Modal>
    </div>
  )
}
