import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Table, InputNumber, Select, Input, Button, Space, Typography,
  Tag, Divider, message, Alert, Tooltip, Checkbox, Radio,
} from 'antd'
import { SaveOutlined, StarOutlined, StarFilled } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ProductionOrderItem } from '../../api/productionOrders'
import { productionOrdersApi } from '../../api/productionOrders'
import { productionPlansApi } from '../../api/productionPlans'
import { productsApi } from '../../api/products'
import { calcBoxDimensions, getHaoHutRate, paperMaterialsApi } from '../../api/quotes'
import { TO_HOP_SONG_BY_LOP } from '../../api/bom'
import EmptyState from "../../components/EmptyState"

const { Text } = Typography

// Take-up factors — khớp với backend price_calculator.py
const TAKE_UP_FACTORS: Record<string, number> = {
  'E': 1.22, 'B': 1.32, 'C': 1.45, 'A': 1.56,
}

// Làm tròn lên bội số 5 (khổ giấy thực tế)
const roundUpTo5 = (v: number) => Math.ceil(v / 5) * 5

interface LayerState {
  ma_ky_hieu: string | null
  dinh_luong: number | null
}

type LayerKey = 'mat' | 'song_1' | 'mat_1' | 'song_2' | 'mat_2' | 'song_3' | 'mat_3'

interface LayerDef {
  key: LayerKey
  label: string
  isSong: boolean
  songType: string | null
}

function getLayerDefs(soLop: number, toHopSong: string): LayerDef[] {
  const songs = toHopSong ? toHopSong.replace(/-/g, '').toUpperCase().split('') : []
  const defs: LayerDef[] = [
    { key: 'mat',    label: 'Mặt ngoài',                           isSong: false, songType: null },
    { key: 'song_1', label: `Sóng ${songs[0] || '?'}`,            isSong: true,  songType: songs[0] || null },
    { key: 'mat_1',  label: soLop === 3 ? 'Mặt trong' : 'Mặt giữa', isSong: false, songType: null },
  ]
  if (soLop >= 5) {
    defs.push({ key: 'song_2', label: `Sóng ${songs[1] || '?'}`, isSong: true,  songType: songs[1] || null })
    defs.push({ key: 'mat_2', label: soLop === 5 ? 'Mặt trong' : 'Mặt 2', isSong: false, songType: null })
  }
  if (soLop >= 7) {
    defs.push({ key: 'song_3', label: `Sóng ${songs[2] || '?'}`, isSong: true,  songType: songs[2] || null })
    defs.push({ key: 'mat_3', label: 'Mặt trong', isSong: false, songType: null })
  }
  return defs
}

interface LayerRow {
  key: string
  label: string
  isSong: boolean
  songType: string | null
  takeUp: number
  ma_ky_hieu: string | null
  dinh_luong: number | null
  dien_tich_1con: number   // m²/con (after take-up)
  kg_1con: number          // kg/con
  total_kg: number         // tổng kg (có hao hụt)
}

// ─── Per-item card ────────────────────────────────────────────────────────────

interface ItemSxCardProps {
  item: ProductionOrderItem
  orderId: number
  paperOpts: { ma_ky_hieu: string[]; by_mk: Record<string, number[]> }
  onSaved: () => void
}

function ItemSxCard({ item, orderId, paperOpts, onSaved }: ItemSxCardProps) {
  const soLop     = item.so_lop ?? item.product?.so_lop ?? 3
  const loaiThung = item.loai_thung ?? ''

  const mac_dinh = item.product?.sx_params_mac_dinh ?? null

  const [toHopSong, setToHopSong] = useState<string>(item.to_hop_song ?? mac_dinh?.to_hop_song ?? '')
  const soLuong   = Number(item.so_luong_ke_hoach)

  // Detect mismatch: ten_hang says "sóng XX" but to_hop_song differs
  const waveInName = item.ten_hang?.match(/sóng\s+([A-Z]{1,3})/i)?.[1]?.toUpperCase()
  const hasMismatch = !!(waveInName && toHopSong && waveInName !== toHopSong)

  const dai  = Number(item.dai  ?? item.product?.dai  ?? 0)
  const rong = Number(item.rong ?? item.product?.rong ?? 0)
  const cao  = Number(item.cao  ?? item.product?.cao  ?? 0)

  // Kích thước cơ bản của 1 con — tính từ công thức
  const baseDims = useMemo(
    () => calcBoxDimensions(loaiThung, dai, rong, cao, soLop),
    [loaiThung, dai, rong, cao, soLop],
  )

  // Chiều khổ sản xuất = kho_tt lý thuyết (kho1 × soDao + 1.8), không làm tròn
  const initKho = Number(item.kho_tt) || mac_dinh?.kho_tt || baseDims?.kho_tt || 0
  const [khoTt, setKhoTt] = useState<number>(initKho > 0 ? roundUpTo5(initKho) : 0)
  // Kết cấu giấy (có thể chỉnh sửa)
  const [layers, setLayers] = useState<Record<LayerKey, LayerState>>({
    mat:    { ma_ky_hieu: item.mat    ?? mac_dinh?.mat    ?? null, dinh_luong: item.mat_dl    ? Number(item.mat_dl)    : mac_dinh?.mat_dl    ?? null },
    song_1: { ma_ky_hieu: item.song_1 ?? mac_dinh?.song_1 ?? null, dinh_luong: item.song_1_dl ? Number(item.song_1_dl) : mac_dinh?.song_1_dl ?? null },
    mat_1:  { ma_ky_hieu: item.mat_1  ?? mac_dinh?.mat_1  ?? null, dinh_luong: item.mat_1_dl  ? Number(item.mat_1_dl)  : mac_dinh?.mat_1_dl  ?? null },
    song_2: { ma_ky_hieu: item.song_2 ?? mac_dinh?.song_2 ?? null, dinh_luong: item.song_2_dl ? Number(item.song_2_dl) : mac_dinh?.song_2_dl ?? null },
    mat_2:  { ma_ky_hieu: item.mat_2  ?? mac_dinh?.mat_2  ?? null, dinh_luong: item.mat_2_dl  ? Number(item.mat_2_dl)  : mac_dinh?.mat_2_dl  ?? null },
    song_3: { ma_ky_hieu: item.song_3 ?? mac_dinh?.song_3 ?? null, dinh_luong: item.song_3_dl ? Number(item.song_3_dl) : mac_dinh?.song_3_dl ?? null },
    mat_3:  { ma_ky_hieu: item.mat_3  ?? mac_dinh?.mat_3  ?? null, dinh_luong: item.mat_3_dl  ? Number(item.mat_3_dl)  : mac_dinh?.mat_3_dl  ?? null },
  })
  // QCCL — mặc định tính từ công thức, cho phép chỉnh sửa
  const computedQccl = useMemo(() => {
    if (!cao || !rong) return ''
    const allow = soLop <= 3 ? 0.1 : soLop <= 5 ? 0.2 : 0.3
    const side  = Math.round((rong / 2 + allow) * 10) / 10
    return `${side}+${cao}+${side}`
  }, [rong, cao, soLop])
  const [qccl, setQccl] = useState<string>(item.qccl ?? mac_dinh?.qccl ?? computedQccl)
  const [ghiChu, setGhiChu] = useState<string>(item.ghi_chu ?? '')

  const [saving, setSaving] = useState(false)
  // Đã lưu nếu item có kho_tt VÀ đang trong hàng chờ — nếu bị xóa khỏi queue thì reset
  const [saved,  setSaved]  = useState(() => !!item.kho_tt && !!item.queue_status)
  const [queueStatus, setQueueStatus] = useState<string | null>(item.queue_status ?? null)

  // Sync lại khi parent re-fetch (vd: item bị xóa khỏi queue bên ngoài)
  useEffect(() => {
    setQueueStatus(item.queue_status ?? null)
    if (!item.queue_status) setSaved(false)
  }, [item.queue_status])
  // Chạy ngược sóng: đổi chiều khổ ↔ chiều cắt trên máy
  const [nguocSong, setNguocSong] = useState(false)
  // Số con bế: khuôn bế cắt N con cùng lúc theo chiều ngang
  const [beConBe, setBeConBe] = useState<number>(
    item.be_so_con && item.be_so_con > 1 ? item.be_so_con
    : mac_dinh?.be_so_con && mac_dinh.be_so_con > 1 ? mac_dinh.be_so_con
    : 1
  )

  // Khi đổi hướng sóng, tính lại chiều khổ tối ưu theo hướng mới
  useEffect(() => {
    const daiKH = baseDims?.dai_ke_hoach ?? 0
    const eff = nguocSong ? daiKH : (baseDims?.kho_ke_hoach ?? 0)
    if (eff <= 0) return
    const beN = Math.max(1, beConBe)
    const soDaoBase = Math.max(1, Math.floor(180 / (eff * beN)))
    const newKho = Math.ceil((eff * beN * soDaoBase + 1.8) / 5) * 5
    if (newKho > 0) setKhoTt(newKho)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nguocSong])

  const layerDefs = useMemo(() => getLayerDefs(soLop, toHopSong), [soLop, toHopSong])
  const haoHut    = getHaoHutRate(soLuong)

  const kho1         = baseDims?.kho1 ?? 0
  // Khổ kế hoạch mỗi con (theo tài liệu hệ thống giai đoạn 1)
  const khoKeHoach   = baseDims?.kho_ke_hoach ?? 0
  // Khổ giấy lý thuyết tính đúng với be_so_con và hướng chạy — dùng cho hint "Mặc định"
  const defaultKhoTt = useMemo(() => {
    const daiKH = baseDims?.dai_ke_hoach ?? 0
    const eff = nguocSong ? daiKH : khoKeHoach
    if (!baseDims || eff <= 0) return baseDims?.kho_tt ?? 0
    const beN = Math.max(1, beConBe)
    const soDaoBase = Math.max(1, Math.floor(180 / (eff * beN)))
    return Math.ceil((eff * beN * soDaoBase + 1.8) / 5) * 5
  }, [baseDims, khoKeHoach, beConBe, nguocSong])
  const daiKeHoach   = baseDims?.dai_ke_hoach ?? 0
  const daiTtFormula = baseDims?.dai_tt ?? 0
  const [daiTt, setDaiTt] = useState<number>(
    Number(item.dai_tt) || mac_dinh?.dai_tt || daiTtFormula
  )
  // 2 mảnh: baseDims đã tính lại dai_tt per mảnh và dien_tich × 2
  const haiManh = baseDims?.hai_manh ?? false

  // Ngược sóng: chiều rộng mỗi con ↔ chiều dài máy đổi chỗ nhau
  // effectivePieceWidth: chiều ngang máy cho mỗi con (để tính số dao)
  // effectiveDaiTt:      chiều cắt thực tế máy chạy (để hiển thị & lưu)
  const effectivePieceWidth = nguocSong ? daiKeHoach : khoKeHoach
  const effectiveDaiTt      = nguocSong ? kho1 : daiTt
  // Số dao dựa trên chiều rộng mỗi con theo hướng máy đang chạy
  // beConBe > 1: khuôn bế chiếm beConBe × effectivePieceWidth mỗi nhát
  const soDaoCurrent = effectivePieceWidth > 0
    ? Math.max(1, Math.floor((khoTt - 1.8) / (effectivePieceWidth * beConBe)))
    : baseDims?.so_dao ?? 1

  // < 70 cm (≥3 lớp): xếp ×2 hoặc ×3 theo chiều cắt để đủ chiều dài tối thiểu
  const DAI_TT_MIN = 70
  const soLanCat = useMemo(() => {
    if (haiManh || soLop < 3 || effectiveDaiTt <= 0 || effectiveDaiTt >= DAI_TT_MIN) return 1
    for (const m of [2, 3, 4]) {
      if (effectiveDaiTt * m >= DAI_TT_MIN) return m
    }
    return 1
  }, [haiManh, soLop, effectiveDaiTt])
  // Số lần xếp do người dùng chọn (null = dùng auto soLanCat)
  const [selectedLanCat, setSelectedLanCat] = useState<number | null>(
    (item.so_lan_cat && item.so_lan_cat > 1) ? item.so_lan_cat : null
  )
  // Tất cả multiplier hợp lệ: đưa chiều cắt lên ≥70 cm và ≤270 cm
  const availableLanCats = (!haiManh && soLop >= 3 && effectiveDaiTt > 0 && effectiveDaiTt < DAI_TT_MIN)
    ? [2, 3, 4].filter(m => effectiveDaiTt * m <= 270)
    : []
  const activeSoLanCat = !haiManh ? (selectedLanCat ?? soLanCat) : 1

  // Tổng con/phôi = soDaoCurrent (nhóm dao) × beConBe (con/nhóm) × activeSoLanCat (xếp)
  const conMoiPhoi = soDaoCurrent * beConBe * activeSoLanCat
  // Số phôi cần sản xuất — điều chỉnh theo chế độ
  // haiManh: chạy 2 đợt riêng (mảnh 1 + mảnh 2), mỗi đợt ceil(soLuong / tổng con/phôi)
  const soPhoi = (kho1 > 0 && soDaoCurrent > 0)
    ? haiManh
      ? Math.ceil(soLuong / (soDaoCurrent * beConBe)) * 2
      : Math.ceil(soLuong / conMoiPhoi)
    : 0

  // Khổ thực tế phân cho mỗi con (dùng cho tính KG): khổ giấy ÷ tổng số con theo chiều ngang
  const khoMoiCon = (soDaoCurrent > 0 && khoTt > 0) ? khoTt / (soDaoCurrent * beConBe) : kho1
  // Chiều rộng mỗi con hiển thị (thay đổi khi chạy ngược sóng)
  const displayPieceWidth = nguocSong ? daiKeHoach : khoKeHoach

  // Tính rows — dùng kho1 (quy cách tấm thực tế) * daiTt làm diện tích
  const tableRows: LayerRow[] = useMemo(() =>
    layerDefs.map(def => {
      const ls   = layers[def.key]
      const dl   = ls.dinh_luong ?? 0
      const take = def.isSong ? (TAKE_UP_FACTORS[def.songType ?? ''] ?? 1.0) : 1.0
      // Diện tích mỗi lớp = khổ tấm × chiều cắt × hệ số sóng
      // haiManh: daiTt là per-mảnh → nhân 2 để ra diện tích 1 thùng
      const area = daiTt > 0 && kho1 > 0
        ? (kho1 * daiTt * take * (haiManh ? 2 : 1)) / 10000
        : 0
      const kg1  = (dl * area) / 1000
      return {
        key:            def.key,
        label:          def.label,
        isSong:         def.isSong,
        songType:       def.songType,
        takeUp:         take,
        ma_ky_hieu:     ls.ma_ky_hieu,
        dinh_luong:     dl,
        dien_tich_1con: Math.round(area * 10000) / 10000,
        kg_1con:        Math.round(kg1 * 10000) / 10000,
        total_kg:       Math.round(kg1 * soLuong * (1 + haoHut) * 10) / 10,
      }
    }),
    [layerDefs, layers, khoMoiCon, daiTt, haiManh, soLuong, haoHut],
  )

  const tongKg = tableRows.reduce((s, r) => s + r.total_kg, 0)

  useEffect(() => { setQueueStatus(item.queue_status ?? null) }, [item.queue_status])

  const markDirty = useCallback(() => { if (saved) setSaved(false) }, [saved])

  const updateLayer = (key: LayerKey, field: 'ma_ky_hieu' | 'dinh_luong', value: string | number | null) => {
    markDirty()
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await productionOrdersApi.updateItemSxParams(orderId, item.id, {
        to_hop_song: toHopSong || null,
        kho_tt: khoTt,
        dai_tt: effectiveDaiTt,   // kho1 khi ngược sóng, daiTt khi bình thường
        so_lan_cat: activeSoLanCat > 1 ? activeSoLanCat : null,
        be_so_con: beConBe > 1 ? beConBe : null,
        qccl:   qccl || null,
        ghi_chu: ghiChu || null,
        mat:    layers.mat.ma_ky_hieu,    mat_dl:    layers.mat.dinh_luong,
        song_1: layers.song_1.ma_ky_hieu, song_1_dl: layers.song_1.dinh_luong,
        mat_1:  layers.mat_1.ma_ky_hieu,  mat_1_dl:  layers.mat_1.dinh_luong,
        song_2: layers.song_2.ma_ky_hieu, song_2_dl: layers.song_2.dinh_luong,
        mat_2:  layers.mat_2.ma_ky_hieu,  mat_2_dl:  layers.mat_2.dinh_luong,
        song_3: layers.song_3.ma_ky_hieu, song_3_dl: layers.song_3.dinh_luong,
        mat_3:  layers.mat_3.ma_ky_hieu,  mat_3_dl:  layers.mat_3.dinh_luong,
      })

      // Tự động đẩy vào hàng chờ kế hoạch sản xuất
      await productionPlansApi.pushToQueue({
        production_order_item_id: item.id,
        kho1:             (nguocSong ? daiKeHoach : kho1) || undefined,
        kho_giay:         khoTt || undefined,
        so_dao:           soDaoCurrent || undefined,
        so_luong_ke_hoach: soLuong,
      })

      setSaved(true)
      setQueueStatus('cho')
      message.success('Đã lưu và thêm vào Kế hoạch SX chờ')
      onSaved()
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const [savingMacDinh, setSavingMacDinh] = useState(false)
  const [savedMacDinh, setSavedMacDinh] = useState(!!mac_dinh)

  const handleSaveMacDinh = async () => {
    if (!item.product?.id) return
    setSavingMacDinh(true)
    try {
      await productsApi.patchSxParamsMacDinh(item.product.id, {
        to_hop_song: toHopSong || null,
        kho_tt: khoTt,
        dai_tt: daiTt,
        be_so_con: beConBe > 1 ? beConBe : null,
        qccl: qccl || null,
        mat: layers.mat.ma_ky_hieu,       mat_dl: layers.mat.dinh_luong,
        song_1: layers.song_1.ma_ky_hieu, song_1_dl: layers.song_1.dinh_luong,
        mat_1:  layers.mat_1.ma_ky_hieu,  mat_1_dl:  layers.mat_1.dinh_luong,
        song_2: layers.song_2.ma_ky_hieu, song_2_dl: layers.song_2.dinh_luong,
        mat_2:  layers.mat_2.ma_ky_hieu,  mat_2_dl:  layers.mat_2.dinh_luong,
        song_3: layers.song_3.ma_ky_hieu, song_3_dl: layers.song_3.dinh_luong,
        mat_3:  layers.mat_3.ma_ky_hieu,  mat_3_dl:  layers.mat_3.dinh_luong,
      })
      setSavedMacDinh(true)
      message.success(`Đã lưu thông số mặc định cho "${item.ten_hang}"`)
    } catch {
      message.error('Lưu mặc định thất bại')
    } finally {
      setSavingMacDinh(false)
    }
  }

  const columns: ColumnsType<LayerRow> = [
    {
      title: 'Lớp giấy',
      dataIndex: 'label',
      width: 120,
      render: (v, r) => (
        <Space size={4}>
          {r.isSong ? <Tag color="blue" style={{ fontSize: 11 }}>Sóng</Tag>
                    : <Tag color="green" style={{ fontSize: 11 }}>Mặt</Tag>}
          <Text style={{ fontSize: 13 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Mã giấy',
      width: 130,
      render: (_, r) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={r.ma_ky_hieu ?? undefined}
          allowClear
          placeholder="Chọn..."
          onChange={v => {
            const newMk = v ?? null
            const dlOpts = newMk ? (paperOpts.by_mk[newMk] ?? []) : []
            markDirty()
            setLayers(prev => ({
              ...prev,
              [r.key as LayerKey]: {
                ma_ky_hieu: newMk,
                dinh_luong: dlOpts.length === 1 ? dlOpts[0] : (newMk === null ? null : prev[r.key as LayerKey].dinh_luong),
              },
            }))
          }}
          options={paperOpts.ma_ky_hieu.map(mk => ({ value: mk, label: mk }))}
        />
      ),
    },
    {
      title: 'ĐL (g/m²)',
      width: 120,
      render: (_, r) => {
        const dlOptions = r.ma_ky_hieu ? (paperOpts.by_mk[r.ma_ky_hieu] ?? []) : []
        return dlOptions.length > 0 ? (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={r.dinh_luong ?? undefined}
            allowClear
            placeholder="g/m²"
            onChange={v => updateLayer(r.key as LayerKey, 'dinh_luong', v ?? null)}
            options={dlOptions.map(dl => ({ value: dl, label: `${dl}` }))}
          />
        ) : (
          <InputNumber
            size="small"
            style={{ width: '100%' }}
            value={r.dinh_luong ?? undefined}
            min={0}
            placeholder="g/m²"
            onChange={v => updateLayer(r.key as LayerKey, 'dinh_luong', v ?? null)}
          />
        )
      },
    },
    {
      title: 'Hệ số sóng',
      dataIndex: 'takeUp',
      width: 90,
      align: 'center' as const,
      render: (v, r) => r.isSong
        ? <Text style={{ fontSize: 12 }}>{v.toFixed(2)}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'DT/con (m²)',
      dataIndex: 'dien_tich_1con',
      width: 100,
      align: 'right' as const,
      render: v => <Text style={{ fontSize: 12 }}>{v.toFixed(4)}</Text>,
    },
    {
      title: 'Kg/con',
      dataIndex: 'kg_1con',
      width: 85,
      align: 'right' as const,
      render: v => <Text style={{ fontSize: 12 }}>{v.toFixed(4)}</Text>,
    },
    {
      title: 'Tổng kg (hao hụt)',
      dataIndex: 'total_kg',
      width: 130,
      align: 'right' as const,
      render: v => <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{v.toFixed(1)} kg</Text>,
    },
  ]

  const hasBaseDims = !!baseDims && dai > 0

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={
        <Row align="middle" wrap={false}>
          <Col flex="auto">
            <Space size={8} wrap>
              <Text strong style={{ fontSize: 14 }}>{item.ten_hang}</Text>
              {item.product?.ma_amis && (
                <Text type="secondary" style={{ fontSize: 12 }}>[{item.product.ma_amis}]</Text>
              )}
              <Tag color="blue">{soLuong.toLocaleString('vi-VN')} {item.dvt}</Tag>
              {loaiThung && <Tag>{loaiThung}</Tag>}
              {soLop && (
                <Tooltip
                  title={hasMismatch
                    ? `Tên hàng ghi "sóng ${waveInName}" nhưng tổ hợp sóng đang là "${toHopSong}" — hãy chỉnh lại nếu sai`
                    : undefined}
                >
                  <Tag color={hasMismatch ? 'error' : toHopSong ? 'purple' : 'warning'}>
                    {soLop} lớp {toHopSong ? `(${toHopSong})` : '— chưa có tổ hợp sóng'}
                    {hasMismatch && ' ⚠'}
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </Col>
          <Col>
            <Space size={8}>

              {queueStatus === 'dang_chay' && <Tag color="success">⚙️ Đang sản xuất</Tag>}
              {queueStatus === 'hoan_thanh' && <Tag color="default">✅ Hoàn thành</Tag>}

              {item.product?.id && (
                <Tooltip title={savedMacDinh ? 'Cập nhật thông số mặc định cho mã hàng này' : 'Lưu thông số hiện tại làm mặc định cho mã hàng này'}>
                  <Button
                    size="small"
                    icon={savedMacDinh ? <StarFilled /> : <StarOutlined />}
                    loading={savingMacDinh}
                    onClick={handleSaveMacDinh}
                    style={savedMacDinh ? { color: '#faad14', borderColor: '#faad14' } : undefined}
                  >
                    {savedMacDinh ? 'Đã lưu mặc định' : 'Lưu làm mặc định'}
                  </Button>
                </Tooltip>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="small"
                loading={saving}
                onClick={handleSave}
                style={saved ? { background: '#52c41a', borderColor: '#52c41a' } : undefined}
              >
                {saved ? '✓ Đã lưu' : 'Lưu thông số SX'}
              </Button>
            </Space>
          </Col>
        </Row>
      }
    >
      {/* Thông số kích thước */}
      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" style={{ background: '#fafafa' }}>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Kích thước thùng</Text>
                  {dai > 0
                    ? <Text strong>{dai}×{rong}×{cao} cm</Text>
                    : <Text type="secondary">Chưa có thông tin</Text>}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    Tổ hợp sóng
                    {!item.to_hop_song && toHopSong && (
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>(mặc định)</Text>
                    )}
                  </Text>
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    value={toHopSong || undefined}
                    placeholder="Chọn tổ hợp sóng..."
                    allowClear
                    onChange={v => { markDirty(); setToHopSong(v ?? '') }}
                    options={(TO_HOP_SONG_BY_LOP[soLop] ?? []).map(s => ({ value: s, label: s }))}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Chiều cắt (dai_tt)</Text>
                  {nguocSong ? (
                    <Space size={4} wrap>
                      <Text strong style={{ color: '#722ed1' }}>{kho1} cm</Text>
                      {activeSoLanCat > 1 && (
                        <Tag color="purple" style={{ margin: 0 }}>×{activeSoLanCat} → {kho1 * activeSoLanCat} cm</Tag>
                      )}
                    </Space>
                  ) : haiManh ? (
                    <Space size={4} wrap>
                      <InputNumber
                        size="small"
                        value={daiTt}
                        min={1}
                        step={0.5}
                        style={{ width: 80 }}
                        onChange={v => { markDirty(); if (v && v > 0) setDaiTt(v) }}
                        addonAfter="cm"
                      />
                      <Tag color="blue" style={{ margin: 0 }}>2 mảnh</Tag>
                      {daiTtFormula > 0 && daiTt !== daiTtFormula && (
                        <Text type="secondary" style={{ fontSize: 10 }}>KT: {daiTtFormula} cm</Text>
                      )}
                    </Space>
                  ) : availableLanCats.length > 0 ? (
                    <Space size={4} wrap>
                      <InputNumber
                        size="small"
                        value={daiTt}
                        min={1}
                        step={0.5}
                        style={{ width: 80 }}
                        onChange={v => { markDirty(); if (v && v > 0) setDaiTt(v) }}
                        addonAfter="cm"
                      />
                      {activeSoLanCat > 1
                        ? <Tag color="orange" style={{ margin: 0 }}>×{activeSoLanCat} → {daiTt * activeSoLanCat} cm</Tag>
                        : <Tag style={{ margin: 0 }}>×1 (dưới 70 cm)</Tag>}
                      {daiTtFormula > 0 && daiTt !== daiTtFormula && (
                        <Text type="secondary" style={{ fontSize: 10 }}>KT: {daiTtFormula} cm</Text>
                      )}
                    </Space>
                  ) : (
                    <Space size={4} align="center">
                      <InputNumber
                        size="small"
                        value={daiTt}
                        min={1}
                        step={0.5}
                        style={{ width: 80 }}
                        onChange={v => { markDirty(); if (v && v > 0) setDaiTt(v) }}
                        addonAfter="cm"
                      />
                      {daiTtFormula > 0 && daiTt !== daiTtFormula && (
                        <Text type="secondary" style={{ fontSize: 10 }}>KT: {daiTtFormula} cm</Text>
                      )}
                    </Space>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Khổ min 1 con (kho1)</Text>
                  <Text strong>{kho1 > 0 ? `${kho1} cm` : '—'}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {nguocSong ? 'Khổ/con (ngược sóng)' : 'Khổ kế hoạch/con'}
                  </Text>
                  {displayPieceWidth > 250
                    ? <Tag color="error" style={{ marginTop: 2 }}>Không SX được ({displayPieceWidth.toFixed(1)} cm &gt; 250)</Tag>
                    : displayPieceWidth > 180
                    ? <Tag color="orange" style={{ marginTop: 2 }}>Mua phôi ngoài ({displayPieceWidth.toFixed(1)} cm)</Tag>
                    : <Text strong style={{ color: '#389e0d' }}>
                        {displayPieceWidth > 0 ? `${displayPieceWidth.toFixed(1)} cm` : '—'}
                      </Text>
                  }
                </div>
              </Col>
            </Row>
            {/* Ghi chú — tự sinh từ báo giá, nhân viên kế hoạch có thể sửa */}
            <div style={{ marginTop: 8, padding: '5px 8px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Ghi chú:</Text>
                <Input
                  size="small"
                  value={ghiChu}
                  onChange={e => { markDirty(); setGhiChu(e.target.value) }}
                  placeholder={item.ghi_chu || 'Nhập ghi chú...'}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            {/* QCCL — editable */}
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>QCCL:</Text>
                <Tooltip title={computedQccl ? `Tính tự động: ${computedQccl}` : 'Nhập dạng: 16.1+22+16.1'}>
                  <Input
                    size="small"
                    value={qccl}
                    onChange={e => { markDirty(); setQccl(e.target.value) }}
                    placeholder={computedQccl || 'vd: 16.1+22+16.1'}
                    style={{ fontFamily: 'monospace', fontWeight: 700, color: '#d46b08', width: 140 }}
                  />
                </Tooltip>
                {qccl !== computedQccl && computedQccl && (
                  <Button
                    size="small"
                    type="link"
                    style={{ padding: 0, fontSize: 11 }}
                    onClick={() => setQccl(computedQccl)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
            {/* Chế độ vận hành máy */}
            {!haiManh && (
              <div style={{ marginTop: 8, padding: '5px 8px', background: '#f0f5ff', borderRadius: 6, border: '1px solid #adc6ff' }}>
                <Space size={16} wrap>
                  <Checkbox
                    checked={nguocSong}
                    onChange={e => { markDirty(); setNguocSong(e.target.checked) }}
                  >
                    <Text style={{ fontSize: 12 }}>Chạy ngược sóng (đổi khổ ↔ cắt)</Text>
                  </Checkbox>
                  {availableLanCats.length > 0 && (
                    <Space size={4}>
                      <Text style={{ fontSize: 12 }}>Số lần xếp:</Text>
                      <Radio.Group
                        size="small"
                        value={activeSoLanCat}
                        onChange={e => { markDirty(); setSelectedLanCat(e.target.value) }}
                      >
                        <Radio.Button value={1}>×1</Radio.Button>
                        {availableLanCats.map(m => (
                          <Radio.Button key={m} value={m}>
                            ×{m}{m === soLanCat ? ' ✓' : ''}
                          </Radio.Button>
                        ))}
                      </Radio.Group>
                    </Space>
                  )}
                  <Space size={4}>
                    <Text style={{ fontSize: 12 }}>Số con bế:</Text>
                    <Select
                      size="small"
                      style={{ width: 70 }}
                      value={beConBe}
                      onChange={(v: number) => {
                        markDirty()
                        setBeConBe(v)
                        // Auto-cập nhật khổ giấy tối thiểu: kho_ke_hoach × N + viền
                        if (khoKeHoach > 0) setKhoTt(Math.ceil((khoKeHoach * v + 1.8) / 5) * 5)
                      }}
                      options={[1, 2, 3, 4, 6, 8].map(n => ({ value: n, label: `${n} con` }))}
                    />
                  </Space>
                </Space>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card size="small" style={{ background: '#e6f4ff' }}>
            <Row gutter={8} align="middle">
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Chiều khổ (chỉnh sửa để tối ưu)
                </Text>
                <Space size={4}>
                  <InputNumber
                    value={khoTt}
                    min={5}
                    max={300}
                    step={5}
                    precision={0}
                    style={{ width: 100 }}
                    onChange={v => {
                      markDirty()
                      if (v && v > 0) setKhoTt(roundUpTo5(v))
                    }}
                  />
                  <Text type="secondary">cm</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {defaultKhoTt > 0 && Math.round(defaultKhoTt * 10) / 10 !== khoTt
                    ? `Mặc định: ${Math.round(defaultKhoTt * 10) / 10} cm`
                    : '\u00a0'}
                </Text>
                {soDaoCurrent > 0 && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    Hao phí viền: +{(1.8 / soDaoCurrent).toFixed(1)} cm/con
                  </Text>
                )}
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  {beConBe > 1 ? `Số dao × ${beConBe} con` : 'Số dao (con/khổ)'}
                </Text>
                <Space size={4} align="baseline">
                  <Text strong style={{ fontSize: 22, color: '#1677ff' }}>{soDaoCurrent}</Text>
                  {beConBe > 1 && (
                    <Text style={{ fontSize: 13, color: '#722ed1' }}>
                      = {soDaoCurrent * beConBe} con
                    </Text>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                  Số phôi: <Text strong style={{ color: activeSoLanCat > 1 || haiManh || nguocSong || beConBe > 1 ? '#d46b08' : undefined }}>
                    {soPhoi > 0 ? soPhoi.toLocaleString('vi-VN') : '—'}
                  </Text>
                  {haiManh && (
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                      ({Math.ceil(soLuong / (soDaoCurrent * beConBe)).toLocaleString('vi-VN')} × 2 đợt)
                    </Text>
                  )}
                  {activeSoLanCat > 1 && (
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                      (×{activeSoLanCat} xếp)
                    </Text>
                  )}
                  {beConBe > 1 && (
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                      ({beConBe} con bế)
                    </Text>
                  )}
                  {nguocSong && (
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                      (ngược sóng)
                    </Text>
                  )}
                </Text>
              </Col>
            </Row>
            <Divider style={{ margin: '8px 0' }} />
            <Row>
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Hao hụt: {(haoHut * 100).toFixed(0)}% &nbsp;·&nbsp;
                  Tổng KG nguyên liệu: <Text strong style={{ color: '#fa8c16' }}>{tongKg.toFixed(1)} kg</Text>
                </Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Bảng kết cấu giấy */}
      {!hasBaseDims && (
        <Alert
          type="warning"
          message="Chưa có thông tin kích thước thùng — không thể tính kg."
          style={{ marginBottom: 8 }}
          showIcon
        />
      )}
      <Table
                locale={{ emptyText: <EmptyState size="small" /> }}
                columns={columns}
        dataSource={tableRows}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6} align="right">
              <Text strong>Tổng cộng</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text strong style={{ color: '#fa8c16', fontSize: 14 }}>
                {tongKg.toFixed(1)} kg
              </Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Card>
  )
}

// ─── Main tab component ───────────────────────────────────────────────────────

interface SxParamsTabProps {
  orderId: number
  items: ProductionOrderItem[]
}

export default function SxParamsTab({ orderId, items }: SxParamsTabProps) {
  const qc = useQueryClient()

  const { data: paperOpts, isLoading } = useQuery({
    queryKey: ['paper-material-options'],
    queryFn: () => paperMaterialsApi.options().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['production-order', orderId] })
  }

  if (isLoading || !paperOpts) {
    return <Card loading />
  }

  if (items.length === 0) {
    return (
      <Alert
        type="info"
        message="Lệnh sản xuất chưa có sản phẩm nào."
        showIcon
      />
    )
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Thông số sản xuất — điều chỉnh kết cấu giấy và chiều khổ để tối ưu nguyên vật liệu. Giá bán không thay đổi."
      />
      {items.map(item => (
        <ItemSxCard
          key={item.id}
          item={item}
          orderId={orderId}
          paperOpts={paperOpts}
          onSaved={handleSaved}
        />
      ))}
    </div>
  )
}
