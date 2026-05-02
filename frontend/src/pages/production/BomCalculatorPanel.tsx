import { useState, useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card, Row, Col, Form, Select, InputNumber, Input, Checkbox,
  Button, Divider, Table, Typography, Space, Tag, Spin,
  Collapse, message, Alert, Statistic,
} from 'antd'
import {
  CalculatorOutlined, SaveOutlined, CaretRightOutlined,
  CheckCircleOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  bomApi,
  addonRatesApi,
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
  BomLayerApiInput,
  BomCalculateRequest,
  BomCalculateResponse,
  BomLayerResult,
  BomReverseResponse,
  AddonRateItem,
} from '../../api/bom'
import { paperMaterialsApi } from '../../api/quotes'

const { Text, Title } = Typography
const { Panel } = Collapse

// ─── Addon labels ─────────────────────────────────────────────────────────────

// Build a lookup map from AddonRateItem list: { ma_chi_phi -> don_gia }
function buildRateMap(rates: AddonRateItem[]): Record<string, number> {
  return Object.fromEntries(rates.map(r => [r.ma_chi_phi, Number(r.don_gia)]))
}

function addonFormulaHint(
  key: string,
  params: {
    chongTham: number; inFlexoMau: number; phuNen: boolean
    beSoCon: number; canMang: number; dienTich: number
  },
  rateMap: Record<string, number> = {}
): string {
  const { chongTham, inFlexoMau, phuNen, beSoCon, canMang, dienTich } = params
  const area = dienTich.toFixed(4)
  const R = rateMap
  const vndRate = (n: number) => n.toLocaleString('vi-VN')
  switch (key) {
    case 'd1_chong_tham': {
      const rate = chongTham === 1 ? (R.d1_1_mat ?? 500) : (R.d1_2_mat ?? 1000)
      return `${vndRate(rate)} đ/m² × ${area} m²`
    }
    case 'd2_in_flexo': {
      const base = R.d2_base ?? 300
      const perMau = R.d2_them_mau ?? 50
      const phuNenRate = R.d2_phu_nen ?? 100
      const extra = inFlexoMau > 1 ? ` + ${inFlexoMau - 1}×${perMau}` : ''
      const phu = phuNen ? ` + ${phuNenRate}(phủ nền)` : ''
      const rate = base + (inFlexoMau - 1) * perMau + (phuNen ? phuNenRate : 0)
      return `(${vndRate(base)}${extra}${phu} = ${vndRate(rate)}) đ/m² × ${area} m²`
    }
    case 'd3_in_ky_thuat_so':
      return `${vndRate(R.d3_in_kts ?? 2233)} đ/cái (phí cố định/thùng)`
    case 'd4_chap_xa':
      return `${vndRate(R.d4_chap_xa ?? 150)} đ/cái (phí cố định/thùng)`
    case 'd5_boi':
      return `${vndRate(R.d5_boi ?? 187)} đ/m² × ${area} m²`
    case 'd6_be': {
      const rateMap: Record<number, number> = {
        1: R.d6_1_con ?? 400,
        2: R.d6_2_con ?? 300,
        4: R.d6_4_con ?? 200,
        6: R.d6_6_con ?? 150,
        8: R.d6_8_con ?? 100,
      }
      const rate = rateMap[beSoCon]
      return rate != null ? `${vndRate(rate)} đ/cái (bế ${beSoCon} con/khuôn)` : ''
    }
    case 'd7_dan':
      return `${vndRate(R.d7_dan ?? 0)} đ/cái (phí cố định/thùng)`
    case 'd7_ghim':
      return `${vndRate(R.d7_ghim ?? 0)} đ/cái (phí cố định/thùng)`
    case 'd8_can_mang': {
      const rate = canMang === 1 ? (R.d8_1_mat ?? 1800) : (R.d8_2_mat ?? 3600)
      return `${vndRate(rate)} đ/m² × ${area} m²`
    }
    case 'd9_san_pham_kho': {
      const pct = R.d9_pct ?? 2
      return `${pct}% × (CP giấy + CP gián tiếp + CP hao hụt)`
    }
    default:
      return ''
  }
}

const ADDON_LABELS: Record<string, string> = {
  d1_chong_tham:    'Chống thấm',
  d2_in_flexo:      'In Flexo',
  d3_in_ky_thuat_so:'In kỹ thuật số',
  d4_chap_xa:       'Chạp / Xả',
  d5_boi:           'Bồi',
  d6_be:            'Bế khuôn',
  d7_dan:           'Dán',
  d7_ghim:          'Ghim',
  d8_can_mang:      'Cán màng',
  d9_san_pham_kho:  'Sản phẩm khó (2%)',
}

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
    { key: 'mat',    label: 'Mặt ngoài',                       isSong: false },
    { key: 'song_1', label: `Sóng ${get(0)}`,                  isSong: true  },
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
    }).catch(() => {})
  }, [])

  return { mkList, byMk }
}

// ─── Layer Row ────────────────────────────────────────────────────────────────

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
          {isSong ? <Tag color="blue" style={{ marginRight: 4, fontSize: 11 }}>~</Tag> : null}
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

// ─── Accounting row ───────────────────────────────────────────────────────────

function AccRow({
  label, value, bold, large, indent, color, prefix = '',
}: {
  label: string; value: number; bold?: boolean; large?: boolean
  indent?: boolean; color?: string; prefix?: string
}) {
  return (
    <Row
      justify="space-between"
      align="middle"
      style={{ padding: indent ? '3px 0 3px 24px' : '5px 0', borderBottom: '1px solid #f5f5f5' }}
    >
      <Col>
        <Text strong={bold} style={{ fontSize: large ? 14 : 13, color: '#434343' }}>
          {prefix}{label}
        </Text>
      </Col>
      <Col>
        <Text strong={bold} style={{ fontSize: large ? 15 : 13, color: color ?? (bold ? '#262626' : '#595959') }}>
          {vnd(value)} đ
        </Text>
      </Col>
    </Row>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ letter, label, total }: { letter: string; label: string; total: number }) {
  return (
    <Row
      justify="space-between"
      align="middle"
      style={{ padding: '6px 10px', background: '#f0f5ff', borderRadius: 4, marginBottom: 4, marginTop: 8 }}
    >
      <Col>
        <Space size={6}>
          <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 12 }}>{letter}</Tag>
          <Text strong style={{ fontSize: 13 }}>{label}</Text>
        </Space>
      </Col>
      <Col>
        <Text strong style={{ fontSize: 13, color: '#1d3869' }}>{vnd(total)} đ</Text>
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

  // Fetch live addon rates for formula hints (falls back to defaults if not seeded)
  const { data: addonRates = [] } = useQuery({
    queryKey: ['addon-rates'],
    queryFn: () => addonRatesApi.list().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const liveRateMap = buildRateMap(addonRates)

  const [loaiThung, setLoaiThung] = useState<BomCalculateRequest['loai_thung']>(
    (initialValues?.loai_thung as BomCalculateRequest['loai_thung']) ?? 'A1'
  )
  const [dai,  setDai]  = useState<number | null>(initialValues?.dai  ?? null)
  const [rong, setRong] = useState<number | null>(initialValues?.rong ?? null)
  const [cao,  setCao]  = useState<number | null>(initialValues?.cao  ?? null)
  const initSoLop = (initialValues?.so_lop as 3 | 5 | 7) ?? 3
  const [soLop, setSoLop] = useState<3 | 5 | 7>(initSoLop)
  const [toHopSong, setToHopSong] = useState<string>(
    initialValues?.to_hop_song ?? (TO_HOP_SONG_BY_LOP[initSoLop]?.[0] ?? 'C')
  )

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

  const [chongTham,   setChongTham]   = useState<0 | 1 | 2>(0)
  const [inFlexoMau,  setInFlexoMau]  = useState<number>(0)
  const [phuNen,      setPhuNen]      = useState(false)
  const [inKTS,       setInKTS]       = useState(false)
  const [chapXa,      setChapXa]      = useState(false)
  const [boi,         setBoi]         = useState(false)
  const [beSoCon,     setBeSoCon]     = useState<0 | 1 | 2 | 4 | 6 | 8>(0)
  const [dan,         setDan]         = useState(false)
  const [ghim,        setGhim]        = useState(false)
  const [canMang,     setCanMang]     = useState<0 | 1 | 2>(0)
  const [sanPhamKho,  setSanPhamKho]  = useState(false)

  const [soLuong,       setSoLuong]       = useState<number>(initialValues?.so_luong ?? 1000)
  const [tyLeLN,        setTyLeLN]        = useState<number | undefined>(undefined)
  const [hoaHongKDPct,  setHoaHongKDPct]  = useState<number>(0)
  const [hoaHongKHPct,  setHoaHongKHPct]  = useState<number>(0)
  const [chiPhiKhac,    setChiPhiKhac]    = useState<number>(0)
  const [chietKhau,     setChietKhau]     = useState<number>(0)

  const [result, setResult] = useState<BomCalculateResponse | null>(null)
  const [savedBomId, setSavedBomId] = useState<number | null>(null)

  const hasPrefilledRef = useRef(false)

  const existingBomQuery = useQuery({
    queryKey: ['bom-by-item', production_order_item_id],
    queryFn: () => bomApi.getByItem(production_order_item_id!).then(r => r.data),
    enabled: !!production_order_item_id,
    retry: false,
    staleTime: Infinity,
  })

  // Quy cách từ báo giá — dùng làm fallback khi chưa có BOM lưu
  const quoteSpecQuery = useQuery({
    queryKey: ['bom-quote-spec', production_order_item_id],
    queryFn: () => bomApi.getQuoteSpec(production_order_item_id!).then(r => r.data),
    enabled: !!production_order_item_id,
    retry: false,
    staleTime: Infinity,
  })

  // Tính ngược
  const [giaMucTieu, setGiaMucTieu] = useState<number | null>(null)
  const [reverseResult, setReverseResult] = useState<BomReverseResponse | null>(null)

  const calcMutation = useMutation({
    mutationFn: (req: BomCalculateRequest) => bomApi.calculate(req),
    onSuccess: (res) => { setResult(res.data) },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi tính toán BOM')
    },
  })

  const reverseMutation = useMutation({
    mutationFn: (req: Parameters<typeof bomApi.reverseCalculate>[0]) =>
      bomApi.reverseCalculate(req),
    onSuccess: (res) => setReverseResult(res.data),
    onError: (err: any) => message.error(err?.response?.data?.detail || 'Lỗi tính ngược'),
  })

  const saveMutation = useMutation({
    mutationFn: async (req: BomCalculateRequest) => {
      const saveRes = await bomApi.save({ ...req, production_order_item_id })
      const bomId = saveRes.data.id
      const confirmRes = await bomApi.confirm(bomId)
      return confirmRes
    },
    onSuccess: (res) => {
      setSavedBomId(res.data.id)
      message.success(`Đã lưu hoạch toán BOM #${res.data.id}`)
      onBomSaved?.(res.data.id)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi lưu hoạch toán')
    },
  })

  useEffect(() => {
    const bom = existingBomQuery.data
    if (!bom || hasPrefilledRef.current) return
    hasPrefilledRef.current = true

    setLoaiThung(bom.loai_thung as BomCalculateRequest['loai_thung'])
    setDai(Number(bom.dai))
    setRong(Number(bom.rong))
    setCao(Number(bom.cao))
    const bom_so_lop = Number(bom.so_lop) as 3 | 5 | 7
    setSoLop(bom_so_lop)
    const resolvedTHS = bom.to_hop_song || initialValues?.to_hop_song || TO_HOP_SONG_BY_LOP[bom_so_lop]?.[0] || 'B'
    setToHopSong(resolvedTHS)
    setSoLuong(Number(bom.so_luong_sx))
    setChongTham(bom.chong_tham as 0 | 1 | 2)
    setInFlexoMau(bom.in_flexo_mau)
    setPhuNen(bom.in_flexo_phu_nen)
    setInKTS(bom.in_ky_thuat_so)
    setChapXa(bom.chap_xa)
    setBoi(bom.boi)
    setBeSoCon(bom.be_so_con as 0 | 1 | 2 | 4 | 6 | 8)
    setDan(bom.dan ?? false)
    setGhim(bom.ghim ?? false)
    setCanMang(bom.can_mang as 0 | 1 | 2)
    setSanPhamKho(bom.san_pham_kho)
    if (bom.ty_le_loi_nhuan != null) setTyLeLN(Number(bom.ty_le_loi_nhuan) * 100)
    setHoaHongKDPct(Number(bom.hoa_hong_kd_pct) * 100)
    setHoaHongKHPct(Number(bom.hoa_hong_kh_pct) * 100)
    setChiPhiKhac(Number(bom.chi_phi_khac))
    setChietKhau(Number(bom.chiet_khau))

    const layerKeys: LayerKey[] = ['mat', 'song_1', 'mat_1', 'song_2', 'mat_2', 'song_3', 'mat_3']
    const newLayers: Record<LayerKey, BomLayerInput> = {
      mat: emptyLayer(), song_1: emptyLayer(), mat_1: emptyLayer(),
      song_2: emptyLayer(), mat_2: emptyLayer(), song_3: emptyLayer(), mat_3: emptyLayer(),
    }
    bom.items.forEach((item, idx) => {
      if (idx < layerKeys.length) {
        newLayers[layerKeys[idx]] = {
          ma_ky_hieu: item.ma_ky_hieu,
          dinh_luong: Number(item.dinh_luong),
          don_gia_kg: Number(item.don_gia_kg),
        }
      }
    })
    setLayers(newLayers)

    // Derive flute_type per wave layer from resolved to_hop_song when stored value is null
    const resolvedSongs = resolvedTHS.split('')
    let songIdx = 0
    calcMutation.mutate({
      loai_thung: bom.loai_thung as BomCalculateRequest['loai_thung'],
      dai: Number(bom.dai), rong: Number(bom.rong), cao: Number(bom.cao),
      so_lop: Number(bom.so_lop) as 3 | 5 | 7,
      to_hop_song: resolvedTHS,
      layers: bom.items.map(item => {
        const isWave = item.loai_lop === 'song'
        const derivedFlute = isWave ? (resolvedSongs[songIdx] ?? null) : null
        if (isWave) songIdx++
        return {
          vi_tri_lop: item.vi_tri_lop,
          loai_lop: item.loai_lop as 'mat' | 'song',
          flute_type: item.flute_type || derivedFlute,
          ma_ky_hieu: item.ma_ky_hieu ?? '',
          paper_material_id: null,
          dinh_luong: Number(item.dinh_luong),
          don_gia_kg: Number(item.don_gia_kg),
        }
      }),
      so_luong: Number(bom.so_luong_sx),
      chong_tham: bom.chong_tham as 0 | 1 | 2,
      in_flexo_mau: bom.in_flexo_mau,
      in_flexo_phu_nen: bom.in_flexo_phu_nen,
      in_ky_thuat_so: bom.in_ky_thuat_so,
      chap_xa: bom.chap_xa,
      boi: bom.boi,
      be_so_con: bom.be_so_con as 0 | 1 | 2 | 4 | 6 | 8,
      dan: bom.dan ?? false,
      ghim: bom.ghim ?? false,
      can_mang: bom.can_mang as 0 | 1 | 2,
      san_pham_kho: bom.san_pham_kho,
      ty_le_loi_nhuan: bom.ty_le_loi_nhuan != null ? Number(bom.ty_le_loi_nhuan) : undefined,
      hoa_hong_kd_pct: Number(bom.hoa_hong_kd_pct),
      hoa_hong_kh_pct: Number(bom.hoa_hong_kh_pct),
      chi_phi_khac: Number(bom.chi_phi_khac),
      chiet_khau: Number(bom.chiet_khau),
    })
    setSavedBomId(bom.id)
  }, [existingBomQuery.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill từ quy cách (báo giá / kết cấu thông dụng / product) khi chưa có BOM lưu
  useEffect(() => {
    const spec = quoteSpecQuery.data
    if (!spec || hasPrefilledRef.current) return
    // Ưu tiên BOM đã lưu: nếu đang tải hoặc đã tải thành công → bỏ qua spec
    if (existingBomQuery.isLoading || existingBomQuery.isSuccess) return

    hasPrefilledRef.current = true

    setLoaiThung(spec.loai_thung as BomCalculateRequest['loai_thung'])
    if (spec.dai) setDai(spec.dai)
    if (spec.rong) setRong(spec.rong)
    if (spec.cao) setCao(spec.cao)
    const spec_so_lop = spec.so_lop as 3 | 5 | 7
    setSoLop(spec_so_lop)
    setToHopSong(
      spec.to_hop_song ||
      initialValues?.to_hop_song ||
      TO_HOP_SONG_BY_LOP[spec_so_lop]?.[0] || 'B'
    )
    setSoLuong(spec.so_luong)
    setChongTham(spec.chong_tham as 0 | 1 | 2)
    setInFlexoMau(spec.in_flexo_mau)
    setPhuNen(spec.in_flexo_phu_nen)
    setInKTS(spec.in_ky_thuat_so)
    setChapXa(spec.chap_xa)
    setBoi(spec.boi)
    setBeSoCon(spec.be_so_con as 0 | 1 | 2 | 4 | 6 | 8)
    setDan(spec.dan ?? false)
    setGhim(spec.ghim ?? false)
    setCanMang(spec.can_mang as 0 | 1 | 2)
    setSanPhamKho(spec.san_pham_kho)

    const layerKeys: LayerKey[] = ['mat', 'song_1', 'mat_1', 'song_2', 'mat_2', 'song_3', 'mat_3']
    const newLayers: Record<LayerKey, BomLayerInput> = {
      mat: emptyLayer(), song_1: emptyLayer(), mat_1: emptyLayer(),
      song_2: emptyLayer(), mat_2: emptyLayer(), song_3: emptyLayer(), mat_3: emptyLayer(),
    }
    spec.layers.forEach((layer, idx) => {
      if (idx < layerKeys.length) {
        const key = layerKeys[idx]
        const fallback = initialValues?.[key]
        newLayers[key] = {
          ma_ky_hieu: layer.ma_ky_hieu || fallback?.ma_ky_hieu || null,
          dinh_luong: layer.dinh_luong || fallback?.dinh_luong || null,
          don_gia_kg: 0,
        }
      }
    })
    // Nếu spec không có đủ layers, bổ sung từ initialValues
    layerKeys.forEach((key, idx) => {
      if (idx >= spec.layers.length && initialValues?.[key]) {
        newLayers[key] = { ...initialValues[key]!, don_gia_kg: initialValues[key]!.don_gia_kg ?? 0 }
      }
    })
    setLayers(newLayers)

    // Auto-tính nếu đủ kích thước và định lượng
    const resolvedTHS = spec.to_hop_song || initialValues?.to_hop_song || TO_HOP_SONG_BY_LOP[spec_so_lop]?.[0] || 'B'
    const hasFullLayers = spec.layers.length > 0 && spec.layers.every(l => l.dinh_luong > 0)
    if (spec.dai && spec.rong && spec.cao && hasFullLayers) {
      calcMutation.mutate({
        loai_thung: spec.loai_thung as BomCalculateRequest['loai_thung'],
        dai: spec.dai, rong: spec.rong, cao: spec.cao,
        so_lop: spec_so_lop,
        to_hop_song: resolvedTHS,
        layers: spec.layers,
        so_luong: spec.so_luong,
        chong_tham: spec.chong_tham as 0 | 1 | 2,
        in_flexo_mau: spec.in_flexo_mau,
        in_flexo_phu_nen: spec.in_flexo_phu_nen,
        in_ky_thuat_so: spec.in_ky_thuat_so,
        chap_xa: spec.chap_xa,
        boi: spec.boi,
        be_so_con: spec.be_so_con as 0 | 1 | 2 | 4 | 6 | 8,
        dan: spec.dan ?? false,
        ghim: spec.ghim ?? false,
        can_mang: spec.can_mang as 0 | 1 | 2,
        san_pham_kho: spec.san_pham_kho,
        ty_le_loi_nhuan: undefined,
        hoa_hong_kd_pct: 0,
        hoa_hong_kh_pct: 0,
        chi_phi_khac: 0,
        chiet_khau: 0,
      })
    }
  }, [quoteSpecQuery.data, existingBomQuery.isLoading, existingBomQuery.isSuccess, initialValues]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildRequest = useCallback((): BomCalculateRequest | null => {
    if (!dai || !rong || !cao) {
      message.warning('Vui lòng nhập đầy đủ kích thước')
      return null
    }
    const defs = layerDefs(soLop, toHopSong)
    const songs = toHopSong ? toHopSong.split('') : []
    let songIdx = 0
    const layersArr: BomLayerApiInput[] = []
    for (const def of defs) {
      const l = layers[def.key]
      if (!l.dinh_luong || l.dinh_luong <= 0) {
        message.warning(`Thiếu định lượng cho lớp "${def.label}"`)
        return null
      }
      layersArr.push({
        vi_tri_lop: def.label,
        loai_lop: def.isSong ? 'song' : 'mat',
        flute_type: def.isSong ? (songs[songIdx] ?? null) : null,
        ma_ky_hieu: l.ma_ky_hieu ?? '',
        paper_material_id: l.paper_material_id ?? null,
        dinh_luong: l.dinh_luong,
        don_gia_kg: l.don_gia_kg,
      })
      if (def.isSong) songIdx++
    }
    return {
      loai_thung: loaiThung,
      dai, rong, cao,
      so_lop: soLop,
      to_hop_song: toHopSong,
      layers: layersArr,
      so_luong: soLuong,
      chong_tham: chongTham,
      in_flexo_mau: inFlexoMau,
      in_flexo_phu_nen: phuNen,
      in_ky_thuat_so: inKTS,
      chap_xa: chapXa,
      boi,
      be_so_con: beSoCon,
      dan,
      ghim,
      can_mang: canMang,
      san_pham_kho: sanPhamKho,
      ty_le_loi_nhuan: tyLeLN !== undefined ? tyLeLN / 100 : undefined,
      hoa_hong_kd_pct: hoaHongKDPct / 100,
      hoa_hong_kh_pct: hoaHongKHPct / 100,
      chi_phi_khac: chiPhiKhac,
      chiet_khau: chietKhau,
    }
  }, [loaiThung, dai, rong, cao, soLop, toHopSong, layers, soLuong,
      chongTham, inFlexoMau, phuNen, inKTS, chapXa, boi, beSoCon, dan, ghim, canMang, sanPhamKho,
      tyLeLN, hoaHongKDPct, hoaHongKHPct, chiPhiKhac, chietKhau])

  const handleCalculate = () => {
    const req = buildRequest()
    if (req) calcMutation.mutate(req)
  }

  const handleSaveHoachToan = () => {
    const req = buildRequest()
    if (req) saveMutation.mutate(req)
  }

  const handleSoLopChange = (v: 3 | 5 | 7) => {
    setSoLop(v)
    const suggestions = TO_HOP_SONG_BY_LOP[v] ?? []
    setToHopSong(suggestions[0] ?? '')
    setResult(null)
  }

  const currentDefs = layerDefs(soLop, toHopSong)

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
    { title: 'Mã', dataIndex: 'ma_ky_hieu', width: 90,
      render: (v: string) => <Tag style={{ fontSize: 11 }}>{v || '—'}</Tag> },
    { title: 'ĐL (g/m²)', dataIndex: 'dinh_luong', width: 90, align: 'right' },
    { title: 'TL/thùng (kg)', dataIndex: 'trong_luong_1con', width: 110, align: 'right',
      render: (v: number) => v?.toFixed(4) ?? '—' },
    { title: 'SL cần (kg)', dataIndex: 'trong_luong_can_tong', width: 100, align: 'right',
      render: (v: number) => v ? vnd(v) : '—' },
    { title: 'Đơn giá (đ/kg)', dataIndex: 'don_gia_kg', width: 110, align: 'right',
      render: (v: number) => vnd(v) },
    { title: 'Thành tiền (đ)', dataIndex: 'thanh_tien', width: 120, align: 'right',
      render: (v: number) => <Text strong style={{ color: '#f5222d' }}>{vnd(v)}</Text> },
  ]

  return (
    <div>
      {existingBomQuery.data && (
        <Alert
          type="info"
          style={{ marginBottom: 12 }}
          showIcon
          closable
          message={
            <Space size={8}>
              <span>Hoạch toán BOM #{existingBomQuery.data.id}</span>
              <Tag color={existingBomQuery.data.trang_thai === 'confirmed' ? 'success' : 'processing'}>
                {existingBomQuery.data.trang_thai === 'confirmed' ? '✓ Đã xác nhận' : 'Nháp'}
              </Tag>
              {existingBomQuery.data.gia_ban_cuoi && (
                <Text strong style={{ color: '#0050b3' }}>
                  {vnd(Number(existingBomQuery.data.gia_ban_cuoi))} đ/thùng
                </Text>
              )}
            </Space>
          }
          description={
            existingBomQuery.data.indirect_items?.length > 0 ? (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Chi tiết chi phí gián tiếp đã lưu:</Text>
                <Row gutter={0} style={{ marginTop: 4 }}>
                  {existingBomQuery.data.indirect_items.map((ii) => (
                    <Col key={ii.ten} xs={24} sm={12} md={8} style={{ fontSize: 11, padding: '1px 0' }}>
                      <Text type="secondary">{ii.ten}: </Text>
                      <Text strong style={{ fontSize: 11 }}>{vnd(Number(ii.thanh_tien))} đ</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}> ({Number(ii.don_gia_m2)} đ/m²)</Text>
                    </Col>
                  ))}
                </Row>
              </div>
            ) : undefined
          }
        />
      )}
      {/* Badge nguồn dữ liệu khi không có BOM lưu */}
      {!existingBomQuery.data && quoteSpecQuery.data && !quoteSpecQuery.isLoading && (
        <Alert
          type={quoteSpecQuery.data.source === 'quote' ? 'success' : quoteSpecQuery.data.source === 'cau_truc' ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 12 }}
          message={
            quoteSpecQuery.data.source === 'quote'
              ? 'Đã tải quy cách từ báo giá'
              : quoteSpecQuery.data.source === 'cau_truc'
              ? 'Đã tải kết cấu thông dụng (không có báo giá liên kết)'
              : 'Chỉ có kích thước từ danh mục — cần nhập kết cấu giấy'
          }
        />
      )}
      {/* ── 1. Cấu trúc thùng ────────────────────────────────────────── */}
      <Card
        title={<Space><CalculatorOutlined /><span>Thông tin cấu trúc thùng</span></Space>}
        style={{ marginBottom: 12 }}
        size="small"
      >
        <Row gutter={12} align="bottom">
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
          <Col xs={24} sm={12} md={10}>
            <Form.Item label="Kích thước (cm) — Dài × Rộng × Cao" style={{ marginBottom: 8 }}>
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber style={{ width: '33%' }} placeholder="Dài" min={0} step={0.5}
                  value={dai ?? undefined} onChange={v => { setDai(v); setResult(null) }} />
                <InputNumber style={{ width: '33%' }} placeholder="Rộng" min={0} step={0.5}
                  value={rong ?? undefined} onChange={v => { setRong(v); setResult(null) }} />
                <InputNumber style={{ width: '34%' }} placeholder="Cao" min={0} step={0.5}
                  value={cao ?? undefined} onChange={v => { setCao(v); setResult(null) }} />
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Form.Item label="Số lớp" style={{ marginBottom: 8 }}>
              <Select value={soLop} onChange={handleSoLopChange}
                options={SO_LOP_BOM_OPTIONS} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Form.Item label="Tổ hợp sóng" style={{ marginBottom: 8 }}>
              <Select
                value={toHopSong || undefined}
                onChange={v => { setToHopSong(v ?? ''); setResult(null) }}
                placeholder="Chọn / nhập..."
                allowClear showSearch
                options={(TO_HOP_SONG_BY_LOP[soLop] ?? []).map(s => ({ value: s, label: s }))}
                style={{ width: '100%' }}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ padding: '4px 8px' }}>
                      <Input size="small" placeholder="Nhập thủ công (VD: CB)"
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

      {/* ── 2. Lớp giấy ──────────────────────────────────────────────── */}
      <Card
        title="Cấu trúc lớp giấy"
        size="small"
        style={{ marginBottom: 12 }}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>Mã KH · Định lượng · Đơn giá (đ/kg)</Text>}
      >
        <Row gutter={4} style={{ marginBottom: 4 }}>
          <Col span={6}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Vị trí lớp</Text></Col>
          <Col span={7}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Mã ký hiệu</Text></Col>
          <Col span={5}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Định lượng</Text></Col>
          <Col span={6}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Đơn giá (đ/kg)</Text></Col>
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

      {/* ── 3. Dịch vụ / gia công ────────────────────────────────────── */}
      <Collapse
        style={{ marginBottom: 12 }}
        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
        ghost
      >
        <Panel
          header={
            <Text strong style={{ fontSize: 13 }}>
              Dịch vụ / gia công thêm
              {(chongTham > 0 || inFlexoMau > 0 || phuNen || inKTS || chapXa || boi || beSoCon > 0 || dan || ghim || canMang > 0 || sanPhamKho) && (
                <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>Có chọn</Tag>
              )}
            </Text>
          }
          key="addons"
        >
          <Card size="small" style={{ background: '#fafafa' }}>
            <Row gutter={[16, 12]}>
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Chống thấm" style={{ marginBottom: 0 }}>
                  <Select value={chongTham} onChange={v => { setChongTham(v as 0|1|2); setResult(null) }}
                    options={CHONG_THAM_OPTIONS} style={{ width: '100%' }} size="small" />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="In Flexo (số màu)" style={{ marginBottom: 0 }}>
                  <InputNumber size="small" style={{ width: '100%' }} min={0} max={8}
                    value={inFlexoMau} onChange={v => { setInFlexoMau(v ?? 0); setResult(null) }}
                    placeholder="0 = không in" />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Bế số con" style={{ marginBottom: 0 }}>
                  <Select value={beSoCon} onChange={v => { setBeSoCon(v as 0|1|2|4|6|8); setResult(null) }}
                    options={BE_SO_CON_OPTIONS} style={{ width: '100%' }} size="small" />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Form.Item label="Cán màng" style={{ marginBottom: 0 }}>
                  <Select value={canMang} onChange={v => { setCanMang(v as 0|1|2); setResult(null) }}
                    options={CAN_MANG_OPTIONS} style={{ width: '100%' }} size="small" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Space wrap size={[24, 8]}>
                  <Checkbox checked={phuNen} onChange={e => { setPhuNen(e.target.checked); setResult(null) }}>Phủ nền</Checkbox>
                  <Checkbox checked={inKTS}  onChange={e => { setInKTS(e.target.checked); setResult(null) }}>In kỹ thuật số</Checkbox>
                  <Checkbox checked={chapXa} onChange={e => { setChapXa(e.target.checked); setResult(null) }}>Chạp / Xả</Checkbox>
                  <Checkbox checked={boi}    onChange={e => { setBoi(e.target.checked); setResult(null) }}>Bồi</Checkbox>
                  <Checkbox checked={dan}    onChange={e => { setDan(e.target.checked); setResult(null) }}>Dán</Checkbox>
                  <Checkbox checked={ghim}   onChange={e => { setGhim(e.target.checked); setResult(null) }}>Ghim</Checkbox>
                  <Checkbox checked={sanPhamKho} onChange={e => { setSanPhamKho(e.target.checked); setResult(null) }}>Sản phẩm khó (+2%)</Checkbox>
                </Space>
              </Col>
            </Row>
          </Card>
        </Panel>
      </Collapse>

      {/* ── 4. Thông số giá ──────────────────────────────────────────── */}
      <Card title="Thông số giá" size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[16, 8]} align="bottom">
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Số lượng SX" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={1} value={soLuong}
                onChange={v => { setSoLuong(v ?? 1); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Tỷ lệ lợi nhuận (%)" tooltip="Để trống = dùng mặc định" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={0} max={100}
                value={tyLeLN} onChange={v => { setTyLeLN(v ?? undefined); setResult(null) }}
                placeholder="Mặc định" addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Hoa hồng KD (%)" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5}
                value={hoaHongKDPct} onChange={v => { setHoaHongKDPct(v ?? 0); setResult(null) }}
                addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Hoa hồng KH (%)" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.5}
                value={hoaHongKHPct} onChange={v => { setHoaHongKHPct(v ?? 0); setResult(null) }}
                addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Chi phí khác (đ)" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={0} value={chiPhiKhac}
                onChange={v => { setChiPhiKhac(v ?? 0); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Form.Item label="Chiết khấu (đ)" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} min={0} value={chietKhau}
                onChange={v => { setChietKhau(v ?? 0); setResult(null) }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* ── Nút tính ─────────────────────────────────────────────────── */}
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
          <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
            Kết quả hiển thị bên dưới — thay đổi và bấm lại để cập nhật
          </Text>
        )}
      </Card>

      {/* ── 5. Kết quả ───────────────────────────────────────────────── */}
      {calcMutation.isError && !result && (
        <Alert type="error" message="Không thể tính toán"
          description="Vui lòng kiểm tra lại dữ liệu nhập hoặc liên hệ quản trị viên."
          style={{ marginBottom: 12 }} showIcon />
      )}

      {result && (
        <>
          {/* Kích thước thực tế */}
          <Card title="Kích thước thực tế" size="small" style={{ marginBottom: 12 }}>
            <Row gutter={[16, 8]}>
              {[
                { label: 'Khổ 1 con (cm)',    value: result.dimensions.kho1?.toFixed(1) },
                { label: 'Dài 1 con (cm)',    value: result.dimensions.dai1?.toFixed(1) },
                { label: 'Số dao',            value: result.dimensions.so_dao },
                { label: 'Khổ TT (cm)',       value: result.dimensions.kho_tt?.toFixed(1) },
                { label: 'Dài TT (cm)',       value: result.dimensions.dai_tt?.toFixed(1) },
                { label: 'Khổ KH (cm)',       value: result.dimensions.kho_kh?.toFixed(1) },
                { label: 'Dài KH (cm)',       value: result.dimensions.dai_kh?.toFixed(1) },
                { label: 'Diện tích (m²/thùng)', value: result.dimensions.dien_tich?.toFixed(4) },
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

          {/* ── PHIẾU HOẠCH TOÁN ──────────────────────────────────── */}
          <Card
            title={
              <Space>
                <span style={{ fontWeight: 700 }}>PHIẾU HOẠCH TOÁN CHI PHÍ SẢN XUẤT</span>
                {savedBomId && (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Đã lưu #{savedBomId}
                  </Tag>
                )}
              </Space>
            }
            size="small"
            style={{ marginBottom: 12 }}
            extra={
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
              >
                In phiếu
              </Button>
            }
          >
            {/* Header info */}
            <Row gutter={[16, 4]} style={{ marginBottom: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Loại thùng"
                  value={LOAI_THUNG_BOM_OPTIONS.find(o => o.value === loaiThung)?.label?.split('–')[0] ?? loaiThung}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Kích thước"
                  value={`${dai}×${rong}×${cao} cm`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Cấu trúc"
                  value={`${soLop} lớp · Sóng ${toHopSong}`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Số lượng SX"
                  value={soLuong}
                  suffix="cái"
                  formatter={v => new Intl.NumberFormat('vi-VN').format(Number(v))}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Diện tích"
                  value={result.dimensions.dien_tich?.toFixed(4)}
                  suffix="m²/thùng"
                  valueStyle={{ fontSize: 13 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Hao hụt"
                  value={(result.ty_le_hao_hut * 100).toFixed(0)}
                  suffix="%"
                  valueStyle={{ fontSize: 13 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Lợi nhuận"
                  value={(result.ty_le_loi_nhuan * 100).toFixed(1)}
                  suffix="%"
                  valueStyle={{ fontSize: 13 }}
                />
              </Col>
            </Row>

            {/* A. Chi phí giấy */}
            <SectionHeader letter="A" label="Chi phí giấy" total={result.chi_phi_giay} />
            <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
              <Row gutter={0} style={{ marginBottom: 4, padding: '3px 0', borderBottom: '1px solid #e8e8e8' }}>
                {['Vị trí lớp', 'Mã KH', 'ĐL (g/m²)', 'Đơn giá (đ/kg)', 'TL/thùng (kg)', 'Thành tiền (đ/thùng)'].map((h, i) => (
                  <Col key={i} span={i === 0 ? 5 : i === 5 ? 5 : 4}>
                    <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{h}</Text>
                  </Col>
                ))}
              </Row>
              {result.bom_layers.map((bl, idx) => (
                <Row key={idx} gutter={0} style={{ padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <Col span={5}>
                    <Space size={4}>
                      {bl.loai_lop === 'song'
                        ? <Tag color="blue" style={{ fontSize: 10 }}>~</Tag>
                        : <Tag style={{ fontSize: 10 }}>M</Tag>}
                      <Text style={{ fontSize: 12 }}>{bl.vi_tri_lop}</Text>
                    </Space>
                  </Col>
                  <Col span={4}>
                    <Text code style={{ fontSize: 11 }}>{bl.ma_ky_hieu || '—'}</Text>
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 12 }}>{bl.dinh_luong}</Text>
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 12 }}>{vnd(bl.don_gia_kg)}</Text>
                  </Col>
                  <Col span={4}>
                    <Text style={{ fontSize: 12 }}>{bl.trong_luong_1con.toFixed(4)}</Text>
                  </Col>
                  <Col span={5} style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{vnd(bl.chi_phi_1con)} đ</Text>
                  </Col>
                </Row>
              ))}
            </div>

            {/* B. Chi phí gián tiếp */}
            <SectionHeader
              letter="B"
              label={`Chi phí gián tiếp (${soLop} lớp · ${
                result.gian_tiep_breakdown?.length > 0
                  ? new Intl.NumberFormat('vi-VN').format(
                      Math.round(result.gian_tiep_breakdown.reduce((s, i) => s + i.don_gia_m2, 0))
                    )
                  : soLop === 3 ? '898' : soLop === 5 ? '1.178' : '1.800'
              } đ/m²)`}
              total={result.chi_phi_gian_tiep}
            />
            {result.gian_tiep_breakdown && result.gian_tiep_breakdown.length > 0 && (
              <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                <Row gutter={0} style={{ marginBottom: 4, padding: '3px 0', borderBottom: '1px solid #e8e8e8' }}>
                  {['Khoản mục', 'Đơn giá (đ/m²)', `Diện tích (m²)`, 'Thành tiền (đ/thùng)'].map((h, i) => (
                    <Col key={i} span={i === 0 ? 8 : i === 3 ? 6 : 5}>
                      <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{h}</Text>
                    </Col>
                  ))}
                </Row>
                {result.gian_tiep_breakdown.map((item) => (
                  <Row key={item.ten} gutter={0} style={{ padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <Col span={8}><Text style={{ fontSize: 12 }}>{item.ten}</Text></Col>
                    <Col span={5}><Text style={{ fontSize: 12 }}>{item.don_gia_m2}</Text></Col>
                    <Col span={5}><Text style={{ fontSize: 12 }}>{result.dimensions.dien_tich?.toFixed(4)}</Text></Col>
                    <Col span={6} style={{ textAlign: 'right' }}>
                      <Text strong style={{ fontSize: 12, color: '#1d39c4' }}>{vnd(item.thanh_tien)} đ</Text>
                    </Col>
                  </Row>
                ))}
              </div>
            )}

            {/* C. Lợi nhuận */}
            <SectionHeader
              letter="C"
              label={`Lợi nhuận (${(result.ty_le_loi_nhuan * 100).toFixed(1)}% × (A+B))`}
              total={result.loi_nhuan}
            />

            {/* D. Chi phí dịch vụ */}
            <SectionHeader letter="D" label="Chi phí dịch vụ / gia công" total={result.chi_phi_addon} />
            {result.addon_detail && Object.entries(result.addon_detail).some(([, v]) => (v as number) > 0) && (
              <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                <Row gutter={0} style={{ marginBottom: 4, padding: '3px 0', borderBottom: '1px solid #e8e8e8' }}>
                  <Col span={5}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Dịch vụ / gia công</Text></Col>
                  <Col span={14}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Công thức tính</Text></Col>
                  <Col span={5} style={{ textAlign: 'right' }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>Thành tiền (đ/thùng)</Text></Col>
                </Row>
                {Object.entries(result.addon_detail).map(([k, v]) =>
                  (v as number) > 0 ? (
                    <Row key={k} gutter={0} style={{ padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <Col span={5}>
                        <Text style={{ fontSize: 12 }}>{ADDON_LABELS[k] ?? k}</Text>
                      </Col>
                      <Col span={14}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {addonFormulaHint(k, {
                            chongTham, inFlexoMau, phuNen,
                            beSoCon, canMang,
                            dienTich: result.dimensions.dien_tich ?? 0,
                          }, liveRateMap)}
                        </Text>
                      </Col>
                      <Col span={5} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>{vnd(v as number)} đ</Text>
                      </Col>
                    </Row>
                  ) : null
                )}
              </div>
            )}

            {/* E. Hao hụt */}
            <SectionHeader
              letter="E"
              label={`Chi phí hao hụt (${(result.ty_le_hao_hut * 100).toFixed(0)}% × (A+B))`}
              total={result.chi_phi_hao_hut}
            />

            <Divider style={{ margin: '10px 0 6px' }} />

            {/* = Giá bán cơ bản */}
            <Row
              justify="space-between"
              align="middle"
              style={{ padding: '7px 10px', background: '#f0f5ff', borderRadius: 4, marginBottom: 4 }}
            >
              <Col>
                <Text strong style={{ fontSize: 14 }}>= GIÁ BÁN CƠ BẢN (p = A+B+C+D+E)</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: 14, color: '#1677ff' }}>{vnd(result.gia_ban_co_ban)} đ</Text>
              </Col>
            </Row>

            {/* Hoa hồng + CP khác + chiết khấu */}
            {result.hoa_hong_kd > 0 && (
              <AccRow label={`Hoa hồng KD (${(hoaHongKDPct).toFixed(1)}%)`} value={result.hoa_hong_kd} prefix="+ " />
            )}
            {result.hoa_hong_kh > 0 && (
              <AccRow label={`Hoa hồng KH (${(hoaHongKHPct).toFixed(1)}%)`} value={result.hoa_hong_kh} prefix="+ " />
            )}
            {result.chi_phi_khac > 0 && (
              <AccRow label="Chi phí khác" value={result.chi_phi_khac} prefix="+ " />
            )}
            {result.chiet_khau > 0 && (
              <AccRow label="Chiết khấu" value={result.chiet_khau} prefix="- " color="#f5222d" />
            )}

            <Divider style={{ margin: '6px 0' }} />

            {/* Giá bán cuối */}
            <Row
              justify="space-between"
              align="middle"
              style={{ padding: '10px 12px', background: '#e6f4ff', borderRadius: 6, marginBottom: 6 }}
            >
              <Col>
                <Text strong style={{ fontSize: 16 }}>GIÁ BÁN CUỐI</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: 20, color: '#0050b3' }}>
                  {vnd(result.gia_ban_cuoi)} đ / thùng
                </Text>
              </Col>
            </Row>
            <Row
              justify="space-between"
              align="middle"
              style={{ padding: '8px 12px', background: '#f6ffed', borderRadius: 6 }}
            >
              <Col>
                <Text style={{ fontSize: 14 }}>
                  TỔNG TIỀN ({new Intl.NumberFormat('vi-VN').format(soLuong)} thùng)
                </Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: 16, color: '#389e0d' }}>
                  {vnd(result.gia_ban_cuoi * soLuong)} đ
                </Text>
              </Col>
            </Row>
          </Card>

          {/* ── Bảng vật liệu (BOM) ───────────────────────────────── */}
          <Card
            title={
              <Space>
                <span>Bảng vật liệu (BOM) — kế hoạch nguyên liệu</span>
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
                const totalKg = rows.reduce((s, r) => s + (r.trong_luong_can_tong ?? 0), 0)
                const totalTT = rows.reduce((s, r) => s + (r.thanh_tien ?? 0), 0)
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Text strong>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong>{vnd(totalKg)} kg</Text>
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

          {/* ── Tính ngược từ giá bán mục tiêu ───────────────────── */}
          <Card
            title={
              <Space>
                <span>🔁 Tính ngược từ giá bán mục tiêu</span>
              </Space>
            }
            size="small"
            style={{ marginBottom: 12 }}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Nhập giá bán mong muốn → hệ thống tính ngân sách giấy tối đa
              </Text>
            }
          >
            <Row gutter={12} align="bottom">
              <Col xs={24} sm={12} md={8}>
                <Form.Item label="Giá bán mục tiêu (đ/thùng)" style={{ marginBottom: 0 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    value={giaMucTieu ?? undefined}
                    onChange={v => { setGiaMucTieu(v); setReverseResult(null) }}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    placeholder="VD: 25000"
                    addonAfter="đ"
                  />
                </Form.Item>
              </Col>
              <Col>
                <Button
                  type="default"
                  loading={reverseMutation.isPending}
                  disabled={!giaMucTieu || !dai || !rong || !cao}
                  onClick={() => {
                    if (!giaMucTieu || !dai || !rong || !cao) return
                    reverseMutation.mutate({
                      gia_muc_tieu: giaMucTieu,
                      loai_thung: loaiThung,
                      dai, rong, cao,
                      so_lop: soLop,
                      so_luong: soLuong,
                      ty_le_loi_nhuan: tyLeLN !== undefined ? tyLeLN / 100 : undefined,
                      d_total: result?.chi_phi_addon ?? 0,
                      hoa_hong_kd_pct: hoaHongKDPct / 100,
                      hoa_hong_kh_pct: hoaHongKHPct / 100,
                      chi_phi_khac: chiPhiKhac,
                      chiet_khau: chietKhau,
                    })
                  }}
                >
                  Tính ngược
                </Button>
              </Col>
            </Row>

            {reverseResult && (
              <div style={{ marginTop: 16 }}>
                <Row gutter={[8, 8]}>
                  <Col xs={12} sm={6}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f0f5ff', borderRadius: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Giá cơ bản (p)</Text>
                      <Text strong style={{ fontSize: 14 }}>{vnd(reverseResult.p_co_ban)} đ</Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f9f0ff', borderRadius: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>CP Gián tiếp (B)</Text>
                      <Text strong style={{ fontSize: 14 }}>{vnd(reverseResult.b)} đ</Text>
                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                        ({vnd(reverseResult.b_per_m2)} đ/m²)
                      </Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#fffbe6', borderRadius: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Hao hụt / LN</Text>
                      <Text strong style={{ fontSize: 13 }}>
                        {(reverseResult.e_pct * 100).toFixed(0)}% / {(reverseResult.c_pct * 100).toFixed(1)}%
                      </Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#fff7e6', borderRadius: 4 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Diện tích</Text>
                      <Text strong style={{ fontSize: 13 }}>{reverseResult.dien_tich.toFixed(4)} m²</Text>
                    </div>
                  </Col>
                </Row>

                <div style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background: reverseResult.kha_thi ? '#f6ffed' : '#fff2f0',
                  borderRadius: 6,
                  border: `1px solid ${reverseResult.kha_thi ? '#b7eb8f' : '#ffa39e'}`,
                }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text strong style={{ fontSize: 14, color: reverseResult.kha_thi ? '#237804' : '#cf1322' }}>
                        {reverseResult.kha_thi ? '✓ Khả thi' : '✗ Không khả thi'}
                        {' — '}Ngân sách giấy tối đa (A_max):
                      </Text>
                    </Col>
                    <Col>
                      <Text strong style={{ fontSize: 18, color: reverseResult.kha_thi ? '#237804' : '#cf1322' }}>
                        {vnd(reverseResult.a_max)} đ/thùng
                      </Text>
                    </Col>
                  </Row>
                  <Row justify="space-between" style={{ marginTop: 4 }}>
                    <Col>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Tương đương: {vnd(reverseResult.a_max_per_m2)} đ/m²
                      </Text>
                    </Col>
                    {result && (
                      <Col>
                        <Text
                          style={{
                            fontSize: 12,
                            color: result.chi_phi_giay <= reverseResult.a_max ? '#237804' : '#cf1322',
                          }}
                        >
                          Chi phí giấy thực tế: {vnd(result.chi_phi_giay)} đ
                          {result.chi_phi_giay <= reverseResult.a_max
                            ? ' ✓ (trong ngân sách)'
                            : ` ✗ (vượt ${vnd(result.chi_phi_giay - reverseResult.a_max)} đ)`
                          }
                        </Text>
                      </Col>
                    )}
                  </Row>
                </div>
              </div>
            )}
          </Card>

          {/* ── Nút lưu hoạch toán ────────────────────────────────── */}
          <Card size="small" style={{ textAlign: 'center', borderColor: '#52c41a' }}>
            <Space direction="vertical" size={6}>
              <Title level={5} style={{ margin: 0, color: '#237804' }}>
                Xác nhận lưu dữ liệu hoạch toán
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Lưu toàn bộ phiếu (chi phí giấy, gián tiếp, dịch vụ) vào lệnh sản xuất
                {production_order_item_id ? ` — dòng #${production_order_item_id}` : ' (không liên kết LSX)'}
              </Text>
              <Button
                type="primary"
                icon={saveMutation.isPending ? <Spin size="small" /> : <SaveOutlined />}
                loading={saveMutation.isPending}
                onClick={handleSaveHoachToan}
                style={{ marginTop: 6, minWidth: 220, background: '#52c41a', borderColor: '#52c41a' }}
                size="large"
              >
                {savedBomId ? `Lưu lại (đã lưu #${savedBomId})` : 'Lưu hoạch toán'}
              </Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  )
}
