import { useState, useCallback, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Card, Row, Col, Form, Select, InputNumber, Input, Checkbox,
  Button, Divider, Table, Typography, Space, Tag, Spin,
  Collapse, message, Alert,
} from 'antd'
import {
  CalculatorOutlined, SaveOutlined, CaretRightOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  bomApi,
  vnd,
  LOAI_THUNG_BOM_OPTIONS,
  SO_LOP_BOM_OPTIONS,
  TO_HOP_SONG_BY_LOP,
  BE_SO_CON_OPTIONS,
  CHONG_THAM_OPTIONS,
  CAN_MANG_OPTIONS,
} from '../../api/bom'
import type {
  BomLayerInput,
  BomCalculateRequest,
  BomCalculateResponse,
  BomLayerResult,
} from '../../api/bom'
import { paperMaterialsApi } from '../../api/quotes'

const { Text, Title } = Typography
const { Panel } = Collapse

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BomCalculatorPanelProps {
  production_order_item_id?: number
  initialValues?: {
    loai_thung?: string
    dai?: number
    rong?: number
    cao?: number
    so_lop?: number
    to_hop_song?: string
    mat?: BomLayerInput
    song_1?: BomLayerInput
    mat_1?: BomLayerInput
    song_2?: BomLayerInput
    mat_2?: BomLayerInput
    song_3?: BomLayerInput
    mat_3?: BomLayerInput
    so_luong?: number
  }
  onBomSaved?: (bomId: number) => void
}

// ─── Layer field definitions ──────────────────────────────────────────────────

type LayerKey = 'mat' | 'song_1' | 'mat_1' | 'song_2' | 'mat_2' | 'song_3' | 'mat_3'

function layerDefs(soLop: number, toHopSong: string): { key: LayerKey; label: string; isSong: boolean }[] {
  const songs = toHopSong ? toHopSong.split('') : []
  const get = (i: number) => songs[i] ?? (i + 1).toString()

  const base: { key: LayerKey; label: string; isSong: boolean }[] = [
    { key: 'mat',    label: 'Mặt ngoài',              isSong: false },
    { key: 'song_1', label: `Sóng ${get(0)}`,         isSong: true  },
    { key: 'mat_1',  label: soLop === 3 ? 'Mặt trong' : 'Mặt giữa', isSong: false },
  ]
  if (soLop >= 5) {
    base.push({ key: 'song_2', label: `Sóng ${get(1)}`, isSong: true  })
    base.push({ key: 'mat_2',  label: soLop === 5 ? 'Mặt trong' : 'Mặt 2', isSong: false })
  }
  if (soLop >= 7) {
    base.push({ key: 'song_3', label: `Sóng ${get(2)}`, isSong: true  })
    base.push({ key: 'mat_3',  label: 'Mặt trong',      isSong: false })
  }
  return base
}

// ─── Empty layer ──────────────────────────────────────────────────────────────

const emptyLayer = (): BomLayerInput => ({
  ma_ky_hieu: null,
  dinh_luong: null,
  don_gia_kg: 0,
})

// ─── Paper options hook ───────────────────────────────────────────────────────

function usePaperOptions() {
  const [mkList, setMkList] = useState<string[]>([])
  const [byMk, setByMk] = useState<Record<string, number[]>>({})

  useEffect(() => {
    paperMaterialsApi.options().then(res => {
      setMkList(res.data.ma_ky_hieu)
      setByMk(res.data.by_mk)
    }).catch(() => {/* silently fail – user can still type */})
  }, [])

  return { mkList, byMk }
}

// ─── Layer Row sub-component ──────────────────────────────────────────────────

interface LayerRowProps {
  label: string
  isSong: boolean
  value: BomLayerInput
  onChange: (v: BomLayerInput) => void
  mkList: string[]
  byMk: Record<string, number[]>
}

function LayerRow({ label, isSong, value, onChange, mkList, byMk }: LayerRowProps) {
  const dlOptions = value.ma_ky_hieu && byMk[value.ma_ky_hieu]
    ? byMk[value.ma_ky_hieu].map(n => ({ value: n, label: `${n} g/m²` }))
    : []

  return (
    <Row gutter={4} align="middle" style={{ marginBottom: 6 }}>
      <Col span={6}>
        <Text style={{ fontSize: 12 }}>
          {isSong
            ? <Tag color="blue" style={{ marginRight: 4, fontSize: 11 }}>~</Tag>
            : null}
          {label}
        </Text>
      </Col>
      <Col span={7}>
        <Select
          size="small"
          style={{ width: '100%' }}
          showSearch
          allowClear
          placeholder="Mã KH"
          value={value.ma_ky_hieu || undefined}
          options={mkList.map(mk => ({ value: mk, label: mk }))}
          filterOption={(input, opt) =>
            (opt?.value as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          onChange={v => onChange({ ...value, ma_ky_hieu: v ?? null, dinh_luong: null })}
        />
      </Col>
      <Col span={5}>
        <Select
          size="small"
          style={{ width: '100%' }}
          allowClear
          placeholder="g/m²"
          value={value.dinh_luong ?? undefined}
          options={dlOptions.length ? dlOptions : undefined}
          onChange={v => onChange({ ...value, dinh_luong: v ?? null })}
          notFoundContent={value.ma_ky_hieu ? '—' : 'Chọn mã trước'}
        >
          {!dlOptions.length && value.dinh_luong == null && (
            <Select.Option value={-1} disabled>—</Select.Option>
          )}
        </Select>
      </Col>
      <Col span={6}>
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          placeholder="đ/kg"
          value={value.don_gia_kg || undefined}
          min={0}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={v => onChange({ ...value, don_gia_kg: v ?? 0 })}
        />
      </Col>
    </Row>
  )
}

// ─── Cost row helper ──────────────────────────────────────────────────────────

function CostRow({
  label, value, bold, large, indent, prefix = '',
}: {
  label: string
  value: number
  bold?: boolean
  large?: boolean
  indent?: boolean
  prefix?: string
}) {
  return (
    <Row
      justify="space-between"
      align="middle"
      style={{
        padding: '4px 0',
        paddingLeft: indent ? 20 : 0,
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Col>
        <Text
          strong={bold}
          style={{ fontSize: large ? 15 : 13 }}
        >
          {prefix}{label}
        </Text>
      </Col>
      <Col>
        <Text
          strong={bold}
          style={{
            fontSize: large ? 15 : 13,
            color: large ? '#1677ff' : bold ? '#262626' : '#595959',
          }}
        >
          {vnd(value)} đ
        </Text>
      </Col>
    </Row>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BomCalculatorPanel({
  production_order_item_id,
  initialValues,
  onBomSaved,
}: BomCalculatorPanelProps) {
  const { mkList, byMk } = usePaperOptions()

  // ── Basic inputs ───────────────────────────────────────────────────────────
  const [loaiThung, setLoaiThung] = useState<BomCalculateRequest['loai_thung']>(
    (initialValues?.loai_thung as BomCalculateRequest['loai_thung']) ?? 'A1'
  )
  const [dai,  setDai]  = useState<number | null>(initialValues?.dai  ?? null)
  const [rong, setRong] = useState<number | null>(initialValues?.rong ?? null)
  const [cao,  setCao]  = useState<number | null>(initialValues?.cao  ?? null)
  const [soLop, setSoLop] = useState<3 | 5 | 7>(
    (initialValues?.so_lop as 3 | 5 | 7) ?? 3
  )
  const [toHopSong, setToHopSong] = useState<string>(initialValues?.to_hop_song ?? 'C')

  // ── Paper layers ───────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<Record<LayerKey, BomLayerInput>>({
    mat:    initialValues?.mat    ?? emptyLayer(),
    song_1: initialValues?.song_1 ?? emptyLayer(),
    mat_1:  initialValues?.mat_1  ?? emptyLayer(),
    song_2: initialValues?.song_2 ?? emptyLayer(),
    mat_2:  initialValues?.mat_2  ?? emptyLayer(),
    song_3: initialValues?.song_3 ?? emptyLayer(),
    mat_3:  initialValues?.mat_3  ?? emptyLayer(),
  })

  const setLayer = useCallback((key: LayerKey, val: BomLayerInput) => {
    setLayers(prev => ({ ...prev, [key]: val }))
  }, [])

  // ── Add-ons ────────────────────────────────────────────────────────────────
  const [chongTham,    setChongTham]    = useState<0 | 1 | 2>(0)
  const [inFlexoMau,  setInFlexoMau]   = useState<number>(0)
  const [phuNen,      setPhuNen]       = useState(false)
  const [inKTS,       setInKTS]        = useState(false)
  const [chapXa,      setChapXa]       = useState(false)
  const [boi,         setBoi]          = useState(false)
  const [beSoCon,     setBeSoCon]      = useState<0 | 1 | 2 | 4 | 6 | 8>(0)
  const [canMang,     setCanMang]      = useState<0 | 1 | 2>(0)
  const [sanPhamKho,  setSanPhamKho]   = useState(false)

  // ── Pricing ────────────────────────────────────────────────────────────────
  const [soLuong,       setSoLuong]       = useState<number>(initialValues?.so_luong ?? 1000)
  const [tyLeLN,        setTyLeLN]        = useState<number | undefined>(undefined)  // override %
  const [hoaHongKDPct,  setHoaHongKDPct]  = useState<number>(0)
  const [hoaHongKHPct,  setHoaHongKHPct]  = useState<number>(0)
  const [chiPhiKhac,    setChiPhiKhac]    = useState<number>(0)
  const [chietKhau,     setChietKhau]     = useState<number>(0)

  // ── Result ─────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<BomCalculateResponse | null>(null)

  // ── Mutations ──────────────────────────────────────────────────────────────
  const calcMutation = useMutation({
    mutationFn: (req: BomCalculateRequest) => bomApi.calculate(req),
    onSuccess: (res) => {
      setResult(res.data)
    },
    onError: (err: any) => {
      message.error(
        err?.response?.data?.detail || 'Lỗi tính toán BOM. Vui lòng kiểm tra lại dữ liệu nhập.'
      )
    },
  })

  const saveMutation = useMutation({
    mutationFn: (req: BomCalculateRequest & { production_order_item_id: number }) =>
      bomApi.save(req),
    onSuccess: (res) => {
      message.success('Đã lưu BOM thành công!')
      onBomSaved?.(res.data.bom_id)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi lưu BOM')
    },
  })

  // ── Build request ──────────────────────────────────────────────────────────
  const buildRequest = useCallback((): BomCalculateRequest | null => {
    if (!dai || !rong || !cao) {
      message.warning('Vui lòng nhập đầy đủ kích thước (Dài × Rộng × Cao)')
      return null
    }
    if (soLuong <= 0) {
      message.warning('Số lượng phải lớn hơn 0')
      return null
    }

    const defs = layerDefs(soLop, toHopSong)
    const getLayer = (key: LayerKey): BomLayerInput | null => {
      const inDefs = defs.some(d => d.key === key)
      if (!inDefs) return null
      const l = layers[key]
      // layer is optional if fields are empty
      if (!l.ma_ky_hieu && !l.dinh_luong && !l.don_gia_kg) return null
      return l
    }

    return {
      loai_thung: loaiThung,
      dai,
      rong,
      cao,
      so_lop: soLop,
      to_hop_song: toHopSong,
      mat:    getLayer('mat'),
      song_1: getLayer('song_1'),
      mat_1:  getLayer('mat_1'),
      song_2: getLayer('song_2'),
      mat_2:  getLayer('mat_2'),
      song_3: getLayer('song_3'),
      mat_3:  getLayer('mat_3'),
      so_luong: soLuong,
      chong_tham: chongTham,
      in_flexo_mau: inFlexoMau,
      phu_nen: phuNen,
      in_ky_thuat_so: inKTS,
      chap_xa: chapXa,
      boi,
      be_so_con: beSoCon,
      can_mang: canMang,
      san_pham_kho: sanPhamKho,
      ty_le_loi_nhuan: tyLeLN !== undefined ? tyLeLN / 100 : undefined,
      hoa_hong_kd_pct: hoaHongKDPct / 100,
      hoa_hong_kh_pct: hoaHongKHPct / 100,
      chi_phi_khac: chiPhiKhac,
      chiet_khau: chietKhau,
    }
  }, [
    loaiThung, dai, rong, cao, soLop, toHopSong, layers, soLuong,
    chongTham, inFlexoMau, phuNen, inKTS, chapXa, boi, beSoCon, canMang, sanPhamKho,
    tyLeLN, hoaHongKDPct, hoaHongKHPct, chiPhiKhac, chietKhau,
  ])

  const handleCalculate = () => {
    const req = buildRequest()
    if (!req) return
    calcMutation.mutate(req)
  }

  const handleSave = () => {
    if (!production_order_item_id) return
    const req = buildRequest()
    if (!req) return
    saveMutation.mutate({ ...req, production_order_item_id })
  }

  // ── When so_lop changes, reset to_hop_song to first suggestion ─────────────
  const handleSoLopChange = (v: 3 | 5 | 7) => {
    setSoLop(v)
    const suggestions = TO_HOP_SONG_BY_LOP[v] ?? []
    setToHopSong(suggestions[0] ?? '')
    setResult(null)
  }

  // ── Layer defs for current config ──────────────────────────────────────────
  const currentDefs = layerDefs(soLop, toHopSong)

  // ── BOM layers table columns ───────────────────────────────────────────────
  const bomCols: ColumnsType<BomLayerResult> = [
    {
      title: 'Vị trí',
      dataIndex: 'vi_tri_lop',
      width: 110,
      render: (v: string, r: BomLayerResult) => (
        <Space size={4}>
          {r.loai_lop === 'song'
            ? <Tag color="blue" style={{ fontSize: 11 }}>~</Tag>
            : <Tag style={{ fontSize: 11 }}>M</Tag>}
          <Text style={{ fontSize: 12 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'Mã',
      dataIndex: 'ma_ky_hieu',
      width: 90,
      render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || '—'}</Tag>,
    },
    {
      title: 'ĐL (g/m²)',
      dataIndex: 'dinh_luong',
      width: 90,
      align: 'right',
      render: (v: number) => v ?? '—',
    },
    {
      title: 'TL/thùng (kg)',
      dataIndex: 'trong_luong_1con',
      width: 110,
      align: 'right',
      render: (v: number) => v?.toFixed(4) ?? '—',
    },
    {
      title: 'SL cần (kg)',
      dataIndex: 'so_luong_can_tong',
      width: 100,
      align: 'right',
      render: (v: number) => v ? vnd(v) : '—',
    },
    {
      title: 'Đơn giá (đ/kg)',
      dataIndex: 'don_gia_kg',
      width: 110,
      align: 'right',
      render: (v: number) => vnd(v),
    },
    {
      title: 'Thành tiền (đ)',
      dataIndex: 'thanh_tien',
      width: 120,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: '#f5222d' }}>{vnd(v)}</Text>
      ),
    },
  ]

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── 1. Input section ───────────────────────────────────────────── */}
      <Card
        title={<Space><CalculatorOutlined /><span>Thông tin cấu trúc thùng</span></Space>}
        style={{ marginBottom: 12 }}
        size="small"
      >
        <Row gutter={12} align="bottom">
          {/* Loại thùng */}
          <Col xs={24} sm={12} md={6}>
            <Form.Item label="Loại thùng" style={{ marginBottom: 8 }}>
              <Select
                value={loaiThung}
                onChange={v => { setLoaiThung(v); setResult(null) }}
                options={LOAI_THUNG_BOM_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* Kích thước */}
          <Col xs={24} sm={12} md={10}>
            <Form.Item label="Kích thước (cm) — Dài × Rộng × Cao" style={{ marginBottom: 8 }}>
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  style={{ width: '33%' }}
                  placeholder="Dài"
                  min={0}
                  step={0.5}
                  value={dai ?? undefined}
                  onChange={v => { setDai(v); setResult(null) }}
                />
                <InputNumber
                  style={{ width: '33%' }}
                  placeholder="Rộng"
                  min={0}
                  step={0.5}
                  value={rong ?? undefined}
                  onChange={v => { setRong(v); setResult(null) }}
                />
                <InputNumber
                  style={{ width: '34%' }}
                  placeholder="Cao"
                  min={0}
                  step={0.5}
                  value={cao ?? undefined}
                  onChange={v => { setCao(v); setResult(null) }}
                />
              </Space.Compact>
            </Form.Item>
          </Col>

          {/* Số lớp */}
          <Col xs={12} sm={6} md={4}>
            <Form.Item label="Số lớp" style={{ marginBottom: 8 }}>
              <Select
                value={soLop}
                onChange={handleSoLopChange}
                options={SO_LOP_BOM_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          {/* Tổ hợp sóng */}
          <Col xs={12} sm={6} md={4}>
            <Form.Item label="Tổ hợp sóng" style={{ marginBottom: 8 }}>
              <Select
                value={toHopSong || undefined}
                onChange={v => { setToHopSong(v ?? ''); setResult(null) }}
                placeholder="Chọn / nhập..."
                allowClear
                showSearch
                options={(TO_HOP_SONG_BY_LOP[soLop] ?? []).map(s => ({ value: s, label: s }))}
                style={{ width: '100%' }}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ padding: '4px 8px' }}>
                      <Input
                        size="small"
                        placeholder="Nhập thủ công (VD: CB)"
                        onPressEnter={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim().toUpperCase()
                          if (v) { setToHopSong(v); setResult(null) }
                        }}
                      />
                    </div>
                  </>
                )}
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* ── 2. Paper layers ────────────────────────────────────────────── */}
      <Card
        title="Cấu trúc lớp giấy"
        size="small"
        style={{ marginBottom: 12 }}
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Mã KH · Định lượng · Đơn giá (đ/kg)
          </Text>
        }
      >
        {/* Column headers */}
        <Row gutter={4} style={{ marginBottom: 4 }}>
          <Col span={6}>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Vị trí lớp</Text>
          </Col>
          <Col span={7}>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Mã ký hiệu</Text>
          </Col>
          <Col span={5}>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Định lượng</Text>
          </Col>
          <Col span={6}>
            <Text style={{ fontSize: 11, color: '#8c8c8c' }}>Đơn giá (đ/kg)</Text>
          </Col>
        </Row>
        <Divider style={{ margin: '4px 0 8px' }} />

        {currentDefs.map(({ key, label, isSong }) => (
          <LayerRow
            key={key}
            label={label}
            isSong={isSong}
            value={layers[key]}
            onChange={v => { setLayer(key, v); setResult(null) }}
            mkList={mkList}
            byMk={byMk}
          />
        ))}
      </Card>

      {/* ── 3. Add-on section (collapsible) ────────────────────────────── */}
      <Collapse
        style={{ marginBottom: 12 }}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        ghost
      >
        <Panel
          header={
            <Text strong style={{ fontSize: 13 }}>
              Dịch vụ / gia công thêm
              {(chongTham > 0 || inFlexoMau > 0 || phuNen || inKTS || chapXa || boi || beSoCon > 0 || canMang > 0 || sanPhamKho) && (
                <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>Có chọn</Tag>
              )}
            </Text>
          }
          key="addons"
        >
          <Card size="small" style={{ background: '#fafafa' }}>
            <Row gutter={[16, 12]}>
              {/* Chống thấm */}
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Chống thấm" style={{ marginBottom: 0 }}>
                  <Select
                    value={chongTham}
                    onChange={v => { setChongTham(v as 0 | 1 | 2); setResult(null) }}
                    options={CHONG_THAM_OPTIONS}
                    style={{ width: '100%' }}
                    size="small"
                  />
                </Form.Item>
              </Col>

              {/* In Flexo màu */}
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="In Flexo (số màu)" style={{ marginBottom: 0 }}>
                  <InputNumber
                    size="small"
                    style={{ width: '100%' }}
                    min={0}
                    max={8}
                    value={inFlexoMau}
                    onChange={v => { setInFlexoMau(v ?? 0); setResult(null) }}
                    placeholder="0 = không in"
                  />
                </Form.Item>
              </Col>

              {/* Bế */}
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Bế số con" style={{ marginBottom: 0 }}>
                  <Select
                    value={beSoCon}
                    onChange={v => { setBeSoCon(v as 0 | 1 | 2 | 4 | 6 | 8); setResult(null) }}
                    options={BE_SO_CON_OPTIONS}
                    style={{ width: '100%' }}
                    size="small"
                  />
                </Form.Item>
              </Col>

              {/* Cán màng */}
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Cán màng" style={{ marginBottom: 0 }}>
                  <Select
                    value={canMang}
                    onChange={v => { setCanMang(v as 0 | 1 | 2); setResult(null) }}
                    options={CAN_MANG_OPTIONS}
                    style={{ width: '100%' }}
                    size="small"
                  />
                </Form.Item>
              </Col>

              {/* Checkboxes */}
              <Col xs={24}>
                <Space wrap size={[24, 8]}>
                  <Checkbox
                    checked={phuNen}
                    onChange={e => { setPhuNen(e.target.checked); setResult(null) }}
                  >
                    Phủ nền
                  </Checkbox>
                  <Checkbox
                    checked={inKTS}
                    onChange={e => { setInKTS(e.target.checked); setResult(null) }}
                  >
                    In kỹ thuật số
                  </Checkbox>
                  <Checkbox
                    checked={chapXa}
                    onChange={e => { setChapXa(e.target.checked); setResult(null) }}
                  >
                    Chạp / Xả
                  </Checkbox>
                  <Checkbox
                    checked={boi}
                    onChange={e => { setBoi(e.target.checked); setResult(null) }}
                  >
                    Bồi
                  </Checkbox>
                  <Checkbox
                    checked={sanPhamKho}
                    onChange={e => { setSanPhamKho(e.target.checked); setResult(null) }}
                  >
                    Sản phẩm khó
                  </Checkbox>
                </Space>
              </Col>
            </Row>
          </Card>
        </Panel>
      </Collapse>

      {/* ── 4. Pricing section ─────────────────────────────────────────── */}
      <Card title="Thông số giá" size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[16, 8]} align="bottom">
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Số lượng SX" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                value={soLuong}
                onChange={v => { setSoLuong(v ?? 1); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4}>
            <Form.Item
              label="Tỷ lệ lợi nhuận (%)"
              tooltip="Để trống = dùng mặc định theo số lượng"
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={100}
                value={tyLeLN}
                onChange={v => { setTyLeLN(v ?? undefined); setResult(null) }}
                placeholder="Mặc định"
                addonAfter="%"
              />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Hoa hồng KD (%)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={100}
                step={0.5}
                value={hoaHongKDPct}
                onChange={v => { setHoaHongKDPct(v ?? 0); setResult(null) }}
                addonAfter="%"
              />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Hoa hồng KH (%)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={100}
                step={0.5}
                value={hoaHongKHPct}
                onChange={v => { setHoaHongKHPct(v ?? 0); setResult(null) }}
                addonAfter="%"
              />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Chi phí khác (đ)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                value={chiPhiKhac}
                onChange={v => { setChiPhiKhac(v ?? 0); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
          </Col>

          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Chiết khấu (đ)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                value={chietKhau}
                onChange={v => { setChietKhau(v ?? 0); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* ── Calculate button ────────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 16, textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          icon={calcMutation.isPending ? <Spin size="small" /> : <CalculatorOutlined />}
          loading={calcMutation.isPending}
          onClick={handleCalculate}
          style={{ minWidth: 200 }}
        >
          Tính BOM & Giá
        </Button>
        {result && (
          <Text
            type="secondary"
            style={{ marginLeft: 16, fontSize: 12 }}
          >
            Kết quả tính toán bên dưới — thay đổi thông số và bấm lại để cập nhật
          </Text>
        )}
      </Card>

      {/* ── 5. Results ──────────────────────────────────────────────────── */}
      {calcMutation.isError && !result && (
        <Alert
          type="error"
          message="Không thể tính toán"
          description="Vui lòng kiểm tra lại dữ liệu nhập hoặc liên hệ quản trị viên."
          style={{ marginBottom: 12 }}
          showIcon
        />
      )}

      {result && (
        <>
          {/* Dimensions */}
          <Card
            title="Kích thước thực tế"
            size="small"
            style={{ marginBottom: 12 }}
          >
            <Row gutter={[16, 8]}>
              {[
                { label: 'Khổ 1 con (cm)',    value: result.kho_1con?.toFixed(1) },
                { label: 'Dài 1 con (cm)',    value: result.dai_1con?.toFixed(1) },
                { label: 'Số dao',            value: result.so_dao },
                { label: 'Khổ TT (cm)',       value: result.kho_tt?.toFixed(1) },
                { label: 'Dài TT (cm)',       value: result.dai_tt?.toFixed(1) },
                { label: 'Khổ KH (cm)',       value: result.kho_kh?.toFixed(1) },
                { label: 'Dài KH (cm)',       value: result.dai_kh?.toFixed(1) },
                { label: 'Diện tích (m²/thùng)', value: result.dien_tich?.toFixed(4) },
              ].map(({ label, value }) => (
                <Col key={label} xs={12} sm={8} md={6} lg={3}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{label}</Text>
                    <Text strong style={{ fontSize: 14 }}>{value ?? '—'}</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          {/* Cost breakdown */}
          <Card
            title="Bảng giá chi tiết (đ/thùng)"
            size="small"
            style={{ marginBottom: 12 }}
          >
            <div style={{ maxWidth: 560 }}>
              <CostRow label="Chi phí giấy" value={result.chi_phi_giay} prefix="a. " />
              <CostRow label="Chi phí gián tiếp" value={result.chi_phi_gian_tiep} prefix="b. " />
              <CostRow
                label={`Chi phí hao hụt (${(result.ty_le_hao_hut * 100).toFixed(0)}%)`}
                value={result.chi_phi_hao_hut}
                prefix="e. "
              />
              <CostRow
                label={`Lợi nhuận (${(result.ty_le_loi_nhuan * 100).toFixed(0)}%)`}
                value={result.loi_nhuan}
                prefix="c. "
              />
              <CostRow
                label="Chi phí dịch vụ"
                value={result.chi_phi_addon}
                prefix="d. "
              />
              {/* Add-on details */}
              {result.addon_details && Object.entries(result.addon_details).map(([k, v]) =>
                v > 0 ? (
                  <CostRow
                    key={k}
                    label={k}
                    value={v}
                    indent
                  />
                ) : null
              )}

              <Divider style={{ margin: '6px 0' }} />
              <CostRow label="Giá bán cơ bản (p)" value={result.gia_ban_co_ban} bold prefix="= " />
              <CostRow label="Hoa hồng KD" value={result.hoa_hong_kd} prefix="+ " />
              <CostRow label="Hoa hồng KH" value={result.hoa_hong_kh} prefix="+ " />
              <CostRow label="Chi phí khác" value={result.chi_phi_khac} prefix="+ " />
              <CostRow label="Chiết khấu" value={result.chiet_khau} prefix="- " />

              <Divider style={{ margin: '6px 0' }} />

              {/* Final price */}
              <Row
                justify="space-between"
                align="middle"
                style={{ padding: '8px 0', background: '#e6f4ff', borderRadius: 6, paddingLeft: 12, paddingRight: 12 }}
              >
                <Col>
                  <Text strong style={{ fontSize: 16 }}>= Giá bán cuối / thùng</Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 18, color: '#1677ff' }}>
                    {vnd(result.gia_ban_cuoi)} đ
                  </Text>
                </Col>
              </Row>

              <Row
                justify="space-between"
                align="middle"
                style={{ padding: '6px 12px', marginTop: 4, background: '#f6ffed', borderRadius: 6 }}
              >
                <Col>
                  <Text style={{ fontSize: 13 }}>
                    Tổng tiền ({new Intl.NumberFormat('vi-VN').format(soLuong)} cái)
                  </Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: 15, color: '#52c41a' }}>
                    {vnd(result.tong_tien)} đ
                  </Text>
                </Col>
              </Row>
            </div>
          </Card>

          {/* BOM materials table */}
          <Card
            title={
              <Space>
                <span>Bảng vật liệu (BOM)</span>
                <Tag color="geekblue">{result.bom_layers.length} lớp</Tag>
              </Space>
            }
            size="small"
            style={{ marginBottom: 12 }}
          >
            <Table<BomLayerResult>
              rowKey={(r, i) => `${r.vi_tri_lop}-${i}`}
              dataSource={result.bom_layers}
              columns={bomCols}
              pagination={false}
              size="small"
              scroll={{ x: 700 }}
              summary={(rows) => {
                const totalKg = rows.reduce((s, r) => s + (r.so_luong_can_tong ?? 0), 0)
                const totalTT = rows.reduce((s, r) => s + (r.thanh_tien ?? 0), 0)
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong>{vnd(totalKg)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} />
                    <Table.Summary.Cell index={6} align="right">
                      <Text strong style={{ color: '#f5222d' }}>{vnd(totalTT)} đ</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </Card>

          {/* Save button — only shown when linked to a production order item */}
          {production_order_item_id && (
            <Card size="small" style={{ textAlign: 'center' }}>
              <Space direction="vertical" size={4}>
                <Title level={5} style={{ margin: 0 }}>Xác nhận BOM</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Lưu BOM này vào lệnh sản xuất #{production_order_item_id}
                </Text>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saveMutation.isPending}
                  onClick={handleSave}
                  style={{ marginTop: 8, minWidth: 200, background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Xác nhận BOM
                </Button>
              </Space>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
