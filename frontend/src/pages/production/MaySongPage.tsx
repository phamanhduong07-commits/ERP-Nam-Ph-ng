import { useState, useCallback } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Progress, Row, Select, Space, Spin, Table, Tag,
  TimePicker, Typography,
} from 'antd'
import { HistoryOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
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

// ─── Pallet constants (mm) ───────────────────────────────────────────────────
const PALLET_W_MM = 1000
const PALLET_L_MM = 1200
const PALLET_H_MM = 2000
const MM_PER_SHEET: Record<number, number> = { 3: 4, 5: 7, 7: 12 }

/**
 * sheets_per_layer = max(floor(W/kho)×floor(L/cat), xoay)
 * layers           = floor(H / mm_per_sheet)
 * tam_per_pallet   = sheets_per_layer × layers
 */
function calcTamPerPallet(soLop: number, khoMm: number | null, catMm: number | null): number {
  const mmSheet = MM_PER_SHEET[soLop] ?? 7
  const layers = Math.floor(PALLET_H_MM / mmSheet)
  if (!khoMm || !catMm || khoMm <= 0 || catMm <= 0) return layers
  const optA = Math.floor(PALLET_W_MM / khoMm) * Math.floor(PALLET_L_MM / catMm)
  const optB = Math.floor(PALLET_W_MM / catMm) * Math.floor(PALLET_L_MM / khoMm)
  return Math.max(optA, optB, 1) * layers
}

// kho_tt trong ProductionOrderItem lưu mm
function getKhoMm(oi: ProductionOrderItem): number | null {
  if (oi.kho_tt != null) return Number(oi.kho_tt)
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.kho_tt ? Math.ceil(dims.kho_tt / 5) * 5 * 10 : null
}

function getCatMm(oi: ProductionOrderItem): number | null {
  if (oi.dai_tt != null) return Number(oi.dai_tt)
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.dai_tt ? Math.round(dims.dai_tt * 10) : null
}

// mm → chuỗi cm hiển thị (450 → "45")
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

// ─── InfoRow — dòng label: value trong panel trái ────────────────────────────
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
}

interface HistoryTarget { id: number; so_lenh: string }

// ─── Component ───────────────────────────────────────────────────────────────
export default function MaySongPage() {
  const [filterPxId, setFilterPxId] = useState<number | undefined>(undefined)
  const [nhapLsxId, setNhapLsxId]   = useState<number | null>(null)
  const [inTemState, setInTemState]  = useState<InTemState | null>(null)
  const [inTemLoading, setInTemLoading] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null)
  const [nhapForm] = Form.useForm()
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

  const { data: lsxRes, isLoading, refetch } = useQuery({
    queryKey: ['may-song-list', filterPxId],
    queryFn: () =>
      productionOrdersApi.list({ page_size: 200, phan_xuong_id: filterPxId }).then(r => r.data),
  })

  // Chỉ hiện lệnh đang hoạt động (không hoàn thành, không huỷ)
  const lsxItems = (lsxRes?.items ?? []).filter(
    o => !['hoan_thanh', 'huy', 'mua_ngoai'].includes(o.trang_thai)
  )

  // LSX đang mở nhập (để lấy tiến độ tổng)
  const currentLsx = lsxItems.find(l => l.id === nhapLsxId) ?? null

  const { data: fullOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['may-song-order', nhapLsxId],
    queryFn: () => productionOrdersApi.get(nhapLsxId!).then(r => r.data),
    enabled: nhapLsxId !== null,
  })

  const { data: historyPhieu = [], isLoading: historyLoading } = useQuery({
    queryKey: ['may-song-history', historyTarget?.id],
    queryFn: () => productionOrdersApi.listPhieu(historyTarget!.id).then(r => r.data),
    enabled: historyTarget !== null,
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const invalidateList = useCallback(
    () => qc.invalidateQueries({ queryKey: ['may-song-list'] }),
    [qc],
  )

  const createPhieu = useMutation({
    mutationFn: (vars: { orderId: number; data: PhieuNhapPhoiSongPayload }) =>
      productionOrdersApi.createPhieu(vars.orderId, vars.data).then(r => r.data),
    onSuccess: (phieu) => {
      message.success('Đã lưu phiếu nhập phôi!')
      invalidateList()
      if (fullOrder) openInTem(fullOrder, phieu)
      setNhapLsxId(null)
      nhapForm.resetFields()
    },
    onError: () => message.error('Lỗi khi lưu phiếu, vui lòng thử lại'),
  })

  // ─── openInTem ─────────────────────────────────────────────────────────────

  const openInTem = (order: ProductionOrder, phieu: PhieuNhapPhoiSong | null) => {
    const oi = order.items[0]
    const soLop = oi?.so_lop ?? oi?.product?.so_lop ?? 5

    const khoMm = phieu?.items[0]?.chieu_kho != null
      ? phieu.items[0].chieu_kho * 10          // cm→mm
      : getKhoMm(oi)
    const catMm = phieu?.items[0]?.chieu_cat != null
      ? phieu.items[0].chieu_cat * 10
      : getCatMm(oi)

    const tamPerPallet = calcTamPerPallet(soLop, khoMm, catMm)

    const soThung = phieu
      ? phieu.items.reduce((s, it) => s + Number(it.so_luong_thuc_te ?? 0), 0)
      : 0

    // so_tam: lấy từ field đã lưu, fallback tính từ so_luong_thuc_te
    const soTam = phieu
      ? phieu.items.reduce((s, it, idx) => {
          if (it.so_tam != null) return s + it.so_tam
          const oi2 = order.items.find(x => x.id === it.production_order_item_id) ?? order.items[idx]
          const computed = oi2 && it.so_luong_thuc_te != null
            ? (calcSoTam(oi2, Number(it.so_luong_thuc_te)) ?? 0)
            : 0
          return s + computed
        }, 0)
      : 0

    const soPallet = soTam > 0 ? Math.ceil(soTam / tamPerPallet) : 1
    setInTemState({ order, phieu, soTam, soThung, soPallet, tamPerPallet, khoMm, catMm })
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
      openInTem(orderRes.data, latest)
    } catch {
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setInTemLoading(false)
    }
  }

  const handleNhapSubmit = (values: any) => {
    if (!fullOrder) return
    const ngay = (values.ngay as dayjs.Dayjs)?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD')
    const items: PhieuNhapPhoiSongPayload['items'] = fullOrder.items.map((oi, idx) => {
      const slTT: number | null    = values.items?.[idx]?.so_luong_thuc_te ?? null
      const khoCm: number | null   = values.items?.[idx]?.chieu_kho ?? null
      const catCm: number | null   = values.items?.[idx]?.chieu_cat ?? null
      const soTamManual             = values.items?.[idx]?.so_tam ?? null
      const soTamComputed           = slTT != null ? (calcSoTam(oi, slTT) ?? null) : null
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
        gio_bat_dau:  values.gio_bat_dau  ? (values.gio_bat_dau  as dayjs.Dayjs).format('HH:mm') : null,
        gio_ket_thuc: values.gio_ket_thuc ? (values.gio_ket_thuc as dayjs.Dayjs).format('HH:mm') : null,
        items,
      },
    })
  }

  const handlePrint = async () => {
    if (!inTemState) return
    const { order, soTam, soThung, soPallet, khoMm, catMm } = inTemState
    const oi = order.items[0]
    const khoCmStr = khoMm != null ? mmToDisplayCm(khoMm) : '?'
    const catCmStr = catMm != null ? mmToDisplayCm(catMm) : '?'
    const tagData = {
      so_lenh:          order.so_lenh,
      ten_khach_hang:   order.ten_khach_hang ?? '',
      so_don_hang:      order.so_don ?? '',
      so_po_kh:         order.so_po_kh ?? '',
      loai_sp:          oi?.loai_thung ?? '',
      song:             oi?.to_hop_song ?? '',
      phan_xuong:       order.ten_phan_xuong ?? 'Nam Phương',
      qccl:             oi?.qccl ?? '',
      ngay_chay_song:   order.ngay_bat_dau_ke_hoach ?? '',
      ngay_giao_cu_chi: oi?.ngay_giao_hang ?? '',
      ngay_giao_kh:     order.ngay_hoan_thanh_ke_hoach ?? '',
      cong_doan:        oi?.cong_doan ?? '',
      ten_san_pham:     oi?.ten_hang ?? '',
      sl_tam_lon: soTam > 0
        ? `${khoCmStr} × ${catCmStr} cm | ${soTam.toLocaleString()} tấm | ${soPallet} pallet`
        : `${khoCmStr} × ${catCmStr} cm`,
      sl_tam_nho: '',
      sl_thung: soThung > 0
        ? `${soThung.toLocaleString()} ${oi?.dvt ?? 'thùng'}`
        : `${oi?.so_luong_ke_hoach ?? ''} ${oi?.dvt ?? 'thùng'}`,
      can_mang:   oi?.loai_in ? 'Có' : 'Không',
      chong_tham: 'Không',
      bo_phan:    'Máy Sóng',
      ghi_chu:    order.ghi_chu ?? '',
    }
    await printProductionTagBatch(tagData, soPallet)
    setInTemState(null)
  }

  // ─── History columns ───────────────────────────────────────────────────────

  const historyColumns: ColumnsType<PhieuNhapPhoiSong> = [
    { title: 'Số phiếu',  dataIndex: 'so_phieu', width: 155 },
    { title: 'Ngày',      dataIndex: 'ngay',      width: 100 },
    { title: 'Ca',        dataIndex: 'ca',         width: 70  },
    {
      title: 'Giờ',
      width: 105,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.gio_bat_dau || r.gio_ket_thuc
          ? `${r.gio_bat_dau ?? '?'} – ${r.gio_ket_thuc ?? '?'}`
          : '—',
    },
    {
      title: 'SL thực tế',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + Number(it.so_luong_thuc_te ?? 0), 0).toLocaleString(),
    },
    {
      title: 'Tổng tấm',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) => {
        const t = r.items.reduce((s, it) => s + (it.so_tam ?? 0), 0)
        return t > 0 ? t.toLocaleString() : '—'
      },
    },
    {
      title: 'Phôi lỗi',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + Number(it.so_luong_loi ?? 0), 0) || '—',
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
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

      {/* Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : lsxItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 16 }}>
          Không có lệnh SX đang hoạt động
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {lsxItems.map(lsx => {
            const kh     = Number(lsx.tong_sl_ke_hoach)
            const tt     = Number(lsx.tong_sl_thuc_te)
            const percent = kh > 0 ? Math.min(100, Math.round(tt / kh * 100)) : 0
            const conLai  = kh - tt

            return (
              <Col xs={24} sm={12} xl={8} key={lsx.id}>
                <Card
                  size="small"
                  style={{ height: '100%' }}
                  styles={{ body: { padding: 14, display: 'flex', flexDirection: 'column', height: '100%' } }}
                >
                  {/* Trạng thái + mã lệnh */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                    <Tag color={TRANG_THAI_COLORS[lsx.trang_thai]} style={{ margin: 0 }}>
                      {TRANG_THAI_LABELS[lsx.trang_thai] ?? lsx.trang_thai}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{lsx.so_lenh}</Text>
                  </div>

                  {/* Tên hàng + khách */}
                  <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 2, lineHeight: 1.3 }}>
                    {lsx.ten_hang ?? '—'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                    {lsx.ten_khach_hang ?? '—'}
                  </Text>

                  {/* Thông số kỹ thuật */}
                  <Space size={4} wrap style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 13 }}>
                      {mmToDisplayCm(lsx.kho_tt)} × {mmToDisplayCm(lsx.dai_tt)} cm
                    </Text>
                    {lsx.so_lop && (
                      <Tag style={{ marginInlineStart: 0 }}>{lsx.so_lop}L</Tag>
                    )}
                    {lsx.to_hop_song && (
                      <Tag style={{ marginInlineStart: 0 }}>{lsx.to_hop_song}</Tag>
                    )}
                    {lsx.ngay_hoan_thanh_ke_hoach && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Giao {dayjs(lsx.ngay_hoan_thanh_ke_hoach).format('DD/MM')}
                      </Text>
                    )}
                  </Space>

                  {/* Tiến độ — flex grow */}
                  <div style={{ flex: 1, marginBottom: 12 }}>
                    {tt > 0 ? (
                      <>
                        <Progress
                          percent={percent}
                          size="small"
                          status={conLai <= 0 ? 'success' : 'active'}
                          format={() => `${tt.toLocaleString()} / ${kh.toLocaleString()}`}
                          style={{ marginBottom: 4 }}
                        />
                        {conLai > 0 ? (
                          <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                            Còn lại: {conLai.toLocaleString()} thùng
                          </Text>
                        ) : (
                          <Tag color="green" style={{ fontWeight: 700, fontSize: 13 }}>
                            Đã nhập đủ ✓
                          </Tag>
                        )}
                      </>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Chưa nhập — KH: <b>{kh.toLocaleString()}</b> thùng
                      </Text>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      type="primary"
                      style={{ flex: 2, fontWeight: 600 }}
                      onClick={() => setNhapLsxId(lsx.id)}
                    >
                      Nhập phôi
                    </Button>
                    <Button
                      icon={<PrinterOutlined />}
                      style={{ flex: 1 }}
                      loading={inTemLoading}
                      title="In tem"
                      onClick={() => handleInTemBo(lsx)}
                    >
                      In tem
                    </Button>
                    <Button
                      icon={<HistoryOutlined />}
                      style={{ flex: 1 }}
                      title="Lịch sử"
                      onClick={() => setHistoryTarget({ id: lsx.id, so_lenh: lsx.so_lenh })}
                    />
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Modal: Nhập Phôi — 2 cột (Thông tin LSX | Form nhập)
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        title={`Nhập phôi — ${fullOrder?.so_lenh ?? '...'}`}
        open={nhapLsxId !== null}
        onCancel={() => { setNhapLsxId(null); nhapForm.resetFields() }}
        onOk={() => nhapForm.submit()}
        okText="Lưu & Kiểm tra ▶"
        confirmLoading={createPhieu.isPending}
        width={900}
        destroyOnHidden
      >
        {orderLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin size="large" /></div>
        ) : fullOrder ? (
          <Row gutter={24}>

            {/* ── LEFT: Thông tin lệnh SX ── */}
            <Col span={9} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
              <Text style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#999' }}>
                Thông tin lệnh SX
              </Text>
              <Divider style={{ margin: '6px 0 10px' }} />

              <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8, lineHeight: 1.3 }}>
                {fullOrder.items[0]?.ten_hang ?? '—'}
              </Text>

              <InfoRow label="Lệnh SX"    value={<Text strong>{fullOrder.so_lenh}</Text>} />
              <InfoRow label="Khách hàng" value={fullOrder.ten_khach_hang} />
              {fullOrder.so_don && <InfoRow label="Số đơn" value={fullOrder.so_don} />}

              <Divider style={{ margin: '8px 0' }} />

              {(() => {
                const oi = fullOrder.items[0]
                const khoMm = getKhoMm(oi)
                const catMm = getCatMm(oi)
                return (
                  <>
                    {oi.dai && oi.rong && oi.cao && (
                      <InfoRow label="D × R × C" value={`${oi.dai} × ${oi.rong} × ${oi.cao} cm`} />
                    )}
                    {oi.loai_thung && <InfoRow label="Loại thùng" value={oi.loai_thung} />}
                    <InfoRow
                      label="Khổ × Cắt"
                      value={`${mmToDisplayCm(khoMm)} × ${mmToDisplayCm(catMm)} cm`}
                      valueStyle={{ fontWeight: 700, fontSize: 14 }}
                    />
                    {oi.so_lop    && <InfoRow label="Số lớp"     value={`${oi.so_lop} lớp`} />}
                    {oi.to_hop_song && <InfoRow label="Tổ hợp sóng" value={oi.to_hop_song} />}
                    {oi.qccl      && <InfoRow label="QCCL"       value={oi.qccl} />}
                    {oi.cong_doan && <InfoRow label="Công đoạn"  value={oi.cong_doan} />}
                    {oi.ngay_giao_hang && (
                      <InfoRow
                        label="Ngày giao KH"
                        value={oi.ngay_giao_hang}
                        valueStyle={{ color: '#d4380d', fontWeight: 600 }}
                      />
                    )}
                  </>
                )
              })()}

              <Divider style={{ margin: '8px 0' }} />

              {(() => {
                const kh     = Number(currentLsx?.tong_sl_ke_hoach ?? fullOrder.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0))
                const tt     = Number(currentLsx?.tong_sl_thuc_te ?? 0)
                const conLai = kh - tt
                return (
                  <>
                    <InfoRow label="Kế hoạch" value={`${kh.toLocaleString()} thùng`} />
                    {tt > 0 && <InfoRow label="Đã nhập" value={`${tt.toLocaleString()} thùng`} />}
                    {conLai > 0 ? (
                      <InfoRow
                        label="Còn lại"
                        value={`${conLai.toLocaleString()} thùng`}
                        valueStyle={{ color: '#cf1322', fontWeight: 700, fontSize: 14 }}
                      />
                    ) : tt > 0 ? (
                      <InfoRow label="Tiến độ" value={<Tag color="green">Đã nhập đủ ✓</Tag>} />
                    ) : null}
                  </>
                )
              })()}
            </Col>

            {/* ── RIGHT: Form nhập ── */}
            <Col span={15}>
              <Form form={nhapForm} layout="vertical" onFinish={handleNhapSubmit} size="middle">
                <Row gutter={10}>
                  <Col span={6}>
                    <Form.Item name="ca" label="Ca" rules={[{ required: true, message: 'Chọn ca' }]}>
                      <Select options={['Ca 1','Ca 2','Ca 3','Ca đêm'].map(c => ({ value: c, label: c }))} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item name="ngay" label="Ngày" initialValue={dayjs()}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={5}>
                    <Form.Item name="gio_bat_dau" label="Giờ BĐ">
                      <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="gio_ket_thuc" label="Giờ KT">
                      <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                {fullOrder.items.map((oi, idx) => (
                  <Card
                    key={oi.id}
                    size="small"
                    style={{ marginBottom: 8, background: '#fafafa' }}
                    title={fullOrder.items.length > 1
                      ? <Text style={{ fontSize: 13 }}>{oi.ten_hang}</Text>
                      : null
                    }
                  >
                    <Row gutter={10}>
                      {/* SL thực tế — ô to nhất */}
                      <Col span={12}>
                        <Form.Item
                          name={['items', idx, 'so_luong_thuc_te']}
                          label="SL thực tế (thùng)"
                          rules={[{ required: true, message: 'Nhập SL' }]}
                          style={{ marginBottom: 8 }}
                        >
                          <InputNumber
                            min={0}
                            style={{ width: '100%', fontSize: 22, fontWeight: 700 }}
                            size="large"
                          />
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
                      {/* Số tấm — auto-compute + editable */}
                      <Col span={8}>
                        <Form.Item noStyle shouldUpdate={(prev, cur) =>
                          prev.items?.[idx]?.so_luong_thuc_te !== cur.items?.[idx]?.so_luong_thuc_te
                        }>
                          {({ getFieldValue }) => {
                            const slTT    = getFieldValue(['items', idx, 'so_luong_thuc_te']) as number | null
                            const computed = slTT != null ? (calcSoTam(oi, slTT) ?? null) : null
                            return (
                              <Form.Item
                                name={['items', idx, 'so_tam']}
                                label={
                                  <span>
                                    Số tấm
                                    {computed != null && (
                                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                                        (≈{computed.toLocaleString()})
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

                <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Form>
            </Col>
          </Row>
        ) : null}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          Modal: Kiểm tra & In tem — xem trước đầy đủ trước khi in
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        title={`Kiểm tra & In tem — ${inTemState?.order.so_lenh ?? ''}`}
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
        width={540}
        destroyOnHidden
      >
        {inTemState && (() => {
          const { order, soTam, soThung, tamPerPallet, khoMm, catMm } = inTemState
          const oi        = order.items[0]
          const khoCmStr  = khoMm != null ? mmToDisplayCm(khoMm) : '?'
          const catCmStr  = catMm != null ? mmToDisplayCm(catMm) : '?'

          return (
            <>
              {/* ── Preview: thông tin sẽ in trên tem ── */}
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
                    <div><Text style={{ fontSize: 12 }}>{oi?.qccl ?? '—'}</Text></div>
                  </Col>
                </Row>

                {/* 3 ô số liệu chính — nổi bật, thợ đối chiếu trực tiếp */}
                <Row gutter={8} style={{ marginBottom: 10 }}>
                  <Col span={8}>
                    <div style={{
                      border: '2px solid #1677ff', borderRadius: 6,
                      textAlign: 'center', padding: '8px 4px', background: '#e6f4ff',
                    }}>
                      <div style={{ fontSize: 10, color: '#1677ff', fontWeight: 600, marginBottom: 2 }}>KHỔ × CẮT</div>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                        {khoCmStr} × {catCmStr}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>cm</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{
                      border: '2px solid #722ed1', borderRadius: 6,
                      textAlign: 'center', padding: '8px 4px', background: '#f9f0ff',
                    }}>
                      <div style={{ fontSize: 10, color: '#722ed1', fontWeight: 600, marginBottom: 2 }}>SỐ TẤM</div>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                        {soTam > 0 ? soTam.toLocaleString() : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>tấm</div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{
                      border: '2px solid #52c41a', borderRadius: 6,
                      textAlign: 'center', padding: '8px 4px', background: '#f6ffed',
                    }}>
                      <div style={{ fontSize: 10, color: '#52c41a', fontWeight: 600, marginBottom: 2 }}>SỐ THÙNG</div>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                        {soThung > 0 ? soThung.toLocaleString() : '—'}
                      </div>
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

              {/* ── Thiết lập pallet ── */}
              <Divider style={{ margin: '10px 0' }} />
              <Row align="middle" gutter={12} style={{ marginBottom: 6 }}>
                <Col span={12}><Text>Tấm / pallet:</Text></Col>
                <Col span={12}>
                  <InputNumber
                    min={1}
                    value={tamPerPallet}
                    onChange={v => {
                      if (!v) return
                      const newTpp = Math.max(1, v)
                      setInTemState(s => s
                        ? { ...s, tamPerPallet: newTpp, soPallet: s.soTam > 0 ? Math.ceil(s.soTam / newTpp) : 1 }
                        : null)
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
          )
        })()}
      </Modal>

      {/* ── Modal Lịch Sử ── */}
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
    </div>
  )
}
