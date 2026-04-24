import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Table, InputNumber, Select, Button, Space, Typography,
  Tag, Divider, message, Alert,
} from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ProductionOrderItem } from '../../api/productionOrders'
import { productionOrdersApi } from '../../api/productionOrders'
import { productionPlansApi } from '../../api/productionPlans'
import { calcBoxDimensions, getHaoHutRate, paperMaterialsApi } from '../../api/quotes'

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
  const toHopSong = item.to_hop_song ?? ''
  const loaiThung = item.loai_thung ?? ''
  const soLuong   = Number(item.so_luong_ke_hoach)

  const dai  = Number(item.dai  ?? item.product?.dai  ?? 0)
  const rong = Number(item.rong ?? item.product?.rong ?? 0)
  const cao  = Number(item.cao  ?? item.product?.cao  ?? 0)

  // Kích thước cơ bản của 1 con — tính từ công thức
  const baseDims = useMemo(
    () => calcBoxDimensions(loaiThung, dai, rong, cao, soLop),
    [loaiThung, dai, rong, cao, soLop],
  )

  // Chiều khổ sản xuất — làm tròn lên bội số 5
  const initKho = Number(item.kho_tt) || baseDims?.kho_tt || 0
  const [khoTt, setKhoTt] = useState<number>(initKho > 0 ? roundUpTo5(initKho) : 0)
  // Kết cấu giấy (có thể chỉnh sửa)
  const [layers, setLayers] = useState<Record<LayerKey, LayerState>>({
    mat:    { ma_ky_hieu: item.mat    ?? null, dinh_luong: item.mat_dl    ? Number(item.mat_dl)    : null },
    song_1: { ma_ky_hieu: item.song_1 ?? null, dinh_luong: item.song_1_dl ? Number(item.song_1_dl) : null },
    mat_1:  { ma_ky_hieu: item.mat_1  ?? null, dinh_luong: item.mat_1_dl  ? Number(item.mat_1_dl)  : null },
    song_2: { ma_ky_hieu: item.song_2 ?? null, dinh_luong: item.song_2_dl ? Number(item.song_2_dl) : null },
    mat_2:  { ma_ky_hieu: item.mat_2  ?? null, dinh_luong: item.mat_2_dl  ? Number(item.mat_2_dl)  : null },
    song_3: { ma_ky_hieu: item.song_3 ?? null, dinh_luong: item.song_3_dl ? Number(item.song_3_dl) : null },
    mat_3:  { ma_ky_hieu: item.mat_3  ?? null, dinh_luong: item.mat_3_dl  ? Number(item.mat_3_dl)  : null },
  })
  const [saving, setSaving] = useState(false)

  const layerDefs = useMemo(() => getLayerDefs(soLop, toHopSong), [soLop, toHopSong])
  const haoHut    = getHaoHutRate(soLuong)

  // Số dao từ chiều khổ thực tế (đã làm tròn bội số 5)
  const kho1         = baseDims?.kho1 ?? 0
  const soDaoCurrent = kho1 > 0 ? Math.max(1, Math.floor((khoTt - 1.8) / kho1)) : baseDims?.so_dao ?? 1
  const daiTt        = baseDims?.dai_tt ?? Number(item.dai_tt) ?? 0

  // Chiều rộng thực tế phân cho mỗi con (bao gồm hao phí viền)
  // = khoTt / soDaoCurrent  (khác kho1 vì đã làm tròn bội số 5)
  const khoMoiCon = soDaoCurrent > 0 && khoTt > 0 ? khoTt / soDaoCurrent : kho1

  // Tính rows — dùng khoMoiCon * daiTt làm diện tích thực tế
  const tableRows: LayerRow[] = useMemo(() =>
    layerDefs.map(def => {
      const ls   = layers[def.key]
      const dl   = ls.dinh_luong ?? 0
      const take = def.isSong ? (TAKE_UP_FACTORS[def.songType ?? ''] ?? 1.0) : 1.0
      // Diện tích giấy thực tế mỗi lớp = chiều rộng thực / con × chiều cắt × hệ số sóng
      const area = daiTt > 0 && khoMoiCon > 0
        ? (khoMoiCon * daiTt * take) / 10000
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
    [layerDefs, layers, khoMoiCon, daiTt, soLuong, haoHut],
  )

  const tongKg = tableRows.reduce((s, r) => s + r.total_kg, 0)

  const updateLayer = (key: LayerKey, field: 'ma_ky_hieu' | 'dinh_luong', value: string | number | null) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await productionOrdersApi.updateItemSxParams(orderId, item.id, {
        kho_tt: khoTt,
        dai_tt: daiTt,
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
        kho1:             kho1 || undefined,
        kho_giay:         khoTt || undefined,
        so_dao:           soDaoCurrent || undefined,
        so_luong_ke_hoach: soLuong,
      })

      message.success('Đã lưu và thêm vào Kế hoạch SX chờ')
      onSaved()
    } catch {
      message.error('Lưu thất bại')
    } finally {
      setSaving(false)
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
          onChange={v => updateLayer(r.key as LayerKey, 'ma_ky_hieu', v ?? null)}
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
                <Tag color="purple">{soLop} lớp {toHopSong ? `(${toHopSong})` : ''}</Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
              loading={saving}
              onClick={handleSave}
            >
              Lưu thông số SX
            </Button>
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
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Chiều cắt (dai_tt)</Text>
                  <Text strong style={{ color: '#52c41a' }}>
                    {daiTt > 0 ? `${daiTt} cm` : '—'}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Khổ min 1 con (kho1)</Text>
                  <Text strong>{kho1 > 0 ? `${kho1} cm` : '—'}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Khổ thực tế/con</Text>
                  <Text strong style={{ color: khoMoiCon > kho1 ? '#fa8c16' : undefined }}>
                    {khoMoiCon > 0 ? `${khoMoiCon.toFixed(1)} cm` : '—'}
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card size="small" style={{ background: '#e6f4ff' }}>
            <Row gutter={8} align="middle">
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Chiều khổ (chỉnh sửa để tối ưu)
                </Text>
                <Space>
                  <InputNumber
                    value={khoTt}
                    min={5}
                    max={300}
                    step={5}
                    precision={0}
                    style={{ width: 110 }}
                    addonAfter="cm"
                    onChange={v => {
                      if (v && v > 0) setKhoTt(roundUpTo5(v))
                    }}
                  />
                </Space>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                  {baseDims && roundUpTo5(baseDims.kho_tt) !== khoTt
                    ? `Mặc định: ${roundUpTo5(baseDims.kho_tt)} cm`
                    : '\u00a0'}
                </Text>
                {kho1 > 0 && khoMoiCon > kho1 && (
                  <Text type="warning" style={{ fontSize: 11, display: 'block' }}>
                    Hao phí viền: +{(khoMoiCon - kho1).toFixed(1)} cm/con
                  </Text>
                )}
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Số dao (con/khổ)</Text>
                <Text strong style={{ fontSize: 22, color: '#1677ff' }}>{soDaoCurrent}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                  Số lần chạy: {kho1 > 0 ? Math.ceil(soLuong / soDaoCurrent).toLocaleString('vi-VN') : '—'}
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
