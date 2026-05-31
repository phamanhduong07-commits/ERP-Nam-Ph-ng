import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Popconfirm, Progress, Row, Segmented, Select, Space, Spin, Table, Tabs, Tag,
  TimePicker, Tooltip, Typography,
} from 'antd'
import { CaretRightOutlined, CopyOutlined, PauseOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
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
import { printProductionTagBatch, exportExcelWithTemplate } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"

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
  const soLanCat = oi.so_lan_cat ?? 1
  if (oi.dai_tt != null) return Number(oi.dai_tt) * 10 * soLanCat
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.dai_tt ? Math.round(dims.dai_tt * 10) * soLanCat : null
}

// mm → chuỗi cm hiển thị
function mmToDisplayCm(mm: number | null | undefined): string {
  if (mm == null) return '?'
  return (mm / 10).toFixed(1).replace(/\.0$/, '')
}

// Tính số dao thực tế từ kho_tt đã lưu (operator chỉnh) hoặc fallback dims
function calcSoDaoThucTe(dims: ReturnType<typeof calcBoxDimensions>, khoTtSaved: number | null | undefined): number {
  if (!dims) return 1
  const khoTt = khoTtSaved ? Number(khoTtSaved) : dims.kho_tt
  return dims.kho_ke_hoach > 0
    ? Math.max(1, Math.floor((khoTt - 1.8) / dims.kho_ke_hoach))
    : Math.max(1, dims.so_dao)
}

// Số PHÔI (tấm lớn từ máy sóng): ceil(soThung / (so_dao × so_lan_cat)) × 2 khi hai_manh
function calcSoTam(oi: ProductionOrderItem, soThung: number): number | null {
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  if (!dims) return null
  const so_dao   = calcSoDaoThucTe(dims, oi.kho_tt)
  const soLanCat = oi.so_lan_cat ?? 1
  // hai_manh: chạy 2 đợt riêng (mảnh 1 và mảnh 2)
  return Math.ceil(soThung / (so_dao * soLanCat)) * (dims.hai_manh ? 2 : 1)
}

// Tính số phôi từ list item — ưu tiên TT, fallback KH khi chưa nhập phiếu
function calcSoTamFromListItem(lsx: ProductionOrderListItem): number | null {
  const qty = Number(lsx.tong_sl_thuc_te) > 0
    ? Number(lsx.tong_sl_thuc_te)
    : Number(lsx.tong_sl_ke_hoach)
  if (qty === 0) return null
  if (!lsx.loai_thung || !lsx.dai || !lsx.rong || !lsx.cao) return qty
  const soLop = lsx.so_lop ?? 5
  const dims = calcBoxDimensions(lsx.loai_thung, Number(lsx.dai), Number(lsx.rong), Number(lsx.cao), soLop)
  if (!dims) return qty
  const so_dao   = calcSoDaoThucTe(dims, lsx.kho_tt)
  const soLanCat = lsx.so_lan_cat ?? 1
  return Math.ceil(qty / (so_dao * soLanCat)) * (dims.hai_manh ? 2 : 1)
}

// Detect ca làm việc từ giờ hiện tại
function detectCa(): string {
  const h = dayjs().hour()
  if (h >= 6 && h < 14) return 'Ca 1'
  if (h >= 14 && h < 22) return 'Ca 2'
  return 'Ca đêm'
}

function detectGioBD(ca: string): dayjs.Dayjs {
  const starts: Record<string, number> = { 'Ca 1': 6, 'Ca 2': 14, 'Ca 3': 22, 'Ca đêm': 22 }
  return dayjs().hour(starts[ca] ?? 6).minute(0).second(0).millisecond(0)
}

const STATUS_ORDER: Record<string, number> = { dang_chay: 0, tam_dung: 1, moi: 2, hoan_thanh: 3 }

// m² TÍNH LƯƠNG SẢN PHẨM (≠ m² nguyên liệu bên phiếu giao hàng)
// Công thức: khổ(cm) × cắt(cm) × SL × hệ_số / 10000
// Hệ số theo số lớp: 3L=1 | 5L=2 | 7L=3  (số mặt tấm phôi qua máy sóng)
function calcSoM2Luong(khoCm: number | null, catCm: number | null, soLuong: number, soLop: number | null): number | null {
  if (!khoCm || !catCm || soLuong <= 0) return null
  const heSo = soLop === 7 ? 3 : soLop === 5 ? 2 : 1
  return Math.round(khoCm * catCm * soLuong * heSo / 10000 * 100) / 100
}

// kg lỗi = số tấm lỗi × diện tích/tấm(m²) × tổng định lượng(g/m²) / 1000
// Tổng định lượng lấy từ kế hoạch SX: mat_dl + song_1_dl + mat_1_dl + ...
function calcKgLoi(
  khoCm: number | null, catCm: number | null, soLuongLoi: number | null,
  matDl: number | null, song1Dl: number | null, mat1Dl: number | null,
  song2Dl: number | null, mat2Dl: number | null, song3Dl: number | null, mat3Dl: number | null,
): number | null {
  if (!khoCm || !catCm || !soLuongLoi || soLuongLoi <= 0) return null
  const tongDl = (matDl ?? 0) + (song1Dl ?? 0) + (mat1Dl ?? 0)
              + (song2Dl ?? 0) + (mat2Dl ?? 0) + (song3Dl ?? 0) + (mat3Dl ?? 0)
  if (tongDl <= 0) return null
  return Math.round(khoCm * catCm / 10000 * tongDl / 1000 * soLuongLoi * 100) / 100
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
  ke_hoach_cong_doan: string
  ke_hoach_can_man: string | null
  ke_hoach_c_tham: string | null
}

interface StatusTarget { id: number; so_lenh: string }

// ─── Modal: Tạm dừng ─────────────────────────────────────────────────────────
interface ModalTamDungProps {
  target: StatusTarget | null
  loading: boolean
  onClose: () => void
  onSubmit: (id: number, data: PauseOrderPayload) => void
}
function ModalTamDung({ target, loading, onClose, onSubmit }: ModalTamDungProps) {
  const [form] = Form.useForm()
  return (
    <Modal
      title={`Tạm dừng — ${target?.so_lenh ?? ''}`}
      open={target !== null}
      onCancel={() => { onClose(); form.resetFields() }}
      onOk={() => form.submit()}
      okText="⏸ Tạm dừng"
      okButtonProps={{ danger: true }}
      confirmLoading={loading}
      destroyOnHidden
      width={420}
    >
      <Form form={form} layout="vertical"
        onFinish={(values) => {
          if (!target) return
          onSubmit(target.id, {
            gio_bat_dau_dung: (values.gio_bat_dau_dung as dayjs.Dayjs).format('HH:mm'),
            ly_do: values.ly_do as string,
            ghi_chu: (values.ghi_chu as string | null) ?? null,
          })
        }}
      >
        <Form.Item name="gio_bat_dau_dung" label="Giờ dừng"
          rules={[{ required: true, message: 'Nhập giờ dừng' }]}
          initialValue={dayjs()}
        >
          <TimePicker format="HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Chọn nhanh:</Text>
          <Space wrap size={4}>
            {['Hết giấy', 'Sửa máy', 'Nghỉ cơm', 'Đổi ca'].map(reason => (
              <Button key={reason} size="small" onClick={() => form.setFieldValue('ly_do', reason)}>
                {reason}
              </Button>
            ))}
          </Space>
        </div>
        <Form.Item name="ly_do" label="Lý do dừng" rules={[{ required: true, message: 'Nhập lý do' }]}>
          <Input placeholder="VD: Hết giấy, Sửa máy, Nghỉ cơm..." />
        </Form.Item>
        <Form.Item name="ghi_chu" label="Ghi chú (tuỳ chọn)">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ─── Modal: Hoàn thành ────────────────────────────────────────────────────────
interface ModalHoanThanhProps {
  orderId: number | null
  order: ProductionOrder | null
  orderLoading: boolean
  planLine: PlanLineResponse | null
  submitting: boolean
  onClose: () => void
  onSubmit: (orderId: number, data: PhieuNhapPhoiSongPayload) => void
}
// Tính ngược: từ số phôi → số thùng
function tamToThung(soTam: number, oi: ProductionOrderItem, planSoDao: number | null): number {
  const soDao = planSoDao ?? (() => {
    if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return 1
    const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
    const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
    return dims ? calcSoDaoThucTe(dims, oi.kho_tt) : 1
  })()
  const soLanCat = oi.so_lan_cat ?? 1
  const haiManh = (() => {
    if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return false
    const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
    const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
    return dims?.hai_manh ?? false
  })()
  return Math.floor((haiManh ? soTam / 2 : soTam) * soDao * soLanCat)
}

// Lấy các thông số dao để tính số con (dùng chung nhiều chỗ)
function getDaoParams(oi: ProductionOrderItem, planSoDao: number | null) {
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = (oi.loai_thung && oi.dai && oi.rong && oi.cao)
    ? calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
    : null
  const soDaoTotal  = planSoDao ?? (dims ? calcSoDaoThucTe(dims, oi.kho_tt) : 1)
  const beConBe     = oi.be_so_con && oi.be_so_con > 1 ? oi.be_so_con : 1
  const soDaoGroups = Math.max(1, Math.round(soDaoTotal / beConBe))
  const haiManh     = dims?.hai_manh ?? false
  return { soDaoTotal, soDaoGroups, haiManh }
}

// soTam → số con
function calcSoCon(soTam: number, oi: ProductionOrderItem, planSoDao: number | null): number {
  const { soDaoGroups, haiManh } = getDaoParams(oi, planSoDao)
  const soPhoi = haiManh ? Math.ceil(soTam / 2) : soTam
  return soPhoi * soDaoGroups
}

// số con → số thùng
function conToThung(soCon: number, oi: ProductionOrderItem, planSoDao: number | null): number {
  const { soDaoTotal, soDaoGroups, haiManh } = getDaoParams(oi, planSoDao)
  if (soDaoGroups === 0) return 0
  const soPhoi  = Math.floor(soCon / soDaoGroups)
  const soTam   = haiManh ? soPhoi * 2 : soPhoi
  const soLanCat = oi.so_lan_cat ?? 1
  return Math.floor(soTam * soDaoTotal * soLanCat / (haiManh ? 2 : 1))
}

function ModalHoanThanh({ orderId, order, orderLoading, planLine, submitting, onClose, onSubmit }: ModalHoanThanhProps) {
  const [form] = Form.useForm()
  const slTTWatch = Form.useWatch<number>('so_luong_thuc_te', form)
  return (
    <Modal
      title={`Hoàn thành — ${order?.so_lenh ?? '...'}`}
      open={orderId !== null}
      onCancel={() => { onClose(); form.resetFields() }}
      onOk={() => form.submit()}
      okText="✓ Hoàn thành"
      okButtonProps={{ type: 'primary' }}
      confirmLoading={submitting}
      width={480}
      destroyOnHidden
    >
      {orderLoading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin size="large" /></div>
      ) : order ? (
        <>
          <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
            <Text strong style={{ fontSize: 14 }}>{order.items[0]?.ten_hang ?? '—'}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                KH: {order.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0).toLocaleString()} thùng
                {planLine?.kho1 ? ` | Khổ: ${planLine.kho1} cm` : ''}
                {planLine?.dai_tt ? ` | Cắt: ${Number(planLine.dai_tt) * (planLine.so_lan_cat ?? 1)} cm${(planLine.so_lan_cat ?? 1) > 1 ? ` (×${planLine.so_lan_cat}xếp)` : ''}` : ''}
                {planLine?.qccl ? ` | ${planLine.qccl}` : ''}
              </Text>
            </div>
          </div>
          <Form form={form} layout="vertical" size="middle"
            onFinish={(values) => {
              if (!order || !orderId) return
              const oi = order.items[0]
              const khoCm = planLine?.kho1 ?? (getKhoMm(oi) != null ? getKhoMm(oi)! / 10 : null)
              const catCm = planLine?.dai_tt ?? (getCatMm(oi) != null ? getCatMm(oi)! / 10 : null)
              const soDao = planLine?.so_dao ?? null
              const slTT = values.so_luong_thuc_te as number
              const soTam = (values.so_tam_thuc_te as number | null) ?? (soDao != null ? Math.ceil(slTT / soDao) : (calcSoTam(oi, slTT) ?? null))
              onSubmit(orderId, {
                ngay: (values.ngay as dayjs.Dayjs)?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'),
                ca: values.ca as string,
                ghi_chu: (values.ghi_chu as string | null) ?? null,
                gio_bat_dau: values.gio_bat_dau ? (values.gio_bat_dau as dayjs.Dayjs).format('HH:mm') : null,
                gio_ket_thuc: values.gio_ket_thuc ? (values.gio_ket_thuc as dayjs.Dayjs).format('HH:mm') : null,
                items: order.items.map((orderItem, idx) => ({
                  production_order_item_id: orderItem.id,
                  so_luong_ke_hoach: Number(orderItem.so_luong_ke_hoach),
                  so_luong_thuc_te: idx === 0 ? slTT : 0,
                  so_luong_loi: idx === 0 ? ((values.so_luong_loi as number | null) ?? null) : null,
                  chieu_kho: idx === 0 ? khoCm : null,
                  chieu_cat: idx === 0 ? catCm : null,
                  so_tam: idx === 0 ? soTam : null,
                })),
              })
            }}
          >
            <Row gutter={10}>
              <Col span={6}>
                <Form.Item name="ngay" label="Ngày" initialValue={dayjs()}>
                  <DatePicker style={{ width: '100%' }} format="DD/MM" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="ca" label="Ca" initialValue={detectCa()} rules={[{ required: true, message: 'Chọn ca' }]}>
                  <Select
                    options={['Ca 1', 'Ca 2', 'Ca 3', 'Ca đêm'].map(c => ({ value: c, label: c }))}
                    onChange={(v: string) => form.setFieldValue('gio_bat_dau', detectGioBD(v))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="gio_bat_dau" label="Giờ BĐ" initialValue={detectGioBD(detectCa())}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="gio_ket_thuc" label="Giờ KT" initialValue={dayjs()}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            {(() => {
              const slKH  = order.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0)
              const oi0   = order.items[0]
              const soDao = planLine?.so_dao ?? null
              const calcTam = (slTT: number) =>
                soDao != null ? Math.ceil(slTT / soDao) : (calcSoTam(oi0, slTT) ?? 0)
              const initSlTT = slKH
              const initTam  = calcTam(initSlTT)
              const slTT  = slTTWatch ?? 0
              const pct   = slKH > 0 ? Math.min(100, Math.round((slTT / slKH) * 100)) : 0
              return (
                <>
                  <Row gutter={12} align="bottom">
                    <Col span={12}>
                      <Form.Item name="so_luong_thuc_te" label="Số thùng (thực tế)"
                        rules={[{ required: true, message: 'Nhập SL thực tế' }]}
                        initialValue={initSlTT}
                        style={{ marginBottom: 4 }}
                      >
                        <InputNumber
                          min={0} style={{ width: '100%' }} size="large"
                          onChange={(v) => {
                            const slTTNew = Number(v ?? 0)
                            form.setFieldValue('so_tam_thuc_te', slTTNew > 0 ? calcTam(slTTNew) : null)
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="so_tam_thuc_te" label="Số phôi (thực tế)"
                        initialValue={initTam || null}
                        style={{ marginBottom: 4 }}
                      >
                        <InputNumber
                          min={0} style={{ width: '100%' }} size="large"
                          onChange={(v) => {
                            const soTamNew = Number(v ?? 0)
                            if (soTamNew > 0 && oi0) {
                              form.setFieldValue('so_luong_thuc_te', tamToThung(soTamNew, oi0, soDao))
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  {slKH > 0 && (
                    <Progress percent={pct} size="small" style={{ marginBottom: 8 }}
                      strokeColor={pct >= 100 ? '#52c41a' : pct >= 80 ? '#fa8c16' : '#1677ff'}
                      format={p => `${p}% (${slTT.toLocaleString()}/${slKH.toLocaleString()})`}
                    />
                  )}
                </>
              )
            })()}
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
  )
}

// ─── Modal: Kiểm tra & In tem ─────────────────────────────────────────────────
interface ModalInTemProps {
  state: InTemState | null
  onClose: () => void
  onUpdateTamPerPallet: (n: number) => void
  onUpdateSoPallet: (n: number) => void
}
function ModalInTem({ state, onClose, onUpdateTamPerPallet, onUpdateSoPallet }: ModalInTemProps) {
  const [localCongDoan, setLocalCongDoan] = useState(state?.ke_hoach_cong_doan ?? '')
  // sync khi mở modal cho đơn hàng mới (state thay đổi)
  useEffect(() => { setLocalCongDoan(state?.ke_hoach_cong_doan ?? '') }, [state])

  const handlePrint = async () => {
    if (!state) return
    const { order, phieu, soTam, soThung, soPallet, khoMm, catMm, ke_hoach_qccl, ke_hoach_ghi_chu, ke_hoach_can_man, ke_hoach_c_tham } = state
    const oi       = order.items[0]
    const khoCmStr = khoMm != null ? mmToDisplayCm(khoMm) : '?'
    const catCmStr = catMm != null ? mmToDisplayCm(catMm) : '?'
    const dims = oi?.loai_thung && oi?.dai && oi?.rong && oi?.cao
      ? calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), oi.so_lop ?? 3)
      : null
    // so_dao: dùng kho_tt đã lưu để khớp với thực tế máy (SxParamsTab đã chỉnh)
    // calcSoDaoThucTe = tổng vị trí cá thể (dao_groups × be_so_con)
    const soDaoTotal = calcSoDaoThucTe(dims, oi?.kho_tt)
    const beConBe    = oi?.be_so_con && oi.be_so_con > 1 ? oi.be_so_con : 1
    const soDaoGroups = Math.max(1, Math.round(soDaoTotal / beConBe))  // nhóm dao thực tế
    const soLanCat   = oi?.so_lan_cat ?? 1
    // Số con = phôi × nhóm dao (không nhân be_so_con / soLanCat — người dùng yêu cầu)
    const soPhoi    = dims?.hai_manh ? Math.ceil(soTam / 2) : soTam
    const tamNho    = soPhoi > 0 ? soPhoi * soDaoGroups : 0
    const ngaySxMaySong = phieu?.ngay ?? order.ngay_bat_dau_ke_hoach ?? ''
    const loaiLanLabel = oi?.loai_lan === 'lan_bang' ? 'Lằn Bằng'
                       : oi?.loai_lan === 'lan_am_duong' ? 'Lằn Âm Dương'
                       : oi?.loai_lan ? oi.loai_lan : null
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
      cong_doan:        localCongDoan,
      loai_lan:         loaiLanLabel,
      ten_san_pham:     oi?.ten_hang ?? '',
      sl_tam_lon: soTam > 0
        ? `${khoCmStr} × ${catCmStr} cm | ${soTam.toLocaleString()} phôi × ${soDaoGroups} dao${beConBe > 1 ? ` × ${beConBe}con` : ''}${soLanCat > 1 ? ` × ${soLanCat}xếp` : ''}${dims?.hai_manh ? ' (2 mảnh)' : ''} | ${soPallet} pallet`
        : `${khoCmStr} × ${catCmStr} cm`,
      sl_tam_nho: tamNho > 0 ? `${tamNho.toLocaleString()} con` : '',
      sl_thung: soThung > 0
        ? `${soThung.toLocaleString()} ${oi?.dvt ?? 'thùng'}`
        : `${oi?.so_luong_ke_hoach ?? ''} ${oi?.dvt ?? 'thùng'}`,
      can_mang:   ke_hoach_can_man || 'Không',
      chong_tham: ke_hoach_c_tham  || 'Không',
      bo_phan:    'Máy Sóng',
      ghi_chu:    ke_hoach_ghi_chu,
    }, soPallet)
    onClose()
  }
  return (
    <Modal
      title={`Kiểm tra & In tem — ${state?.order.so_lenh ?? ''}`}
      open={state !== null}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Đóng</Button>,
        <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={handlePrint}>
          In {state?.soPallet ?? 1} tem
        </Button>,
      ]}
      width={540}
      destroyOnHidden
    >
      {state && (() => {
        const { order, soTam, soThung, tamPerPallet, khoMm, catMm } = state
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
                  <div><Text style={{ fontSize: 12 }}>{state.ke_hoach_qccl || '—'}</Text></div>
                </Col>
              </Row>
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
                    <div style={{ fontSize: 10, color: '#722ed1', fontWeight: 600, marginBottom: 2 }}>SỐ PHÔI</div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{soTam > 0 ? soTam.toLocaleString() : '—'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>phôi</div>
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
            <Divider style={{ margin: '10px 0' }} />
            <Row align="middle" gutter={12} style={{ marginBottom: 10 }}>
              <Col span={10}><Text>Công đoạn SX:</Text></Col>
              <Col span={14}>
                <Input
                  value={localCongDoan}
                  onChange={e => setLocalCongDoan(e.target.value)}
                  placeholder="VD: Ghim | Dán | Flexo 2 màu"
                  allowClear
                />
              </Col>
            </Row>
            <Row align="middle" gutter={12} style={{ marginBottom: 6 }}>
              <Col span={12}><Text>Tấm / pallet:</Text></Col>
              <Col span={12}>
                <InputNumber
                  min={1} value={tamPerPallet}
                  onChange={v => v && onUpdateTamPerPallet(Math.max(1, v))}
                  addonAfter="tấm" style={{ width: '100%' }}
                />
              </Col>
            </Row>
            {soTam > 0 && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                {soTam.toLocaleString()} tấm ÷ {tamPerPallet} tấm/pallet
                {' = '}<Text strong>{state.soPallet} pallet</Text>
              </Text>
            )}
            <Row align="middle" gutter={12}>
              <Col span={12}><Text strong>Số pallet cần in tem:</Text></Col>
              <Col span={12}>
                <InputNumber min={1} max={99} value={state.soPallet}
                  onChange={v => onUpdateSoPallet(v ?? 1)}
                  size="large" style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </>
        )
      })()}
    </Modal>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MaySongPage() {
  const [activeTab, setActiveTab]       = useState('dang_sx')
  const [filterPxId, setFilterPxId]     = useState<number | undefined>()
  const [filterKhId, setFilterKhId]     = useState<number | undefined>()
  const [searchLenh, setSearchLenh]     = useState('')
  const [searchHang, setSearchHang]     = useState('')
  const [filterStatus, setFilterStatus]  = useState<string>('all')
  const [hoanthanhId, setHoanthanhId]   = useState<number | null>(null)
  const [pauseTarget, setPauseTarget]   = useState<StatusTarget | null>(null)
  const [inTemState, setInTemState]     = useState<InTemState | null>(null)
  const [inTemLoading, setInTemLoading] = useState(false)
  const [histTuNgay, setHistTuNgay]     = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'))
  const [histDenNgay, setHistDenNgay]   = useState(dayjs().format('YYYY-MM-DD'))
  const [histFilterCa, setHistFilterCa]   = useState<string | undefined>()
  const [histSearchLenh, setHistSearchLenh] = useState('')
  const qc = useQueryClient()

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: _allPxList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 60_000,
  })
  const pxList = useMemo(
    () => _allPxList.filter(px => px.cong_doan === 'cd1_cd2'),
    [_allPxList],
  )

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
    refetchIntervalInBackground: false,
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
  const lsxBase = (lsxRes?.items ?? []).filter(o => {
    if (['huy', 'mua_ngoai'].includes(o.trang_thai)) return false
    if (!khSoLenhSet && o.trang_thai === 'hoan_thanh') return false
    if (khSoLenhSet && !khSoLenhSet.has(o.so_lenh)) return false
    if (searchLenh && !o.so_lenh.toLowerCase().includes(searchLenh.toLowerCase())) return false
    if (searchHang && !(o.ten_hang ?? '').toLowerCase().includes(searchHang.toLowerCase())) return false
    return true
  })

  // Stats (tính trước khi apply filter trạng thái)
  const statsMoi        = lsxBase.filter(o => o.trang_thai === 'moi').length
  const statsDangChay   = lsxBase.filter(o => o.trang_thai === 'dang_chay').length
  const statsTamDung    = lsxBase.filter(o => o.trang_thai === 'tam_dung').length
  const statsHoanThanh  = lsxBase.filter(o => o.trang_thai === 'hoan_thanh').length

  const lsxItems = (filterStatus === 'all'
    ? lsxBase
    : lsxBase.filter(o => o.trang_thai === filterStatus)
  ).slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.trang_thai] ?? 9
    const sb = STATUS_ORDER[b.trang_thai] ?? 9
    if (sa !== sb) return sa - sb
    const da = a.ngay_hoan_thanh_ke_hoach ? dayjs(a.ngay_hoan_thanh_ke_hoach).valueOf() : Infinity
    const db = b.ngay_hoan_thanh_ke_hoach ? dayjs(b.ngay_hoan_thanh_ke_hoach).valueOf() : Infinity
    return da - db
  })

  const hasOverdue = lsxBase.some(
    o => o.ngay_hoan_thanh_ke_hoach &&
         dayjs(o.ngay_hoan_thanh_ke_hoach).diff(dayjs(), 'day') < 0 &&
         o.trang_thai !== 'hoan_thanh',
  )

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
        const oi0 = hoanthanhOrder.items[0]
        openInTem(hoanthanhOrder, phieu, planLine?.qccl ?? oi0?.qccl ?? '', planLine?.ghi_chu ?? oi0?.ghi_chu ?? '', planLine?.cong_doan ?? oi0?.cong_doan ?? '', planLine?.can_man ?? null, planLine?.c_tham ?? null)
      }
      completeMut.mutate(vars.orderId)
      setHoanthanhId(null)
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

  const openInTem = (order: ProductionOrder, phieu: PhieuNhapPhoiSong | null, keHoachQccl = '', keHoachGhiChu = '', keHoachCongDoan = '', keHoachCanMan: string | null = null, keHoachCTham: string | null = null) => {
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
    setInTemState({ order, phieu, soTam, soThung, soPallet, tamPerPallet, khoMm, catMm, ke_hoach_qccl: keHoachQccl, ke_hoach_ghi_chu: keHoachGhiChu, ke_hoach_cong_doan: keHoachCongDoan, ke_hoach_can_man: keHoachCanMan, ke_hoach_c_tham: keHoachCTham })
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
      const oi0 = orderRes.data.items[0]
      openInTem(orderRes.data, latest, planLine?.qccl ?? oi0?.qccl ?? '', planLine?.ghi_chu ?? oi0?.ghi_chu ?? '', planLine?.cong_doan ?? oi0?.cong_doan ?? '', planLine?.can_man ?? null, planLine?.c_tham ?? null)
    } catch {
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setInTemLoading(false)
    }
  }

  // ─── Cột bảng Tab 1 ────────────────────────────────────────────────────────

  const columns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Số lệnh',
      width: 145,
      render: (_, r) => (
        <div>
          <Space size={4} align="center">
            <Text strong style={{ fontSize: 13 }}>{r.so_lenh}</Text>
            <CopyOutlined
              style={{ fontSize: 11, color: '#bbb', cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard.writeText(r.so_lenh)
                message.success(`Đã copy: ${r.so_lenh}`, 1.5)
              }}
            />
          </Space>
          {r.so_don && (
            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>ĐH: {r.so_don}</Text>
          )}
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
      render: (_, r) => {
        const dimStr = r.dai && r.rong && r.cao ? `${r.dai}×${r.rong}×${r.cao} cm` : null
        return (
          <Tooltip title={dimStr}>
            <div>
              <Text strong>{r.ten_hang ?? '—'}</Text>
              {r.so_dong > 1 && (
                <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  +{r.so_dong - 1} mã
                </Tag>
              )}
              {r.de_xuat_mua_ngoai && (
                <Tag color="orange" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  ⚠ Mua ngoài
                </Tag>
              )}
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: 'Khách hàng',
      width: 130,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.ten_khach_hang ?? '—'}</Text>,
    },
    {
      title: 'Kho SX',
      width: 100,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.ten_kho_sx ?? '—'}</Text>,
    },
    {
      title: 'Khổ × Cắt',
      width: 105,
      align: 'center',
      render: (_, r) => {
        if (!r.kho_tt && !r.dai_tt) return <Text type="secondary">—</Text>
        const kho = r.kho_tt != null ? Number(r.kho_tt) : '?'
        const soLanCat = r.so_lan_cat ?? 1
        const cat = r.dai_tt != null ? Number(r.dai_tt) * soLanCat : '?'
        return <Text style={{ fontWeight: 600 }}>{kho} × {cat} cm{soLanCat > 1 ? <Text type="warning" style={{ fontSize: 11, marginLeft: 4 }}>×{soLanCat}xếp</Text> : null}</Text>
      },
    },
    {
      title: 'Lớp · Sóng',
      width: 85,
      align: 'center',
      render: (_, r) => [r.so_lop ? `${r.so_lop}L` : null, r.to_hop_song].filter(Boolean).join(' · ') || '—',
    },
    {
      title: 'Số phôi',
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
        const pct = kh > 0 ? Math.min(100, Math.round((tt / kh) * 100)) : 0
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
            {tt > 0 && (
              <Progress percent={pct} size="small" showInfo={false}
                strokeColor={pct >= 100 ? '#52c41a' : '#1677ff'}
                style={{ marginTop: 2, marginBottom: 0 }}
              />
            )}
          </div>
        )
      },
    },
    {
      title: 'Ngày giao',
      width: 90,
      align: 'center',
      render: (_, r) => {
        if (!r.ngay_hoan_thanh_ke_hoach) return <Text type="secondary">—</Text>
        const days = dayjs(r.ngay_hoan_thanh_ke_hoach).startOf('day').diff(dayjs().startOf('day'), 'day')
        return (
          <div>
            <Text style={{ fontSize: 12 }}>{dayjs(r.ngay_hoan_thanh_ke_hoach).format('DD/MM/YY')}</Text>
            <br />
            {days < 0
              ? <Text type="danger" style={{ fontSize: 10 }}>⚠ trễ {-days}n</Text>
              : days === 0
                ? <Text style={{ fontSize: 10, color: '#fa541c', fontWeight: 600 }}>Hôm nay!</Text>
                : days <= 2
                  ? <Text style={{ fontSize: 10, color: '#fa8c16' }}>còn {days}n</Text>
                  : <Text type="secondary" style={{ fontSize: 10 }}>còn {days}n</Text>
            }
          </div>
        )
      },
    },
    {
      title: 'm² lương',
      width: 90,
      align: 'right',
      render: (_, r) => {
        const soTam = calcSoTamFromListItem(r) ?? 0
        const m2 = calcSoM2Luong(r.kho_tt, r.dai_tt, soTam, r.so_lop)
        if (m2 == null) return <Text type="secondary">—</Text>
        return (
          <Tooltip title={`Tính lương: ${r.kho_tt}×${r.dai_tt}cm × ${soTam.toLocaleString()} tấm × hệ số ${r.so_lop === 7 ? 3 : r.so_lop === 5 ? 2 : 1}`}>
            <Text strong style={{ color: '#531dab' }}>{m2.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>
          </Tooltip>
        )
      },
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
              <Popconfirm
                title={`Bắt đầu ${r.so_lenh}?`}
                okText="Bắt đầu"
                cancelText="Huỷ"
                onConfirm={() => handleStart(r)}
              >
                <Button size="small" type="primary" icon={<CaretRightOutlined />}
                  loading={startMut.isPending}>
                  Bắt đầu
                </Button>
              </Popconfirm>
            )}
            {st === 'dang_chay' && (
              <Button size="small" danger icon={<PauseOutlined />}
                loading={pauseMut.isPending}
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
    {
      title: 'Tên hàng',
      width: 160,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) =>
        <Text style={{ fontSize: 12 }}>{r.items[0]?.ten_hang ?? '—'}</Text>,
    },
    {
      title: 'Khổ (cm)',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) =>
        r.items[0]?.chieu_kho != null ? <Text strong>{r.items[0].chieu_kho}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt (cm)',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) =>
        r.items[0]?.chieu_cat != null ? <Text strong>{r.items[0].chieu_cat}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'm² lương',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) => {
        const m2 = r.items.reduce((s, it) =>
          s + (calcSoM2Luong(it.chieu_kho, it.chieu_cat, it.so_tam ?? 0, it.so_lop) ?? 0), 0)
        if (m2 <= 0) return <Text type="secondary">—</Text>
        return (
          <Text strong style={{ color: '#531dab' }}>{m2.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>
        )
      },
    },
    { title: 'Kho',        dataIndex: 'ten_kho',            width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'Ngày', dataIndex: 'ngay', width: 100, render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
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
      title: 'Số thùng',
      dataIndex: 'tong_so_luong_thuc_te',
      align: 'right',
      width: 90,
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
    {
      title: 'kg lỗi',
      key: 'kg_loi',
      align: 'right',
      width: 80,
      render: (_: unknown, r: PhieuNhapPhoiSongListItem) => {
        const kg = r.items.reduce((s, it) =>
          s + (calcKgLoi(it.chieu_kho, it.chieu_cat, it.so_luong_loi,
            it.mat_dl, it.song_1_dl, it.mat_1_dl,
            it.song_2_dl, it.mat_2_dl, it.song_3_dl, it.mat_3_dl) ?? 0), 0)
        if (kg <= 0) return <Text type="secondary">—</Text>
        return <Text type="danger">{kg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>
      },
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
            label: hasOverdue ? `⚠ Đang sản xuất (${lsxItems.length})` : `Đang sản xuất (${lsxItems.length})`,
            children: (
              <>
                {/* Stats bar */}
                <Row gutter={6} style={{ marginBottom: 10 }}>
                  {[
                    { label: 'Mới',      count: statsMoi,      color: '#1677ff', bg: '#e6f4ff', status: 'moi' },
                    { label: 'Đang SX',  count: statsDangChay, color: '#52c41a', bg: '#f6ffed', status: 'dang_chay' },
                    { label: 'Tạm dừng', count: statsTamDung,  color: '#fa8c16', bg: '#fff7e6', status: 'tam_dung' },
                    ...(statsHoanThanh > 0 ? [{ label: 'Xong', count: statsHoanThanh, color: '#8c8c8c', bg: '#f5f5f5', status: 'hoan_thanh' }] : []),
                  ].map(s => (
                    <Col key={s.label}>
                      <div
                        style={{ padding: '4px 12px', background: s.bg, border: `1px solid ${filterStatus === s.status ? s.color : s.color + '30'}`, borderRadius: 6, textAlign: 'center', minWidth: 72, cursor: 'pointer' }}
                        onClick={() => setFilterStatus(filterStatus === s.status ? 'all' : s.status)}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.count}</div>
                        <div style={{ fontSize: 11, color: s.color }}>{s.label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>

                {/* Filter bar */}
                <Row gutter={8} style={{ marginBottom: 8 }} align="middle" wrap>
                  <Col>
                    <Select
                      placeholder="— Chọn kế hoạch SX —"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      style={{ width: 210 }}
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
                      style={{ width: 140 }}
                      value={searchLenh}
                      onChange={e => setSearchLenh(e.target.value)}
                    />
                  </Col>
                  <Col>
                    <Input
                      placeholder="Tìm tên hàng..."
                      allowClear
                      style={{ width: 150 }}
                      value={searchHang}
                      onChange={e => setSearchHang(e.target.value)}
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
                  {(filterKhId || filterPxId || searchLenh || searchHang || filterStatus !== 'all') && (
                    <Col>
                      <Button danger size="small" onClick={() => {
                        setFilterKhId(undefined)
                        setFilterPxId(undefined)
                        setSearchLenh('')
                        setSearchHang('')
                        setFilterStatus('all')
                      }}>Xóa lọc</Button>
                    </Col>
                  )}
                </Row>

                {/* Filter nhanh theo trạng thái */}
                <Row style={{ marginBottom: 8 }}>
                  <Col>
                    <Segmented
                      value={filterStatus}
                      onChange={v => setFilterStatus(v as string)}
                      size="small"
                      options={[
                        { value: 'all',        label: `Tất cả (${lsxBase.length})` },
                        { value: 'moi',        label: `Mới (${statsMoi})` },
                        { value: 'dang_chay',  label: `Đang SX (${statsDangChay})` },
                        { value: 'tam_dung',   label: `Dừng (${statsTamDung})` },
                        ...(statsHoanThanh > 0 ? [{ value: 'hoan_thanh', label: `Xong (${statsHoanThanh})` }] : []),
                      ]}
                    />
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
                  locale={{ emptyText: <EmptyState size="small" preset={filterKhId ? "search" : "default"} /> }}
                  onRow={(r) => {
                    if (r.trang_thai === 'dang_chay') return { style: { background: '#f6ffed' } }
                    if (!r.ngay_hoan_thanh_ke_hoach) return {}
                    const days = dayjs(r.ngay_hoan_thanh_ke_hoach).diff(dayjs(), 'day')
                    if (days < 0) return { style: { background: '#fff1f0' } }
                    if (days <= 2) return { style: { background: '#fffbe6' } }
                    return {}
                  }}
                />
                {lsxItems.length > 0 && (() => {
                  const totalKH = lsxItems.reduce((s, r) => s + Number(r.tong_sl_ke_hoach), 0)
                  const totalTT = lsxItems.reduce((s, r) => s + Number(r.tong_sl_thuc_te), 0)
                  const totalCon = totalKH - totalTT
                  const totalM2Tab1 = lsxItems.reduce((s, r) => {
                    const soTam = calcSoTamFromListItem(r) ?? 0
                    return s + (calcSoM2Luong(r.kho_tt, r.dai_tt, soTam, r.so_lop) ?? 0)
                  }, 0)
                  return (
                    <div style={{ padding: '6px 12px', background: '#fafafa', border: '1px solid #f0f0f0', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                      <Space size={16}>
                        <Text style={{ fontSize: 12 }}>Tổng <Text strong>{lsxItems.length}</Text> lệnh</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>KH: <Text strong>{totalKH.toLocaleString()}</Text></Text>
                        <Text style={{ fontSize: 12 }}>Nhập: <Text strong>{totalTT.toLocaleString()}</Text></Text>
                        <Text strong style={{ fontSize: 12, color: totalCon > 0 ? '#cf1322' : '#52c41a' }}>
                          {totalCon > 0 ? `Còn: ${totalCon.toLocaleString()}` : 'Đủ SL ✓'}
                        </Text>
                        {totalM2Tab1 > 0 && (
                          <Text style={{ fontSize: 12, color: '#531dab' }}>
                            m² lương: <Text strong style={{ color: '#531dab' }}>{totalM2Tab1.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>
                          </Text>
                        )}
                      </Space>
                    </div>
                  )
                })()}
              </>
            ),
          },

          // ══════════════════════════════════════════════════════════════
          //  TAB 2 — Lịch sử phiếu nhập
          // ══════════════════════════════════════════════════════════════
          {
            key: 'lich_su',
            label: activeTab === 'lich_su' && allPhieu.length > 0
              ? `Lịch sử phiếu nhập (${allPhieu.length})`
              : 'Lịch sử phiếu nhập',
            children: (() => {
              const filteredPhieu = allPhieu
                .filter(p => !histFilterCa || p.ca === histFilterCa)
                .filter(p => {
                  if (!histSearchLenh) return true
                  const term = histSearchLenh.toLowerCase()
                  return (p.so_lenh ?? '').toLowerCase().includes(term)
                      || (p.items[0]?.ten_hang ?? '').toLowerCase().includes(term)
                })
              const totalTT  = filteredPhieu.reduce((s, p) => s + Number(p.tong_so_luong_thuc_te), 0)
              const totalTam = filteredPhieu.reduce((s, p) => s + Number(p.tong_so_tam), 0)
              const totalLoi = filteredPhieu.reduce((s, p) => s + Number(p.tong_so_luong_loi), 0)
              const totalM2Luong = filteredPhieu.reduce((s, p) =>
                s + p.items.reduce((s2, it) =>
                  s2 + (calcSoM2Luong(it.chieu_kho, it.chieu_cat, it.so_tam ?? 0, it.so_lop) ?? 0), 0), 0)
              const totalKgLoi = filteredPhieu.reduce((s, p) =>
                s + p.items.reduce((s2, it) =>
                  s2 + (calcKgLoi(it.chieu_kho, it.chieu_cat, it.so_luong_loi,
                    it.mat_dl, it.song_1_dl, it.mat_1_dl,
                    it.song_2_dl, it.mat_2_dl, it.song_3_dl, it.mat_3_dl) ?? 0), 0), 0)

              // Tiêu thụ giấy: group by (tên giấy + ĐL), tính kg = area × ĐL/1000 × so_tam
              const paperUsage: Record<string, { ten: string; dl: number; kg: number; kg_loi: number }> = {}
              const addPaperLayer = (
                ten: string | null | undefined, dl: number | null | undefined,
                areM2: number, soTam: number, soLoi: number,
              ) => {
                if (!ten || !dl || dl <= 0 || areM2 <= 0) return
                const key = `${ten}__${dl}`
                if (!paperUsage[key]) paperUsage[key] = { ten, dl, kg: 0, kg_loi: 0 }
                const kgPerSheet = areM2 * dl / 1000
                if (soTam > 0) paperUsage[key].kg += kgPerSheet * soTam
                if (soLoi > 0) paperUsage[key].kg_loi += kgPerSheet * soLoi
              }
              for (const p of filteredPhieu) {
                for (const it of p.items) {
                  const areM2 = (it.chieu_kho ?? 0) * (it.chieu_cat ?? 0) / 10000
                  const soTam = it.so_tam ?? 0
                  const soLoi = it.so_luong_loi ?? 0
                  addPaperLayer(it.mat,    it.mat_dl,    areM2, soTam, soLoi)
                  addPaperLayer(it.song_1, it.song_1_dl, areM2, soTam, soLoi)
                  addPaperLayer(it.mat_1,  it.mat_1_dl,  areM2, soTam, soLoi)
                  addPaperLayer(it.song_2, it.song_2_dl, areM2, soTam, soLoi)
                  addPaperLayer(it.mat_2,  it.mat_2_dl,  areM2, soTam, soLoi)
                  addPaperLayer(it.song_3, it.song_3_dl, areM2, soTam, soLoi)
                  addPaperLayer(it.mat_3,  it.mat_3_dl,  areM2, soTam, soLoi)
                }
              }
              const paperRows = Object.values(paperUsage).sort((a, b) => b.kg - a.kg)
              const totalKgGiay = paperRows.reduce((s, r) => s + r.kg, 0)
              const totalKgLoiGiay = paperRows.reduce((s, r) => s + r.kg_loi, 0)
              return (
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
                      <Input
                        placeholder="Tìm số lệnh..."
                        allowClear
                        style={{ width: 140 }}
                        value={histSearchLenh}
                        onChange={e => setHistSearchLenh(e.target.value)}
                      />
                    </Col>
                    <Col>
                      <Select
                        placeholder="Tất cả ca"
                        allowClear
                        style={{ width: 110 }}
                        value={histFilterCa}
                        onChange={v => setHistFilterCa(v)}
                        options={['Ca 1', 'Ca 2', 'Ca 3', 'Ca đêm'].map(c => ({ value: c, label: c }))}
                      />
                    </Col>
                    <Col>
                      <Button icon={<ReloadOutlined />} onClick={() => refetchPhieu()}>Tải lại</Button>
                    </Col>
                    <Col>
                      <Button
                        onClick={() => exportExcelWithTemplate(
                          `lich-su-phieu-nhap-${histTuNgay}-${histDenNgay}.xlsx`,
                          'Lịch sử phiếu nhập',
                          filteredPhieu.map(p => {
                            const it = p.items[0]
                            return {
                              ...p,
                              ten_hang:   it?.ten_hang  ?? '',
                              chieu_kho:  it?.chieu_kho ?? '',
                              chieu_cat:  it?.chieu_cat ?? '',
                              m2_luong:   calcSoM2Luong(it?.chieu_kho ?? null, it?.chieu_cat ?? null, p.tong_so_tam, it?.so_lop ?? null) ?? '',
                            }
                          }),
                          [
                            { key: 'so_phieu',               label: 'Số phiếu',      width: 20 },
                            { key: 'so_lenh',                 label: 'Số lệnh',       width: 18 },
                            { key: 'ten_hang',                label: 'Tên hàng',      width: 28 },
                            { key: 'chieu_kho',               label: 'Khổ (cm)',      width: 12 },
                            { key: 'chieu_cat',               label: 'Cắt (cm)',      width: 12 },
                            { key: 'm2_luong',                label: 'm² lương',      width: 14 },
                            { key: 'ten_kho',                 label: 'Kho',           width: 18 },
                            { key: 'ngay',                    label: 'Ngày',          width: 14 },
                            { key: 'ca',                      label: 'Ca',            width: 10 },
                            { key: 'gio_bat_dau',             label: 'Giờ BĐ',        width: 10 },
                            { key: 'gio_ket_thuc',            label: 'Giờ KT',        width: 10 },
                            { key: 'tong_so_luong_thuc_te',   label: 'Số thùng',      width: 14 },
                            { key: 'tong_so_tam',             label: 'Tổng tấm',      width: 14 },
                            { key: 'tong_so_luong_loi',       label: 'Phôi lỗi',      width: 12 },
                            { key: 'created_by_name',         label: 'Người tạo',     width: 18 },
                          ],
                        )}
                        disabled={filteredPhieu.length === 0}
                      >
                        Xuất Excel
                      </Button>
                    </Col>
                  </Row>

                  {/* Summary bar */}
                  {filteredPhieu.length > 0 && (
                    <Row gutter={8} style={{ marginBottom: 10 }}>
                      {[
                        { label: 'SL thực tế', value: totalTT.toLocaleString(),  unit: 'thùng', color: '#52c41a' },
                        { label: 'Tổng tấm',   value: totalTam.toLocaleString(), unit: 'tấm',   color: '#722ed1' },
                        { label: 'm² lương',   value: totalM2Luong.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), unit: 'm²', color: '#531dab' },
                        { label: 'Phôi lỗi',   value: totalLoi.toLocaleString(), unit: 'cái',   color: totalLoi > 0 ? '#cf1322' : '#8c8c8c' },
                        ...(totalKgLoi > 0 ? [{ label: 'kg lỗi', value: totalKgLoi.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), unit: 'kg', color: '#cf1322' }] : []),
                      ].map(s => (
                        <Col key={s.label}>
                          <div style={{ padding: '4px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{s.label} ({s.unit})</div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  )}

                  <Table
                    dataSource={filteredPhieu}
                    columns={allPhieuCols}
                    rowKey="id"
                    loading={phieuLoading}
                    pagination={{ pageSize: 50, showTotal: t => `${t} phiếu` }}
                    size="small"
                    scroll={{ x: 950 }}
                    locale={{ emptyText: <EmptyState size="small" /> }}
                  />

                  {/* Bảng tiêu thụ giấy */}
                  {paperRows.length > 0 && (
                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          Tiêu thụ giấy{' '}
                          <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                            (tổng: <Text strong style={{ color: '#1677ff' }}>{Math.round(totalKgGiay).toLocaleString('vi-VN')} kg</Text>)
                          </Text>
                        </span>
                        <Button
                          size="small"
                          icon={<PrinterOutlined />}
                          onClick={() => exportExcelWithTemplate(
                            `tieu-thu-giay-${histTuNgay}-${histDenNgay}`,
                            'Tiêu thụ giấy',
                            [
                              ...paperRows.map(r => ({
                                loai_giay:   r.ten,
                                dl_gsm:      r.dl,
                                tieu_thu_kg: Math.round(r.kg),
                                kg_loi:      r.kg_loi > 0 ? Math.round(r.kg_loi) : '',
                                phan_tram:   totalKgGiay > 0 ? +(r.kg / totalKgGiay * 100).toFixed(1) : 0,
                              })),
                              { loai_giay: 'TỔNG CỘNG', dl_gsm: null, tieu_thu_kg: Math.round(totalKgGiay), kg_loi: Math.round(totalKgLoiGiay) || '', phan_tram: 100 },
                            ],
                            [
                              { key: 'loai_giay',   label: 'Loại giấy',      width: 20 },
                              { key: 'dl_gsm',      label: 'ĐL (g/m²)',       width: 12 },
                              { key: 'tieu_thu_kg', label: 'Tiêu thụ (kg)',   width: 14 },
                              { key: 'kg_loi',      label: 'kg lỗi',          width: 12 },
                              { key: 'phan_tram',   label: '%',                width: 8  },
                            ],
                          )}
                        >
                          Tải Excel
                        </Button>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left',  border: '1px solid #e8e8e8' }}>Loại giấy</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e8e8e8', width: 80 }}>ĐL (g/m²)</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e8e8e8', width: 100 }}>Tiêu thụ (kg)</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e8e8e8', width: 85 }}>kg lỗi</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #e8e8e8', width: 60 }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paperRows.map(row => (
                            <tr key={`${row.ten}__${row.dl}`}>
                              <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0', fontWeight: 500 }}>{row.ten}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#8c8c8c' }}>{row.dl}</td>
                              <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 600 }}>
                                {Math.round(row.kg).toLocaleString('vi-VN')}
                              </td>
                              <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0', textAlign: 'right', color: row.kg_loi > 0 ? '#cf1322' : '#d9d9d9' }}>
                                {row.kg_loi > 0 ? Math.round(row.kg_loi).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td style={{ padding: '4px 8px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#8c8c8c' }}>
                                {totalKgGiay > 0 ? (row.kg / totalKgGiay * 100).toFixed(1) : '0'}%
                              </td>
                            </tr>
                          ))}
                          <tr style={{ background: '#e6f4ff', fontWeight: 700 }}>
                            <td colSpan={2} style={{ padding: '4px 8px', border: '1px solid #e8e8e8' }}>Tổng cộng</td>
                            <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', textAlign: 'right', color: '#1677ff' }}>
                              {Math.round(totalKgGiay).toLocaleString('vi-VN')}
                            </td>
                            <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', textAlign: 'right', color: totalKgLoiGiay > 0 ? '#cf1322' : '#8c8c8c' }}>
                              {totalKgLoiGiay > 0 ? Math.round(totalKgLoiGiay).toLocaleString('vi-VN') : '—'}
                            </td>
                            <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', textAlign: 'right' }}>100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            })(),
          },
        ]}
      />

      <ModalTamDung
        target={pauseTarget}
        loading={pauseMut.isPending}
        onClose={() => setPauseTarget(null)}
        onSubmit={(id, data) => pauseMut.mutate({ id, data })}
      />

      <ModalHoanThanh
        orderId={hoanthanhId}
        order={hoanthanhOrder ?? null}
        orderLoading={orderLoading}
        planLine={hoanthanhPlanLine}
        submitting={createPhieu.isPending || completeMut.isPending}
        onClose={() => setHoanthanhId(null)}
        onSubmit={(orderId, data) => createPhieu.mutate({ orderId, data })}
      />

      <ModalInTem
        state={inTemState}
        onClose={() => setInTemState(null)}
        onUpdateTamPerPallet={nTpp => setInTemState(s => s ? { ...s, tamPerPallet: nTpp, soPallet: s.soTam > 0 ? Math.ceil(s.soTam / nTpp) : 1 } : null)}
        onUpdateSoPallet={n => setInTemState(s => s ? { ...s, soPallet: n } : null)}
      />
    </div>
  )
}
