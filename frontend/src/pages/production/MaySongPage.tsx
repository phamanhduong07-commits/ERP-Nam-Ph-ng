import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Segmented, Select, Space, Spin,
  Table, Tag, TimePicker, Typography,
} from 'antd'
import {
  HistoryOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type {
  ProductionOrder, ProductionOrderItem, ProductionOrderListItem,
  PhieuNhapPhoiSong, PhieuNhapPhoiSongPayload,
} from '../../api/productionOrders'
import { warehouseApi } from '../../api/warehouse'
import { calcBoxDimensions } from '../../api/quotes'
import { printProductionTagBatch } from '../../utils/exportUtils'

const { Text, Title } = Typography

// ─── Pallet tiêu chuẩn (mm) ─────────────────────────────────────────────────
const PALLET_W_MM = 1000
const PALLET_L_MM = 1200
const PALLET_H_MM = 2000

// Độ dày tờ phôi theo số lớp (mm)
const MM_PER_SHEET: Record<number, number> = { 3: 4, 5: 7, 7: 12 }

/**
 * Tính số tấm/pallet theo công thức chuẩn (mm units):
 *   sheets_per_layer = max(floor(W/kho)×floor(L/cat), floor(W/cat)×floor(L/kho))
 *   layers           = floor(H / mm_per_sheet)
 *   tam_per_pallet   = sheets_per_layer × layers
 */
function calcTamPerPallet(soLop: number, khoMm: number | null, catMm: number | null): number {
  const mmSheet = MM_PER_SHEET[soLop] ?? 7
  const layers = Math.floor(PALLET_H_MM / mmSheet)
  if (!khoMm || !catMm || khoMm <= 0 || catMm <= 0) return layers
  const optA = Math.floor(PALLET_W_MM / khoMm) * Math.floor(PALLET_L_MM / catMm)
  const optB = Math.floor(PALLET_W_MM / catMm) * Math.floor(PALLET_L_MM / khoMm)
  return Math.max(optA, optB, 1) * layers
}

// ─── Unit helpers ────────────────────────────────────────────────────────────

/** kho_tt trong ProductionOrderItem lưu mm → trả mm */
function getKhoMm(oi: ProductionOrderItem): number | null {
  if (oi.kho_tt != null) return Number(oi.kho_tt)
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.kho_tt ? Math.ceil(dims.kho_tt / 5) * 5 * 10 : null  // cm→mm, round up 5
}

/** dai_tt trong ProductionOrderItem lưu mm → trả mm */
function getCatMm(oi: ProductionOrderItem): number | null {
  if (oi.dai_tt != null) return Number(oi.dai_tt)
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.dai_tt ? Math.round(dims.dai_tt * 10) : null  // cm→mm
}

/** Hiển thị mm → chuỗi cm (e.g. 450 → "45") */
function mmToDisplayCm(mm: number | null | undefined): string {
  if (mm == null) return '?'
  return (mm / 10).toFixed(1).replace(/\.0$/, '')
}

/** Tính số tấm từ số thùng — cần loại thùng + kích thước */
function calcSoTam(oi: ProductionOrderItem, soThung: number): number | null {
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  if (!dims || dims.so_dao < 1) return null
  return Math.ceil(soThung / dims.so_dao)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface InTemState {
  order: ProductionOrder
  phieu: PhieuNhapPhoiSong | null
  soTam: number
  soPallet: number
  tamPerPallet: number
  khoMm: number | null
  catMm: number | null
}

interface HistoryTarget { id: number; so_lenh: string }

const LY_DO_OPTIONS = [
  { value: 'hong_may', label: 'Hỏng máy' },
  { value: 'het_nguyen_lieu', label: 'Hết nguyên liệu' },
  { value: 'nghi_giai_lao', label: 'Nghỉ giải lao' },
  { value: 'giao_ca', label: 'Giao ca' },
  { value: 'khac', label: 'Khác' },
]

type TrangThaiFilter = 'tat_ca' | 'moi' | 'dang_chay' | 'tam_dung' | 'hoan_thanh'

const FILTER_OPTIONS: { label: string; value: TrangThaiFilter }[] = [
  { label: 'Tất cả', value: 'tat_ca' },
  { label: 'Mới', value: 'moi' },
  { label: 'Đang SX', value: 'dang_chay' },
  { label: 'Tạm dừng', value: 'tam_dung' },
  { label: 'Hoàn thành', value: 'hoan_thanh' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function MaySongPage() {
  const [filterPxId, setFilterPxId] = useState<number | undefined>(undefined)
  const [filterTrangThai, setFilterTrangThai] = useState<TrangThaiFilter>('tat_ca')
  const [nhapLsxId, setNhapLsxId] = useState<number | null>(null)
  const [inTemState, setInTemState] = useState<InTemState | null>(null)
  const [inTemLoading, setInTemLoading] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<ProductionOrderListItem | null>(null)
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null)
  const [nhapForm] = Form.useForm()
  const [pauseForm] = Form.useForm()
  const qc = useQueryClient()

  // Chỉ 2 xưởng có máy sóng
  const { data: pxList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () =>
      warehouseApi.listPhanXuong().then(r =>
        r.data.filter(px => ['Hoàng Gia', 'Nam Thuận'].some(n => (px.ten_xuong ?? '').includes(n)))
      ),
    staleTime: 60_000,
  })

  // Danh sách LSX — lấy cả tất cả, filter client-side
  const { data: lsxRes, isLoading, refetch } = useQuery({
    queryKey: ['may-song-list', filterPxId],
    queryFn: () =>
      productionOrdersApi.list({ page_size: 200, phan_xuong_id: filterPxId }).then(r => r.data),
  })

  const lsxItems = (lsxRes?.items ?? []).filter(o => {
    if (filterTrangThai === 'tat_ca') return !['huy'].includes(o.trang_thai)
    return o.trang_thai === filterTrangThai
  })

  // Count theo trang_thai cho badge
  const counts = (lsxRes?.items ?? []).reduce<Record<string, number>>((acc, o) => {
    if (!['huy'].includes(o.trang_thai)) acc[o.trang_thai] = (acc[o.trang_thai] ?? 0) + 1
    return acc
  }, {})
  const totalActive = Object.values(counts).reduce((s, n) => s + n, 0)

  const filterOptionsWithCount = FILTER_OPTIONS.map(opt => ({
    ...opt,
    label: opt.value === 'tat_ca'
      ? `Tất cả (${totalActive})`
      : counts[opt.value]
        ? `${opt.label} (${counts[opt.value]})`
        : opt.label,
  }))

  // Full order khi mở nhập modal
  const { data: fullOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['may-song-order', nhapLsxId],
    queryFn: () => productionOrdersApi.get(nhapLsxId!).then(r => r.data),
    enabled: nhapLsxId !== null,
  })

  // Lịch sử phiếu
  const { data: historyPhieu = [], isLoading: historyLoading } = useQuery({
    queryKey: ['may-song-history', historyTarget?.id],
    queryFn: () => productionOrdersApi.listPhieu(historyTarget!.id).then(r => r.data),
    enabled: historyTarget !== null,
  })

  // ─── Mutations trạng thái ──────────────────────────────────────────────────

  const invalidateList = useCallback(
    () => qc.invalidateQueries({ queryKey: ['may-song-list'] }),
    [qc],
  )

  const startMutation = useMutation({
    mutationFn: (id: number) => productionOrdersApi.start(id),
    onSuccess: () => { message.success('Đã bắt đầu sản xuất'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi bắt đầu'),
  })

  const pauseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof productionOrdersApi.pause>[1] }) =>
      productionOrdersApi.pause(id, data),
    onSuccess: () => {
      message.success('Đã tạm dừng')
      setPauseTarget(null)
      pauseForm.resetFields()
      invalidateList()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi tạm dừng'),
  })

  const resumeMutation = useMutation({
    mutationFn: (id: number) =>
      productionOrdersApi.resume(id, { gio_tiep_tuc: dayjs().format('HH:mm') }),
    onSuccess: () => { message.success('Đã tiếp tục sản xuất'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi tiếp tục'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => productionOrdersApi.complete(id),
    onSuccess: () => { message.success('Đã hoàn thành lệnh SX'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi hoàn thành'),
  })

  // ─── Tạo phiếu nhập ───────────────────────────────────────────────────────

  const createPhieu = useMutation({
    mutationFn: (vars: { orderId: number; data: PhieuNhapPhoiSongPayload }) =>
      productionOrdersApi.createPhieu(vars.orderId, vars.data).then(r => r.data),
    onSuccess: (phieu) => {
      message.success('Đã lưu phiếu nhập phôi!')
      qc.invalidateQueries({ queryKey: ['may-song-list'] })
      if (fullOrder) openInTem(fullOrder, phieu)
      setNhapLsxId(null)
      nhapForm.resetFields()
    },
    onError: () => message.error('Lỗi khi lưu phiếu, vui lòng thử lại'),
  })

  // ─── openInTem: tính soTam với fallback ───────────────────────────────────

  const openInTem = (order: ProductionOrder, phieu: PhieuNhapPhoiSong | null) => {
    const oi = order.items[0]
    const soLop = oi?.so_lop ?? oi?.product?.so_lop ?? 5

    // Kho/cắt: ưu tiên phiếu thực tế (cm → mm), fallback kho_tt/dai_tt từ LSX item (mm)
    const khoMm = phieu?.items[0]?.chieu_kho != null
      ? phieu.items[0].chieu_kho * 10          // cm → mm
      : getKhoMm(oi)

    const catMm = phieu?.items[0]?.chieu_cat != null
      ? phieu.items[0].chieu_cat * 10          // cm → mm
      : getCatMm(oi)

    const tamPerPallet = calcTamPerPallet(soLop, khoMm, catMm)

    // soTam: từ so_tam đã lưu, fallback tính từ so_luong_thuc_te nếu so_tam null
    const soTam = phieu
      ? phieu.items.reduce((s, it, idx) => {
          if (it.so_tam != null) return s + it.so_tam
          // fallback: tính từ so_luong_thuc_te và dims của order item
          const orderItem = order.items.find(oi2 => oi2.id === it.production_order_item_id)
            ?? order.items[idx]
          const computed = orderItem && it.so_luong_thuc_te != null
            ? (calcSoTam(orderItem, it.so_luong_thuc_te) ?? 0)
            : 0
          return s + computed
        }, 0)
      : 0

    const soPallet = soTam > 0 ? Math.ceil(soTam / tamPerPallet) : 1
    setInTemState({ order, phieu, soTam, soPallet, tamPerPallet, khoMm, catMm })
  }

  // ─── handleInTemBo (từ nút "In tem" trong bảng) ───────────────────────────

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
      openInTem(orderRes.data, latest)
    } catch {
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setInTemLoading(false)
    }
  }

  // ─── handleNhapSubmit ─────────────────────────────────────────────────────

  const handleNhapSubmit = (values: any) => {
    if (!fullOrder) return
    const ngay = values.ngay
      ? (values.ngay as dayjs.Dayjs).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    const items: PhieuNhapPhoiSongPayload['items'] = fullOrder.items.map((oi, idx) => {
      const slTT: number | null = values.items?.[idx]?.so_luong_thuc_te ?? null
      const khoCm: number | null = values.items?.[idx]?.chieu_kho ?? null
      const catCm: number | null = values.items?.[idx]?.chieu_cat ?? null
      // so_tam: dùng giá trị manual nếu có, nếu không thì tính từ slTT
      const soTamManual: number | null = values.items?.[idx]?.so_tam ?? null
      const soTamComputed = slTT != null ? (calcSoTam(oi, slTT) ?? null) : null
      return {
        production_order_item_id: oi.id,
        so_luong_ke_hoach: oi.so_luong_ke_hoach,
        so_luong_thuc_te: slTT,
        so_luong_loi: values.items?.[idx]?.so_luong_loi ?? null,
        chieu_kho: khoCm,
        chieu_cat: catCm,
        so_tam: soTamManual ?? soTamComputed,
      }
    })
    createPhieu.mutate({
      orderId: fullOrder.id,
      data: {
        ngay,
        ca: values.ca,
        ghi_chu: values.ghi_chu ?? null,
        gio_bat_dau: values.gio_bat_dau ? (values.gio_bat_dau as dayjs.Dayjs).format('HH:mm') : null,
        gio_ket_thuc: values.gio_ket_thuc ? (values.gio_ket_thuc as dayjs.Dayjs).format('HH:mm') : null,
        items,
      },
    })
  }

  // ─── handlePrint ──────────────────────────────────────────────────────────

  const handlePrint = async () => {
    if (!inTemState) return
    const { order, phieu, soPallet, soTam, tamPerPallet, khoMm, catMm } = inTemState
    const oi = order.items[0]
    const phieuItem = phieu?.items[0]

    const khoCmStr = khoMm != null ? mmToDisplayCm(khoMm) : (phieuItem?.chieu_kho?.toString() ?? '?')
    const catCmStr = catMm != null ? mmToDisplayCm(catMm) : (phieuItem?.chieu_cat?.toString() ?? '?')

    const tagData = {
      so_lenh: order.so_lenh,
      ten_khach_hang: order.ten_khach_hang ?? '',
      so_don_hang: order.so_don ?? '',
      so_po_kh: order.so_po_kh ?? '',
      loai_sp: oi?.loai_thung ?? '',
      song: oi?.to_hop_song ?? '',
      phan_xuong: order.ten_phan_xuong ?? 'Nam Phương',
      qccl: oi?.qccl ?? '',
      ngay_chay_song: order.ngay_bat_dau_ke_hoach ?? '',
      ngay_giao_cu_chi: oi?.ngay_giao_hang ?? '',
      ngay_giao_kh: order.ngay_hoan_thanh_ke_hoach ?? '',
      cong_doan: oi?.cong_doan ?? '',
      ten_san_pham: oi?.ten_hang ?? '',
      sl_tam_lon: soTam > 0
        ? `${khoCmStr} × ${catCmStr} cm | ${soTam.toLocaleString()} tấm | ${soPallet} pallet`
        : `${khoCmStr} × ${catCmStr} cm | ${tamPerPallet} tấm/pallet`,
      sl_tam_nho: '',
      sl_thung: phieu
        ? `${phieu.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)} ${oi?.dvt ?? 'thùng'}`
        : `${oi?.so_luong_ke_hoach ?? ''} ${oi?.dvt ?? 'thùng'}`,
      can_mang: oi?.loai_in ? 'Có' : 'Không',
      chong_tham: 'Không',
      bo_phan: 'Máy Sóng',
      ghi_chu: order.ghi_chu ?? '',
    }
    await printProductionTagBatch(tagData, soPallet)
    setInTemState(null)
  }

  const handlePauseSubmit = (values: any) => {
    if (!pauseTarget) return
    pauseMutation.mutate({
      id: pauseTarget.id,
      data: {
        gio_bat_dau_dung: (values.gio_bat_dau_dung as dayjs.Dayjs).format('HH:mm'),
        ly_do: values.ly_do,
        ghi_chu: values.ghi_chu ?? null,
      },
    })
  }

  // ─── Cột bảng ─────────────────────────────────────────────────────────────

  const columns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 145,
      render: (v: string) => <Text strong style={{ fontSize: 14 }}>{v}</Text>,
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don',
      width: 120,
      render: (v: string | null) => v
        ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
        : '—',
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Mặt hàng',
      dataIndex: 'ten_hang',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Khổ × Cắt (cm)',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, r: ProductionOrderListItem) => (
        <Text type="secondary">{mmToDisplayCm(r.kho_tt)} × {mmToDisplayCm(r.dai_tt)}</Text>
      ),
    },
    {
      title: 'Lớp / Sóng',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: ProductionOrderListItem) => (
        <Space size={2} direction="vertical" style={{ lineHeight: 1.2 }}>
          {r.so_lop ? <Tag>{r.so_lop}L</Tag> : null}
          {r.to_hop_song ? <Text type="secondary" style={{ fontSize: 11 }}>{r.to_hop_song}</Text> : null}
          {!r.so_lop && !r.to_hop_song ? '—' : null}
        </Space>
      ),
    },
    {
      title: 'SL KH',
      dataIndex: 'tong_sl_ke_hoach',
      width: 75,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString() ?? '—',
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_hoan_thanh_ke_hoach',
      width: 85,
      align: 'center' as const,
      render: (v: string | null) => v
        ? <Text type="secondary">{dayjs(v).format('DD/MM')}</Text>
        : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 330,
      render: (_: unknown, record: ProductionOrderListItem) => (
        <Space wrap>
          {record.trang_thai === 'moi' && (
            <Popconfirm
              title={`Bắt đầu SX lệnh ${record.so_lenh}?`}
              onConfirm={() => startMutation.mutate(record.id)}
              okText="Bắt đầu"
            >
              <Button type="primary" size="small" loading={startMutation.isPending}>
                Bắt đầu
              </Button>
            </Popconfirm>
          )}
          {record.trang_thai === 'dang_chay' && (
            <>
              <Button
                size="small"
                onClick={() => { setPauseTarget(record); pauseForm.setFieldValue('gio_bat_dau_dung', dayjs()) }}
              >
                Tạm dừng
              </Button>
              <Popconfirm
                title={`Hoàn thành lệnh ${record.so_lenh}?`}
                onConfirm={() => completeMutation.mutate(record.id)}
                okText="Hoàn thành"
              >
                <Button type="primary" size="small" loading={completeMutation.isPending}>
                  Hoàn thành
                </Button>
              </Popconfirm>
            </>
          )}
          {record.trang_thai === 'tam_dung' && (
            <Popconfirm
              title="Tiếp tục sản xuất?"
              onConfirm={() => resumeMutation.mutate(record.id)}
              okText="Tiếp tục"
            >
              <Button type="primary" size="small" loading={resumeMutation.isPending}>
                Tiếp tục
              </Button>
            </Popconfirm>
          )}
          <Button
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setNhapLsxId(record.id)}
          >
            Nhập
          </Button>
          <Button
            icon={<PrinterOutlined />}
            size="small"
            loading={inTemLoading}
            onClick={() => handleInTemBo(record)}
          >
            In tem
          </Button>
          <Button
            icon={<HistoryOutlined />}
            size="small"
            onClick={() => setHistoryTarget({ id: record.id, so_lenh: record.so_lenh })}
          >
            Lịch sử
          </Button>
        </Space>
      ),
    },
  ]

  const historyColumns: ColumnsType<PhieuNhapPhoiSong> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    { title: 'Ngày', dataIndex: 'ngay', width: 100 },
    { title: 'Ca', dataIndex: 'ca', width: 70 },
    {
      title: 'Giờ',
      width: 100,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.gio_bat_dau || r.gio_ket_thuc
          ? `${r.gio_bat_dau ?? '?'} – ${r.gio_ket_thuc ?? '?'}`
          : '—',
    },
    {
      title: 'SL thực tế',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0).toLocaleString(),
    },
    {
      title: 'Tổng tấm',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) => {
        const total = r.items.reduce((s, it) => s + (it.so_tam ?? 0), 0)
        return total > 0 ? total.toLocaleString() : '—'
      },
    },
    {
      title: 'Phôi lỗi',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0) || '—',
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16 }}>
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>🌊 Máy Sóng — Nhập Phôi & In Tem</Title>
        <Space>
          <Select
            placeholder="Tất cả xưởng"
            allowClear
            style={{ width: 160 }}
            value={filterPxId}
            onChange={v => setFilterPxId(v)}
            options={pxList.map(px => ({ value: px.id, label: px.ten_xuong }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
        </Space>
      </Row>

      {/* Bộ 9: Filter tab trạng thái */}
      <Segmented
        options={filterOptionsWithCount}
        value={filterTrangThai}
        onChange={v => setFilterTrangThai(v as TrangThaiFilter)}
        style={{ marginBottom: 12 }}
      />

      <Table
        dataSource={lsxItems}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'Không có lệnh SX nào' }}
        rowClassName={(r) => r.trang_thai === 'tam_dung' ? 'row-tam-dung' : ''}
      />

      {/* ── Modal Nhập Phôi ── */}
      <Modal
        title={`Nhập phôi — ${fullOrder?.so_lenh ?? '...'}`}
        open={nhapLsxId !== null}
        onCancel={() => { setNhapLsxId(null); nhapForm.resetFields() }}
        onOk={() => nhapForm.submit()}
        okText="Lưu & In tem"
        confirmLoading={createPhieu.isPending}
        width={660}
        destroyOnHidden
      >
        {orderLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin size="large" /></div>
        ) : (
          <Form form={nhapForm} layout="vertical" onFinish={handleNhapSubmit} size="large">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="ca" label="Ca" rules={[{ required: true, message: 'Chọn ca' }]}>
                  <Select options={['Ca 1', 'Ca 2', 'Ca 3', 'Ca đêm'].map(c => ({ value: c, label: c }))} />
                </Form.Item>
              </Col>
              {/* Bước 3: dùng initialValue thay defaultValue để form luôn có giá trị */}
              <Col span={8}>
                <Form.Item name="ngay" label="Ngày" initialValue={dayjs()}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="gio_bat_dau" label="Giờ BĐ">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="gio_ket_thuc" label="Giờ KT">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {fullOrder?.items.map((oi, idx) => (
              <Card
                key={oi.id}
                size="small"
                style={{ marginBottom: 8, background: '#fafafa' }}
                title={<Text strong>{oi.ten_hang}</Text>}
                extra={<Text type="secondary">KH: {oi.so_luong_ke_hoach} {oi.dvt}</Text>}
              >
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'so_luong_thuc_te']}
                      label="SL thực tế"
                      rules={[{ required: true, message: 'Nhập SL' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} style={{ width: '100%', fontSize: 18 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'so_luong_loi']}
                      label="Phôi lỗi"
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['items', idx, 'chieu_kho']}
                      label="Khổ TT (cm)"
                      initialValue={getKhoMm(oi) != null ? getKhoMm(oi)! / 10 : null}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['items', idx, 'chieu_cat']}
                      label="Cắt TT (cm)"
                      initialValue={getCatMm(oi) != null ? getCatMm(oi)! / 10 : null}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  {/* Bước 1: So tấm — auto-compute từ SL thực tế, editable */}
                  <Col span={8}>
                    <Form.Item noStyle shouldUpdate={(prev, cur) =>
                      prev.items?.[idx]?.so_luong_thuc_te !== cur.items?.[idx]?.so_luong_thuc_te
                    }>
                      {({ getFieldValue }) => {
                        const slTT = getFieldValue(['items', idx, 'so_luong_thuc_te']) as number | null
                        const computed = slTT != null ? (calcSoTam(oi, slTT) ?? null) : null
                        return (
                          <Form.Item
                            name={['items', idx, 'so_tam']}
                            label={
                              <span>
                                Số tấm{' '}
                                {computed != null && (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    (tính: {computed.toLocaleString()})
                                  </Text>
                                )}
                              </span>
                            }
                            style={{ marginBottom: 8 }}
                          >
                            <InputNumber
                              min={0}
                              placeholder={computed != null ? String(computed) : 'Tự động'}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}

            <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginTop: 8 }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── Modal Tạm Dừng ── */}
      <Modal
        title={`Tạm dừng — ${pauseTarget?.so_lenh ?? ''}`}
        open={pauseTarget !== null}
        onCancel={() => { setPauseTarget(null); pauseForm.resetFields() }}
        onOk={() => pauseForm.submit()}
        okText="Xác nhận tạm dừng"
        confirmLoading={pauseMutation.isPending}
        width={420}
        destroyOnHidden
      >
        <Form form={pauseForm} layout="vertical" onFinish={handlePauseSubmit}>
          <Form.Item
            name="gio_bat_dau_dung"
            label="Giờ tạm dừng"
            rules={[{ required: true, message: 'Chọn giờ' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do" initialValue="khac" rules={[{ required: true }]}>
            <Select options={LY_DO_OPTIONS} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Lịch Sử Phiếu (Bước 4: hiện so_lenh) ── */}
      <Modal
        title={`Lịch sử nhập phôi — ${historyTarget?.so_lenh ?? ''}`}
        open={historyTarget !== null}
        onCancel={() => setHistoryTarget(null)}
        footer={<Button onClick={() => setHistoryTarget(null)}>Đóng</Button>}
        width={820}
        destroyOnHidden
      >
        <Table
          dataSource={historyPhieu}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'Chưa có phiếu nhập nào' }}
        />
      </Modal>

      {/* ── Dialog In Tem (Bước 7: tamPerPallet editable + breakdown) ── */}
      <Modal
        title={`In tem nhận dạng — ${inTemState?.order.so_lenh ?? ''}`}
        open={inTemState !== null}
        onCancel={() => setInTemState(null)}
        footer={[
          <Button key="cancel" onClick={() => setInTemState(null)}>Đóng</Button>,
          <Button
            key="print"
            type="primary"
            size="large"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            In {inTemState?.soPallet ?? 1} tem
          </Button>,
        ]}
        width={440}
        destroyOnHidden
      >
        {inTemState && (
          <>
            <Row style={{ marginBottom: 8 }}>
              <Col span={12}><Text type="secondary">Lệnh SX</Text></Col>
              <Col span={12}><Text strong>{inTemState.order.so_lenh}</Text></Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={12}><Text type="secondary">Khách hàng</Text></Col>
              <Col span={12}><Text>{inTemState.order.ten_khach_hang ?? '—'}</Text></Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={12}><Text type="secondary">Khổ × Cắt</Text></Col>
              <Col span={12}>
                <Text>
                  {mmToDisplayCm(inTemState.khoMm)} × {mmToDisplayCm(inTemState.catMm)} cm
                </Text>
              </Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={12}><Text type="secondary">Tổng số tấm</Text></Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 20 }}>
                  {inTemState.soTam > 0 ? inTemState.soTam.toLocaleString() : '—'} tấm
                </Text>
              </Col>
            </Row>
            {/* Bước 7: tamPerPallet editable */}
            <Row style={{ marginBottom: 4 }} align="middle">
              <Col span={12}><Text type="secondary">Tấm/pallet</Text></Col>
              <Col span={12}>
                <InputNumber
                  min={1}
                  value={inTemState.tamPerPallet}
                  onChange={v => {
                    if (!v) return
                    const newTpp = Math.max(1, v)
                    const newSoPallet = inTemState.soTam > 0
                      ? Math.ceil(inTemState.soTam / newTpp)
                      : 1
                    setInTemState(s => s ? { ...s, tamPerPallet: newTpp, soPallet: newSoPallet } : null)
                  }}
                  style={{ width: '100%' }}
                  addonAfter="tấm"
                />
              </Col>
            </Row>
            {inTemState.soTam > 0 && (
              <Row style={{ marginBottom: 8 }}>
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {inTemState.soTam.toLocaleString()} tấm ÷ {inTemState.tamPerPallet} tấm/pallet
                    {' = '}<Text strong>{inTemState.soPallet} pallet</Text>
                  </Text>
                </Col>
              </Row>
            )}
            {inTemState.phieu === null && (
              <Text type="warning" style={{ display: 'block', marginBottom: 8 }}>
                Chưa có phiếu nhập — tấm/pallet tính theo kích thước kế hoạch
              </Text>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Row align="middle">
              <Col span={14}><Text>Số pallet cần in tem:</Text></Col>
              <Col span={10}>
                <InputNumber
                  min={1}
                  max={99}
                  value={inTemState.soPallet}
                  onChange={v => setInTemState(s => s ? { ...s, soPallet: v ?? 1 } : null)}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </>
        )}
      </Modal>
    </div>
  )
}
