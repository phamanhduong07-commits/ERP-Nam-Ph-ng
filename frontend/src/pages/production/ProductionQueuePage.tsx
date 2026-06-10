import { useState, useMemo, useEffect } from 'react'
import React from 'react'
import type { ApiError } from '../../api/types'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Tag, Button, Space, Typography, Row, Col,
  Statistic, Popconfirm, message, Tooltip, Badge, Divider, Alert, Drawer,
  Input, InputNumber, Popover, Select,
} from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import {
  DeleteOutlined,
  ReloadOutlined, ClockCircleOutlined, ThunderboltOutlined,
  FileTextOutlined, CalculatorOutlined, InfoCircleOutlined,
  UnorderedListOutlined, SendOutlined, HolderOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TableRowSelection } from 'antd/es/table/interface'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
import dayjs from 'dayjs'
import { productionPlansApi } from '../../api/productionPlans'
import type { QueueLine } from '../../api/productionPlans'
import { productionOrdersApi } from '../../api/productionOrders'
import { warehouseApi } from '../../api/warehouse'
import type { GiayRoll } from '../../api/warehouse'
import { LOAI_LAN_LABELS } from '../../api/quotes'
import { fmtN } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"

const { Text, Title } = Typography

const POOL_PLAN_SO = 'KHSX-POOL'

const TRANG_THAI_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  cho:       { label: 'Chờ',        color: 'default',    icon: <ClockCircleOutlined /> },
  dang_chay: { label: 'Đang chạy', color: 'processing', icon: <ThunderboltOutlined /> },
}

const TAKE_UP: Record<string, number> = { E: 1.22, B: 1.32, C: 1.45, A: 1.56 }

// ─── Layer definition ─────────────────────────────────────────────────────────

interface LayerDef {
  posIdx: number        // vị trí lớp: 0=MN 1=S1 2=MG/MT 3=S2 4=M2 5=S3 6=MT
  label: string         // Mặt ngoài / Sóng B / Mặt giữa …
  lbl: string           // MN / S-B / MG / MT …
  ma: string | null
  dl: number | null
  isSong: boolean
  songType: string | null
  kg: number
}

function getSongLetters(s: string | null | undefined) {
  return (s ?? '').replace(/-/g, '').toUpperCase().split('').filter(Boolean)
}

function calcLayerKgs(r: QueueLine): LayerDef[] {
  const khoGiay = Number(r.kho_giay) || 0
  const daiTt   = Number(r.dai_tt)   || 0
  const soDao   = r.so_dao || 1
  const beConBe = r.be_so_con && r.be_so_con > 1 ? r.be_so_con : 1
  const soLuong = Number(r.so_luong_ke_hoach)
  const khoMoiCon = soDao > 0 && khoGiay > 0 ? khoGiay / (soDao * beConBe) : 0
  const songs = getSongLetters(r.to_hop_song)
  const soLop = r.so_lop ?? 3

  const defs: Omit<LayerDef, 'kg'>[] = [
    { posIdx: 0, label: 'Mặt ngoài',                          lbl: 'MN',          ma: r.mat,    dl: r.mat_dl,    isSong: false, songType: null },
    { posIdx: 1, label: `Sóng ${songs[0] ?? '?'}`,            lbl: `S-${songs[0] ?? '?'}`, ma: r.song_1, dl: r.song_1_dl, isSong: true,  songType: songs[0] ?? null },
    { posIdx: 2, label: soLop <= 3 ? 'Mặt trong' : 'Mặt giữa', lbl: soLop <= 3 ? 'MT' : 'MG', ma: r.mat_1, dl: r.mat_1_dl, isSong: false, songType: null },
    ...(soLop >= 5 ? [
      { posIdx: 3, label: `Sóng ${songs[1] ?? '?'}`, lbl: `S-${songs[1] ?? '?'}`, ma: r.song_2, dl: r.song_2_dl, isSong: true,  songType: songs[1] ?? null },
      { posIdx: 4, label: soLop === 5 ? 'Mặt trong' : 'Mặt 2', lbl: soLop === 5 ? 'MT' : 'M2', ma: r.mat_2, dl: r.mat_2_dl, isSong: false, songType: null },
    ] : []),
    ...(soLop >= 7 ? [
      { posIdx: 5, label: `Sóng ${songs[2] ?? '?'}`, lbl: `S-${songs[2] ?? '?'}`, ma: r.song_3, dl: r.song_3_dl, isSong: true,  songType: songs[2] ?? null },
      { posIdx: 6, label: 'Mặt trong', lbl: 'MT', ma: r.mat_3, dl: r.mat_3_dl, isSong: false, songType: null },
    ] : []),
  ]

  return defs.map(l => {
    const take = l.isSong ? (TAKE_UP[l.songType ?? ''] ?? 1.0) : 1.0
    const area = khoMoiCon > 0 && daiTt > 0 ? (khoMoiCon * daiTt * take) / 10000 : 0
    const kg = area > 0 && (l.dl ?? 0) > 0
      ? Math.round((l.dl! * area / 1000) * soLuong * 10) / 10
      : 0
    return { ...l, kg }
  })
}

// ─── Map posIdx → field name ──────────────────────────────────────────────────

const LAYER_FIELDS: Record<number, { maField: string; dlField: string }> = {
  0: { maField: 'mat',    dlField: 'mat_dl' },
  1: { maField: 'song_1', dlField: 'song_1_dl' },
  2: { maField: 'mat_1',  dlField: 'mat_1_dl' },
  3: { maField: 'song_2', dlField: 'song_2_dl' },
  4: { maField: 'mat_2',  dlField: 'mat_2_dl' },
  5: { maField: 'song_3', dlField: 'song_3_dl' },
  6: { maField: 'mat_3',  dlField: 'mat_3_dl' },
}

interface LayerEditBlockProps {
  layer: LayerDef
  orderId: number | null
  itemId: number
  onSaved: () => void
}

function LayerEditBlock({ layer, orderId, itemId, onSaved }: LayerEditBlockProps) {
  const [open, setOpen] = useState(false)
  const [maVal, setMaVal] = useState(layer.ma ?? '')
  const [dlVal, setDlVal] = useState<number | null>(layer.dl)

  const saveMut = useMutation({
    mutationFn: () => {
      if (!orderId) throw new Error('Không có order ID')
      const { maField, dlField } = LAYER_FIELDS[layer.posIdx]
      return productionOrdersApi.updateItemSxParams(orderId, itemId, {
        [maField]: maVal.trim() || null,
        [dlField]: dlVal,
      })
    },
    onSuccess: () => { message.success('Đã cập nhật'); setOpen(false); onSaved() },
    onError: () => message.error('Lỗi cập nhật'),
  })

  const handleOpenChange = (v: boolean) => {
    if (!v) return  // chỉ cho mở, không tự đóng khi click ra ngoài
    setMaVal(layer.ma ?? ''); setDlVal(layer.dl)
    setOpen(true)
  }

  const popContent = (
    <Space direction="vertical" size={6} style={{ width: 150 }}>
      <Input
        size="small" value={maVal} placeholder="Mã ký hiệu (LB, 87...)"
        onChange={e => setMaVal(e.target.value)}
        onPressEnter={() => saveMut.mutate()}
      />
      <InputNumber
        size="small" style={{ width: '100%' }} value={dlVal}
        placeholder="ĐL (g/m²)" min={0} max={600}
        onChange={v => setDlVal(v as number | null)}
      />
      <Space size={4}>
        <Button size="small" type="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Lưu</Button>
        <Button size="small" onClick={() => setOpen(false)}>Hủy</Button>
      </Space>
    </Space>
  )

  return (
    <Popover
      open={open} onOpenChange={handleOpenChange} trigger="click"
      title={<span style={{ fontSize: 12 }}>{layer.label}</span>}
      content={popContent}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: layer.ma ? (layer.isSong ? '#e6f4ff' : '#f6ffed') : '#fafafa',
        border: `1px solid ${layer.ma ? (layer.isSong ? '#91caff' : '#95de64') : '#e0e0e0'}`,
        borderRadius: 4, padding: '1px 5px', cursor: 'pointer',
        fontSize: 11, whiteSpace: 'nowrap', userSelect: 'none',
      }}>
        {layer.ma ? (
          <>
            <span style={{ color: '#262626', marginLeft: 3 }}>{layer.ma}</span>
            {layer.dl != null && <span style={{ color: '#8c8c8c', marginLeft: 2 }}>{Number(layer.dl)}g</span>}
          </>
        ) : (
          <span style={{ color: '#bfbfbf', marginLeft: 2, fontStyle: 'italic' }}>—</span>
        )}
      </div>
    </Popover>
  )
}

// ─── Kg summary — KHÔNG gộp lớp: mỗi (posIdx, ma, dl) là 1 dòng riêng ────────

interface LayerKgEntry {
  posIdx: number
  label: string
  lbl: string
  isSong: boolean
  songType: string | null
  ma: string
  dl: number | null
  totalKg: number
}

function calcKgSummary(rows: QueueLine[]): LayerKgEntry[] {
  const map = new Map<string, LayerKgEntry>()
  for (const r of rows) {
    for (const l of calcLayerKgs(r)) {
      if (!l.ma || l.kg <= 0) continue
      // key = vị trí lớp + mã giấy + định lượng — không bao giờ gộp lớp khác nhau
      const key = `${l.posIdx}||${l.ma}||${l.dl ?? ''}`
      const ex = map.get(key)
      if (ex) {
        ex.totalKg = Math.round((ex.totalKg + l.kg) * 10) / 10
      } else {
        map.set(key, {
          posIdx: l.posIdx, label: l.label, lbl: l.lbl,
          isSong: l.isSong, songType: l.songType,
          ma: l.ma, dl: l.dl, totalKg: l.kg,
        })
      }
    }
  }
  // Sắp xếp theo vị trí lớp, rồi theo mã giấy
  return Array.from(map.values()).sort((a, b) =>
    a.posIdx !== b.posIdx ? a.posIdx - b.posIdx : a.ma.localeCompare(b.ma)
  )
}

// ─── Mét tới theo khổ ─────────────────────────────────────────────────────────

interface MtByKhoEntry { kho: number; soLenh: number; totalMT: number }

function calcSoTam(slKeHoach: number, soDao: number | null, beConBe: number = 1, soLanCat: number = 1): number {
  const conMoiPhoi = (soDao && soDao > 0 ? soDao : 1) * Math.max(1, beConBe) * Math.max(1, soLanCat)
  return Math.ceil(slKeHoach / conMoiPhoi)
}

function calcMetToi(soTam: number, daiTt: number | null): number {
  if (!daiTt) return 0
  return Math.round(soTam * daiTt) / 100
}

function calcMtByKho(rows: QueueLine[]): MtByKhoEntry[] {
  const map = new Map<number, MtByKhoEntry>()
  for (const r of rows) {
    const kho = Number(r.kho_giay) || 0
    if (!kho) continue
    const soLanCat = r.so_lan_cat && r.so_lan_cat > 1 ? r.so_lan_cat : 1
    const soTam = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao, r.be_so_con ?? 1, soLanCat)
    const mt    = calcMetToi(soTam, (r.dai_tt ?? 0) * soLanCat)
    const ex    = map.get(kho)
    if (ex) { ex.soLenh++; ex.totalMT = Math.round((ex.totalMT + mt) * 10) / 10 }
    else    { map.set(kho, { kho, soLenh: 1, totalMT: Math.round(mt * 10) / 10 }) }
  }
  return Array.from(map.values()).sort((a, b) => a.kho - b.kho)
}

// ─── Kg theo mã giấy (gộp tất cả lớp) ────────────────────────────────────────

interface KgByMaEntry { ma: string; dl: number | null; totalKg: number }

function calcKgByMa(rows: QueueLine[]): KgByMaEntry[] {
  const map = new Map<string, KgByMaEntry>()
  for (const r of rows) {
    for (const l of calcLayerKgs(r)) {
      if (!l.ma || l.kg <= 0) continue
      const key = `${l.ma}||${l.dl ?? ''}`
      const ex  = map.get(key)
      if (ex) ex.totalKg = Math.round((ex.totalKg + l.kg) * 10) / 10
      else    map.set(key, { ma: l.ma, dl: l.dl, totalKg: Math.round(l.kg * 10) / 10 })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ma.localeCompare(b.ma))
}

// ─── Draggable row ────────────────────────────────────────────────────────────

interface DraggableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string
}

function DraggableRow({ children, ...props }: DraggableRowProps) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: props['data-row-key'] })

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#e6f4ff' } : {}),
  }

  return (
    <tr {...props} ref={setNodeRef} style={style} {...attributes}>
      {React.Children.map(children, child => {
        if ((child as React.ReactElement).key === 'sort') {
          return React.cloneElement(child as React.ReactElement, {
            children: (
              <HolderOutlined
                ref={setActivatorNodeRef}
                style={{ touchAction: 'none', cursor: 'grab', color: '#bfbfbf', fontSize: 14 }}
                {...listeners}
              />
            ),
          })
        }
        return child
      })}
    </tr>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductionQueuePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Antd table filter state
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({})

  // Ordered lines for drag-and-drop (synced from query)
  const [orderedLines, setOrderedLines] = useState<QueueLine[]>([])

  // Filters for "Kg theo mã giấy" panel
  const [panelFilterMa, setPanelFilterMa] = useState('')
  const [panelFilterDl, setPanelFilterDl] = useState<number | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [tonDetailOpen, setTonDetailOpen] = useState(false)
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [expandedRollRows, setExpandedRollRows] = useState<Set<string>>(new Set())

  const handleTableChange = (
    _pagination: unknown,
    filters: Record<string, FilterValue | null>,
    _sorter: SorterResult<QueueLine> | SorterResult<QueueLine>[],
  ) => {
    setFilteredInfo(filters)
    setSelectedKeys([])
  }

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: allLines = [], isLoading, refetch } = useQuery({
    queryKey: ['production-queue'],
    queryFn: () => productionPlansApi.getQueue().then(r => r.data),
    refetchInterval: 30_000,
  })

  // Sync ordered list when query refreshes
  useEffect(() => { setOrderedLines(allLines) }, [allLines])

  // dnd-kit sensors (require 5px distance to distinguish click from drag)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const reorderMut = useMutation({
    mutationFn: (items: { id: number; thu_tu: number }[]) =>
      productionPlansApi.reorderQueue(items),
    onError: () => {
      message.error('Lưu thứ tự thất bại')
      setOrderedLines(allLines) // rollback
    },
  })

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setOrderedLines(prev => {
      const oldIdx = prev.findIndex(l => String(l.id) === String(active.id))
      const newIdx = prev.findIndex(l => String(l.id) === String(over.id))
      if (oldIdx < 0 || newIdx < 0) return prev
      const next = arrayMove(prev, oldIdx, newIdx)
      reorderMut.mutate(next.map((l, i) => ({ id: l.id, thu_tu: i + 1 })))
      return next
    })
  }

  // Các giá trị unique để build bộ lọc cột
  const khoOptions = useMemo(() => {
    const s = new Set<number>()
    allLines.forEach(l => { if (l.kho_giay) s.add(Number(l.kho_giay)) })
    return Array.from(s).sort((a, b) => a - b).map(v => ({ text: `${v} cm`, value: v }))
  }, [allLines])

  const loaiLanOptions = useMemo(() => {
    const s = new Set<string>()
    allLines.forEach(l => { if (l.loai_lan) s.add(l.loai_lan) })
    return Array.from(s).sort().map(v => ({ text: LOAI_LAN_LABELS[v] ?? v, value: v }))
  }, [allLines])

  const songOptions = useMemo(() => {
    const s = new Set<string>()
    allLines.forEach(l => { if (l.to_hop_song) s.add(l.to_hop_song) })
    return Array.from(s).sort().map(v => ({ text: v, value: v }))
  }, [allLines])

  const ttOptions = [
    { text: 'Chờ chạy',   value: 'cho' },
    { text: 'Đang chạy',  value: 'dang_chay' },
  ]

  // ── selected & planning ───────────────────────────────────────────────────
  const selectedRows = useMemo(
    () => allLines.filter(l => selectedKeys.includes(l.id)),
    [allLines, selectedKeys],
  )

  const selectedNhapPlans = useMemo(() => {
    const map = new Map<number, { plan_id: number; so_ke_hoach: string; count: number }>()
    selectedRows.forEach(r => {
      if (r.plan_trang_thai === 'nhap' && r.so_ke_hoach !== POOL_PLAN_SO) {
        const cur = map.get(r.plan_id)
        if (cur) cur.count++
        else map.set(r.plan_id, { plan_id: r.plan_id, so_ke_hoach: r.so_ke_hoach, count: 1 })
      }
    })
    return Array.from(map.values())
  }, [selectedRows])

  const selectedPoolLines = useMemo(
    () => selectedRows.filter(r => r.plan_trang_thai === 'nhap' && r.so_ke_hoach === POOL_PLAN_SO && r.trang_thai === 'cho'),
    [selectedRows],
  )

  // Xác định tập dòng dùng để tính vật liệu: ưu tiên tích chọn, fallback lọc tất cả khi có filter
  const hasFilter = Object.values(filteredInfo).some(v => v && v.length > 0)
  // Filtered lines (apply filter manually for planning panel)
  const filteredLines = useMemo(() => {
    return allLines.filter(l => {
      const fKho     = filteredInfo['kho_giay']
      const fSong    = filteredInfo['to_hop_song']
      const fLan     = filteredInfo['loai_lan']
      const fTT      = filteredInfo['trang_thai']
      if (fKho     && fKho.length     && !fKho.includes(Number(l.kho_giay)))     return false
      if (fSong    && fSong.length    && !fSong.includes(l.to_hop_song ?? ''))    return false
      if (fLan     && fLan.length     && !fLan.includes(l.loai_lan ?? ''))        return false
      if (fTT      && fTT.length      && !fTT.includes(l.trang_thai))             return false
      return true
    })
  }, [allLines, filteredInfo])

  const planningRows = selectedRows.length > 0 ? selectedRows : hasFilter ? filteredLines : allLines
  const kgSummary    = useMemo(() => calcKgSummary(planningRows), [planningRows])
  const totalKg      = kgSummary.reduce((s, p) => s + p.totalKg, 0)
  const mtByKho      = useMemo(() => calcMtByKho(planningRows), [planningRows])
  const kgByMa       = useMemo(() => calcKgByMa(planningRows), [planningRows])
  const totalMT      = mtByKho.reduce((s, e) => s + e.totalMT, 0)
  const showPanel    = planningRows.length > 0

  // Unique ĐL options (for filter)
  const panelDlOptions = useMemo(() => {
    const s = new Set<number>()
    kgByMa.forEach(e => { if (e.dl != null) s.add(e.dl) })
    return Array.from(s).sort((a, b) => a - b)
  }, [kgByMa])

  // Kg by kho group (auto-grouped, filter by ma/dl only)
  const kgByKhoGroups = useMemo(() => {
    const khoMap = new Map<number, QueueLine[]>()
    for (const r of planningRows) {
      const kho = Number(r.kho_giay) || 0
      if (!kho) continue
      const arr = khoMap.get(kho) ?? []
      arr.push(r)
      khoMap.set(kho, arr)
    }
    return Array.from(khoMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([kho, rows]) => {
        let kgList = calcKgByMa(rows)
        if (panelFilterMa.trim()) {
          const q = panelFilterMa.trim().toLowerCase()
          kgList = kgList.filter(e => e.ma.toLowerCase().includes(q))
        }
        if (panelFilterDl != null) {
          kgList = kgList.filter(e => e.dl === panelFilterDl)
        }
        const soLenh = rows.length
        const totalKgGroup = Math.round(kgList.reduce((s, e) => s + e.totalKg, 0))
        return { kho, kgList, soLenh, totalKgGroup }
      })
      .filter(g => g.kgList.length > 0)
  }, [planningRows, panelFilterMa, panelFilterDl])

  // ── tồn kho giấy để đối chiếu ────────────────────────────────────────────
  const { data: tonKhoGiay = [] } = useQuery({
    queryKey: ['ton-kho-giay'],
    queryFn: () => warehouseApi.getTonKhoGiay().then(r => r.data),
    staleTime: 60_000,
  })

  // Gộp tồn kho theo (ma + kho_cm) — dl bỏ khỏi key vì lệnh SX có thể dùng dl khác lot
  const inventoryByMaKho = useMemo(() => {
    const map = new Map<string, { ton_luong: number; so_cuon: number }>()
    for (const row of tonKhoGiay) {
      const ma = row.ma_ky_hieu || row.ma_chinh
      if (!ma) continue
      const khoCm = row.kho ? Math.round(row.kho) : ''
      const key   = `${ma}||${khoCm}`
      const ex    = map.get(key)
      if (ex) {
        ex.ton_luong += row.ton_luong
        ex.so_cuon   += row.so_cuon
      } else {
        map.set(key, { ton_luong: row.ton_luong, so_cuon: row.so_cuon })
      }
    }
    return map
  }, [tonKhoGiay])

  // ── per-roll data khi mở drawer ───────────────────────────────────────────
  const { data: allRollsRaw = [] } = useQuery({
    queryKey: ['giay-rolls-active'],
    queryFn: () => warehouseApi.listGiayRolls().then(r => r.data),
    staleTime: 60_000,
  })

  const activeRolls = useMemo(
    () => allRollsRaw.filter(r => r.trang_thai === 'trong_kho' || r.trang_thai === 'dang_dung'),
    [allRollsRaw]
  )

  const rollsByKyHieu = useMemo(() => {
    const map = new Map<string, GiayRoll[]>()
    for (const r of activeRolls) {
      const key = r.ky_hieu ?? ''
      if (!key) continue
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [activeRolls])

  // ── drawer: tồn chi tiết theo mã ký hiệu ─────────────────────────────────
  const maInPlan = useMemo(() => new Set(kgByMa.map(e => e.ma)), [kgByMa])

  const canKgByMa = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of kgByMa) m.set(e.ma, (m.get(e.ma) ?? 0) + e.totalKg)
    return m
  }, [kgByMa])

  interface TonDetailRow {
    key: string
    ma: string
    dl: number | null
    khoMm: number | null
    tenKho: string | null
    canKg: number
    tonKg: number
    soCuon: number
    trangThai?: string
    children?: TonDetailRow[]
  }

  const tonDetailRows = useMemo((): TonDetailRow[] => {
    return Array.from(maInPlan).sort().map(ma => {
      const rolls = (rollsByKyHieu.get(ma) ?? [])
        .sort((a, b) =>
          ((a.kho ?? 0) - (b.kho ?? 0)) ||
          ((a.dinh_luong ?? 0) - (b.dinh_luong ?? 0)) ||
          a.barcode.localeCompare(b.barcode)
        )
      const childRows: TonDetailRow[] = rolls.map(r => ({
        key: `roll-${r.id}`,
        ma: r.barcode,
        dl: r.dinh_luong,
        khoMm: r.kho,
        tenKho: r.ten_kho,
        canKg: 0,
        tonKg: r.trong_luong_con_lai,
        soCuon: 1,
        trangThai: r.trang_thai,
      }))
      const totalTon = childRows.reduce((s, c) => s + c.tonKg, 0)
      return {
        key: `hdr-${ma}`,
        ma,
        dl:     null,
        khoMm:  null,
        tenKho: null,
        canKg:  canKgByMa.get(ma) ?? 0,
        tonKg:  totalTon,
        soCuon: childRows.length,
        children: childRows.length > 0 ? childRows : undefined,
      }
    })
  }, [rollsByKyHieu, maInPlan, canKgByMa])

  // ── mutations ─────────────────────────────────────────────────────────────

  const deleteMut = useMutation({
    mutationFn: ({ planId, lineId }: { planId: number; lineId: number }) =>
      productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError:   (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })

  const chotMut = useMutation({
    mutationFn: (planId: number) => productionPlansApi.export(planId),
    onSuccess: () => {
      message.success('Đã chốt kế hoạch — plan xuất hiện trong trang KHSX')
      qc.invalidateQueries({ queryKey: ['production-queue'] })
      qc.invalidateQueries({ queryKey: ['production-plans'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi chốt kế hoạch'),
  })

  // ── promote pool line to KHSX ─────────────────────────────────────────────
  const promoteFromPoolMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.promoteFromPool(lineId),
    onSuccess: (res) => {
      message.success(`Đã đưa vào ${res.data.so_ke_hoach}`)
      qc.invalidateQueries({ queryKey: ['production-queue'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })

  // Nhóm các plan còn nhap (chưa chốt) từ queue lines
  const nhapPlans = useMemo(() => {
    const map = new Map<number, { plan_id: number; so_ke_hoach: string; count: number }>()
    allLines.forEach(l => {
      if (l.plan_trang_thai === 'nhap' && l.so_ke_hoach !== POOL_PLAN_SO) {
        const cur = map.get(l.plan_id)
        if (cur) cur.count++
        else map.set(l.plan_id, { plan_id: l.plan_id, so_ke_hoach: l.so_ke_hoach, count: 1 })
      }
    })
    return Array.from(map.values())
  }, [allLines])

  const handleBatchTanDung = async () => {
    const orderIds = selectedRows
      .map(r => r.production_order_id)
      .filter((id): id is number => id != null)
    const uniqueIds = [...new Set(orderIds)]
    if (!uniqueIds.length) { message.warning('Không tìm thấy lệnh SX liên kết'); return }
    setIsBatchLoading(true)
    try {
      const { data: res } = await productionOrdersApi.batchSetTanDung(uniqueIds)
      message.success(`Đã đánh dấu ${res.updated} lệnh SX sang Tận dụng phôi`)
      setSelectedKeys([])
      qc.invalidateQueries({ queryKey: ['production-queue'] })
      qc.invalidateQueries({ queryKey: ['tan-dung-plan'] })
    } catch {
      message.error('Cập nhật thất bại')
    } finally {
      setIsBatchLoading(false)
    }
  }

  const handleBatchPromote = async () => {
    if (!selectedPoolLines.length) return
    setIsBatchLoading(true)
    try {
      await Promise.all(selectedPoolLines.map(r => productionPlansApi.promoteFromPool(r.id)))
      message.success(`Đã đưa ${selectedPoolLines.length} lệnh lên KHSX`)
      setSelectedKeys([])
      qc.invalidateQueries({ queryKey: ['production-queue'] })
    } catch {
      message.error('Có lỗi khi đưa lệnh lên KHSX')
    } finally {
      setIsBatchLoading(false)
    }
  }

  const choCnt      = allLines.filter(l => l.trang_thai === 'cho').length
  const dangChayCnt = allLines.filter(l => l.trang_thai === 'dang_chay').length

  const rowSelection: TableRowSelection<QueueLine> = {
    selectedRowKeys: selectedKeys,
    onChange: keys => setSelectedKeys(keys),
    getCheckboxProps: r => ({ disabled: r.trang_thai !== 'cho' }),
  }

  // ── columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<QueueLine> = [
    {
      key: 'sort',
      width: 32,
      align: 'center',
      render: () => null,  // replaced by DraggableRow
    },
    {
      title: 'STT',
      dataIndex: 'thu_tu',
      width: 44,
      align: 'center',
      render: v => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 108,
      render: (v, r) => v
        ? <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }}
            onClick={() => navigate(`/production/orders/${r.production_order_item_id}`)}>
            {v}
          </Button>
        : '—',
    },
    {
      title: 'Mã KH',
      width: 80,
      render: (_, r) => (
        <Tooltip title={r.ten_hang || undefined}>
          <Text style={{ fontSize: 11 }}>{r.ma_kh || '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Kích thước',
      width: 110,
      render: (_, r) => r.dai ? (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{Number(r.dai)}×{Number(r.rong ?? 0)}×{Number(r.cao ?? 0)}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>{r.loai_thung} · {r.so_lop}L</Text>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Loại lằn',
      dataIndex: 'loai_lan',
      width: 106,
      align: 'center',
      filters: loaiLanOptions,
      filteredValue: filteredInfo['loai_lan'] || null,
      onFilter: (value, r) => r.loai_lan === value,
      render: v => v
        ? <Tag color="volcano" style={{ fontSize: 11 }}>{LOAI_LAN_LABELS[v] ?? v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'In / Gia công',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, r: QueueLine) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {r.loai_in && r.loai_in !== 'khong_in'
            ? <span style={{ fontSize: 10 }}>
                {r.loai_in === 'flexo' ? 'Flexo' : r.loai_in === 'ky_thuat_so' ? 'KTS' : r.loai_in}
                {r.so_mau ? ` ${r.so_mau}M` : ''}
              </span>
            : <span style={{ color: '#d9d9d9', fontSize: 10 }}>Không in</span>}
          {r.c_tham && r.c_tham !== 'Không' && (
            <Tag color="cyan" style={{ margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
              CT {r.c_tham.replace('mặt', 'm').replace(/\s+/g, '')}
            </Tag>
          )}
          {r.can_man && r.can_man !== 'Không' && (
            <Tag color="purple" style={{ margin: 0, fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
              CM {r.can_man.replace('mặt', 'm').replace(/\s+/g, '')}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 70,
      align: 'center',
      filters: songOptions,
      filteredValue: filteredInfo['to_hop_song'] || null,
      onFilter: (value, r) => r.to_hop_song === value,
      render: v => v
        ? <Tag color="purple" style={{ fontSize: 13, fontWeight: 700, padding: '0 5px' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khổ (cm)',
      dataIndex: 'kho_giay',
      width: 88,
      align: 'center',
      filters: khoOptions,
      filteredValue: filteredInfo['kho_giay'] || null,
      onFilter: (value, r) => Number(r.kho_giay) === Number(value),
      render: v => v
        ? <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{fmtN(v, 1)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt (cm)',
      dataIndex: 'dai_tt',
      width: 80,
      align: 'center',
      render: (v, r) => {
        if (!v) return <Text type="secondary">—</Text>
        const eff = Number(v) * (r.so_lan_cat ?? 1)
        return <Text strong style={{ fontSize: 13 }}>{fmtN(eff, 1)}</Text>
      },
    },
    {
      title: 'QCCL',
      width: 110,
      align: 'center',
      render: (_, r) => {
        if (!r.cao || Number(r.cao) <= 0 || !r.rong) return <Text type="secondary">—</Text>
        const soLop = r.so_lop ?? 3
        const allow = soLop <= 3 ? 0.1 : soLop <= 5 ? 0.2 : 0.3
        const side  = Math.round((Number(r.rong) / 2 + allow) * 10) / 10
        return (
          <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#d46b08', fontWeight: 600 }}>
            {fmtN(side, 1)}+{fmtN(r.cao, 1)}+{fmtN(side, 1)}
          </Text>
        )
      },
    },
    {
      title: 'Dao',
      dataIndex: 'so_dao',
      width: 50,
      align: 'center',
      render: v => v ? <Text strong style={{ fontSize: 13 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lần chạy',
      width: 70,
      align: 'center',
      render: (_, r) => {
        const beN = r.be_so_con && r.be_so_con > 1 ? r.be_so_con : 1
        const slc = r.so_lan_cat && r.so_lan_cat > 1 ? r.so_lan_cat : 1
        const n = r.so_dao && r.so_dao > 0 ? Math.ceil(Number(r.so_luong_ke_hoach) / (r.so_dao * beN * slc)) : null
        return n
          ? <Text style={{ fontSize: 12, color: '#52c41a' }}>{n.toLocaleString('vi-VN')}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'SL KH',
      dataIndex: 'so_luong_ke_hoach',
      width: 68,
      align: 'right',
      render: v => <Text strong style={{ fontSize: 12 }}>{Number(v).toLocaleString('vi-VN')}</Text>,
    },
    {
      title: 'Kết cấu giấy',
      width: 360,
      onCell: () => ({ style: { maxWidth: 360, overflow: 'hidden', padding: '4px 6px' } }),
      render: (_, r) => {
        const layers = calcLayerKgs(r)
        if (!layers.length) return <Text type="secondary">—</Text>
        return (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 3, overflow: 'hidden' }}>
            {layers.map((l, i) => (
              <LayerEditBlock
                key={i} layer={l}
                orderId={r.production_order_id}
                itemId={r.production_order_item_id}
                onSaved={() => qc.invalidateQueries({ queryKey: ['production-queue'] })}
              />
            ))}
          </div>
        )
      },
    },
    {
      title: 'Kg',
      width: 68,
      align: 'right',
      render: (_, r) => {
        const layers = calcLayerKgs(r)
        const total  = layers.reduce((s, l) => s + l.kg, 0)
        if (total <= 0) return <Text type="secondary">—</Text>
        return (
          <Tooltip
            title={
              <div style={{ fontSize: 12 }}>
                {layers.filter(l => l.kg > 0).map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: l.isSong ? '#91caff' : '#95de64' }}>{l.lbl} {l.ma}</span>
                    <b>{l.kg.toFixed(1)} kg</b>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
                  Tổng: {total.toFixed(1)} kg
                </div>
              </div>
            }
          >
            <Text strong style={{ fontSize: 12, color: '#fa8c16', cursor: 'help' }}>
              {total.toFixed(0)} kg
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 78,
      align: 'center',
      render: v => {
        if (!v) return <Text type="secondary">—</Text>
        const d = dayjs(v)
        const late = d.isBefore(dayjs(), 'day')
        return <Text style={{ fontSize: 11, color: late ? '#ff4d4f' : undefined }}>{d.format('DD/MM/YY')}</Text>
      },
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      filters: ttOptions,
      filteredValue: filteredInfo['trang_thai'] || null,
      onFilter: (value, r) => r.trang_thai === value,
      render: (v, r) => {
        const cfg = TRANG_THAI_CFG[v] ?? { label: v, color: 'default', icon: null }
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
            {r.plan_trang_thai === 'nhap' && r.so_ke_hoach === POOL_PLAN_SO && (
              <Tag color="default" style={{ fontSize: 10, lineHeight: '14px', color: '#8c8c8c' }}>Hàng chờ</Tag>
            )}
            {r.plan_trang_thai === 'nhap' && r.so_ke_hoach !== POOL_PLAN_SO && (
              <Tag color="warning" style={{ fontSize: 10, lineHeight: '14px' }}>Chưa chốt KH</Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Hành động',
      width: 130,
      align: 'center',
      fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          {r.plan_trang_thai === 'nhap' && r.trang_thai === 'cho' && r.so_ke_hoach !== POOL_PLAN_SO && (
            <Tooltip title={`Chốt kế hoạch ${r.so_ke_hoach} — xuất hiện bên KHSX`}>
              <Popconfirm
                title={`Chốt kế hoạch ${r.so_ke_hoach}?`}
                description="Plan sẽ xuất hiện trong trang Kế hoạch SX."
                onConfirm={() => chotMut.mutate(r.plan_id)}
                okText="Chốt"
                okButtonProps={{ style: { background: '#1677ff' } }}
              >
                <Button size="small" type="primary" icon={<SendOutlined />} loading={chotMut.isPending}>
                  Chốt KH
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
          {r.plan_trang_thai === 'nhap' && r.so_ke_hoach === POOL_PLAN_SO && r.trang_thai === 'cho' && (
            <Tooltip title="Hệ thống tự xác định xưởng và ghép vào KHSX hôm nay">
              <Popconfirm
                title="Đưa lệnh về KHSX?"
                description="Tự ghép vào kế hoạch cùng xưởng hôm nay (hoặc tạo mới)."
                onConfirm={() => promoteFromPoolMut.mutate(r.id)}
                okText="Xác nhận"
              >
                <Button size="small" type="primary" icon={<SendOutlined />} loading={promoteFromPoolMut.isPending}>
                  Lên KHSX
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
          {r.trang_thai === 'cho' && (
            <Tooltip title="Xóa khỏi hàng chờ">
              <Popconfirm title="Xóa dòng này?" onConfirm={() => deleteMut.mutate({ planId: r.plan_id, lineId: r.id })} okText="Xóa" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ── expanded row ──────────────────────────────────────────────────────────
  const expandedRowRender = (r: QueueLine) => {
    const layers = calcLayerKgs(r)
    if (!layers.some(l => l.ma)) return <Text type="secondary">Chưa có thông tin kết cấu giấy</Text>
    const total = layers.reduce((s, l) => s + l.kg, 0)
    const khoGiay   = Number(r.kho_giay) || 0
    const soDao     = r.so_dao || 1
    const beConBe   = r.be_so_con && r.be_so_con > 1 ? r.be_so_con : 1
    const daiTt     = Number(r.dai_tt) || 0
    const khoMoiCon = soDao > 0 ? khoGiay / (soDao * beConBe) : 0
    return (
      <div style={{ padding: '4px 0 4px 40px' }}>
        <Text strong style={{ fontSize: 12 }}>
          Chi tiết — Khổ {khoGiay} cm / Cắt {daiTt} cm / {soDao} dao / {Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')} thùng
        </Text>
        <table style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['Lớp', 'Loại', 'Mã giấy', 'ĐL (g/m²)', 'Hệ số sóng', 'Diện tích/c (m²)', 'Kg'].map(h => (
                <th key={h} style={{ padding: '4px 10px', border: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {layers.map((l, i) => {
              const take = l.isSong ? (TAKE_UP[l.songType ?? ''] ?? 1.0) : 1.0
              const area = khoMoiCon > 0 && daiTt > 0 ? (khoMoiCon * daiTt * take) / 10000 : 0
              return (
                <tr key={i} style={{ background: l.isSong ? '#f0f5ff' : undefined }}>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0' }}>{l.label}</td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Tag color={l.isSong ? 'blue' : 'green'} style={{ margin: 0 }}>
                      {l.isSong ? `Sóng ${l.songType}` : 'Mặt'}
                    </Tag>
                  </td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', fontWeight: 600 }}>{l.ma || '—'}</td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'right' }}>{l.dl ?? '—'}</td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    {l.isSong ? (TAKE_UP[l.songType ?? '']?.toFixed(2) ?? '—') : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#595959' }}>
                    {area > 0 ? area.toFixed(4) : '—'}
                  </td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#1677ff', fontWeight: 600 }}>
                    {l.kg > 0 ? `${l.kg.toFixed(1)} kg` : '—'}
                  </td>
                </tr>
              )
            })}
            <tr style={{ background: '#fffbe6' }}>
              <td colSpan={6} style={{ padding: '4px 10px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700 }}>Tổng</td>
              <td style={{ padding: '4px 10px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#fa8c16', fontWeight: 700 }}>
                {total.toFixed(1)} kg
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <>
    <div>
      {/* ── Header ── */}
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Kế hoạch sản xuất chờ
            {choCnt > 0 && <Badge count={choCnt} style={{ marginLeft: 8 }} />}
          </Title>
        </Col>
        <Col>
          <Space>
            {hasFilter && (
              <Button size="small" onClick={() => { setFilteredInfo({}); setSelectedKeys([]) }}>
                Xóa bộ lọc
              </Button>
            )}
            {selectedKeys.length > 0 && (
              <>
                <Tag color="blue">Đã chọn {selectedKeys.length} dòng</Tag>
                {selectedNhapPlans.map(p => (
                  <Popconfirm
                    key={p.plan_id}
                    title={`Chốt kế hoạch ${p.so_ke_hoach}?`}
                    description={`${p.count} lệnh sẽ xuất hiện trong trang Kế hoạch SX.`}
                    onConfirm={() => chotMut.mutate(p.plan_id)}
                    okText="Chốt"
                    okButtonProps={{ style: { background: '#1677ff' } }}
                  >
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      loading={chotMut.isPending}
                    >
                      Chốt KH {p.so_ke_hoach}
                    </Button>
                  </Popconfirm>
                ))}
                {selectedPoolLines.length > 0 && (
                  <Popconfirm
                    title={`Đưa ${selectedPoolLines.length} lệnh hàng chờ lên KHSX?`}
                    description="Hệ thống tự ghép vào kế hoạch cùng xưởng hôm nay."
                    onConfirm={handleBatchPromote}
                    okText="Xác nhận"
                  >
                    <Button size="small" type="primary" icon={<SendOutlined />} loading={isBatchLoading}>
                      Lên KHSX ({selectedPoolLines.length})
                    </Button>
                  </Popconfirm>
                )}
                <Popconfirm
                  title={`Đánh dấu ${selectedKeys.length} lệnh SX là "Tận dụng phôi"?`}
                  description="Các lệnh này sẽ xuất hiện trong trang Kế hoạch tận dụng."
                  onConfirm={handleBatchTanDung}
                  okText="Xác nhận"
                  cancelText="Huỷ"
                >
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<SendOutlined />}
                    loading={isBatchLoading}
                  >
                    Đẩy sang Tận dụng
                  </Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedKeys([])}>Bỏ chọn</Button>
              </>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* ── Kế hoạch chờ chốt ── */}
      {nhapPlans.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 12, borderColor: '#faad14', background: '#fffbe6' }}
          bodyStyle={{ padding: '8px 12px' }}
        >
          <Space wrap>
            <Text strong style={{ color: '#ad6800' }}>
              <SendOutlined style={{ marginRight: 6 }} />
              Kế hoạch chờ chốt ({nhapPlans.length}):
            </Text>
            {nhapPlans.map(p => (
              <Popconfirm
                key={p.plan_id}
                title={`Chốt kế hoạch ${p.so_ke_hoach}?`}
                description={`${p.count} lệnh sẽ xuất hiện trong trang Kế hoạch SX.`}
                onConfirm={() => chotMut.mutate(p.plan_id)}
                okText="Chốt"
                okButtonProps={{ style: { background: '#1677ff' } }}
              >
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<SendOutlined />}
                  loading={chotMut.isPending}
                >
                  {p.so_ke_hoach} · {p.count} lệnh
                </Button>
              </Popconfirm>
            ))}
          </Space>
        </Card>
      )}

      {/* ── Stats ── */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col xs={8} sm={5}>
          <Card size="small">
            <Statistic title="Chờ chạy" value={choCnt}
              valueStyle={{ color: '#8c8c8c', fontSize: 20 }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={8} sm={5}>
          <Card size="small">
            <Statistic title="Đang chạy" value={dangChayCnt}
              valueStyle={{ color: '#1677ff', fontSize: 20 }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={8} sm={5}>
          <Card size="small">
            <Statistic title="Tổng dòng" value={allLines.length} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* ── Main area ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card bodyStyle={{ padding: 0 }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedLines.map(l => String(l.id))}
                strategy={verticalListSortingStrategy}
              >
                <Table
                  locale={{ emptyText: <EmptyState size="small" /> }}
                  columns={columns}
                  dataSource={orderedLines}
                  rowKey="id"
                  loading={isLoading}
                  rowSelection={rowSelection}
                  onChange={handleTableChange}
                  expandable={{
                    expandedRowRender,
                    rowExpandable: r => !!(r.mat || r.song_1),
                  }}
                  components={{ body: { row: DraggableRow } }}
                  pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t, [s, e]) => `${s}-${e} / ${t}` }}
                  size="small"
                  tableLayout="fixed"
                  scroll={{ x: 1492 }}
                  rowClassName={r => r.trang_thai === 'dang_chay' ? 'ant-table-row-selected' : ''}
                />
              </SortableContext>
            </DndContext>
          </Card>
        </div>

        {/* ── Planning panel ── */}
        {showPanel && (
          <div style={{ width: 400, flexShrink: 0 }}>
            <Card
              size="small"
              style={{ position: 'sticky', top: 16 }}
              title={
                <Space>
                  <CalculatorOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedRows.length > 0
                      ? `${selectedRows.length} lệnh đã chọn`
                      : hasFilter
                        ? `${planningRows.length} lệnh đang lọc`
                        : `Toàn bộ ${planningRows.length} lệnh`}
                  </span>
                </Space>
              }
            >
              <Row gutter={12} style={{ marginBottom: 14 }}>
                <Col span={8}>
                  <Statistic title="Số lệnh SX" value={planningRows.length} valueStyle={{ fontSize: 20 }} />
                </Col>
                <Col span={8}>
                  <Statistic title="Tổng MT" value={totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} suffix="m"
                    valueStyle={{ fontSize: 20, color: '#1677ff' }} />
                </Col>
                <Col span={8}>
                  <Statistic title="Tổng kg" value={Math.round(totalKg).toLocaleString('vi-VN')} suffix="kg"
                    valueStyle={{ fontSize: 20, color: '#fa8c16' }} />
                </Col>
              </Row>

              <Divider style={{ margin: '10px 0 12px' }} />

              {/* ── Mét tới theo khổ ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 4, height: 16, background: '#1677ff', borderRadius: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1677ff' }}>Mét tới theo khổ</span>
              </div>
              {mtByKho.length === 0 ? (
                <div style={{ padding: '10px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  Chưa có dữ liệu khổ giấy
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#e6f4ff' }}>
                      <th style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'center' }}>Khổ (cm)</th>
                      <th style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'center' }}>Lệnh</th>
                      <th style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'right' }}>Mét tới (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mtByKho.map(e => (
                      <tr key={e.kho}>
                        <td style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'center', fontWeight: 700, color: '#1677ff', fontSize: 15 }}>
                          {e.kho}
                        </td>
                        <td style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'center', color: '#595959' }}>
                          {e.soLenh}
                        </td>
                        <td style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'right', fontWeight: 700, color: '#1677ff', fontSize: 15 }}>
                          {e.totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#e6f4ff' }}>
                      <td colSpan={2} style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'right', fontWeight: 700 }}>
                        Tổng
                      </td>
                      <td style={{ padding: '7px 10px', border: '1px solid #bae0ff', textAlign: 'right', fontWeight: 800, color: '#1677ff', fontSize: 15 }}>
                        {totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} m
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              <Divider style={{ margin: '14px 0' }} />

              {/* ── Kg theo mã giấy — tự động tập hợp theo khổ ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 4, height: 16, background: '#52c41a', borderRadius: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#389e0d', flex: 1 }}>Kg theo mã giấy</span>
                {kgByMa.length > 0 && (
                  <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setTonDetailOpen(true)} style={{ fontSize: 11 }}>
                    Chi tiết KH
                  </Button>
                )}
              </div>

              {/* Filter: mã + ĐL (khổ tự động nhóm) */}
              {kgByMa.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <Input
                    size="small" placeholder="Mã giấy" allowClear value={panelFilterMa}
                    onChange={e => setPanelFilterMa(e.target.value)} style={{ width: 100 }}
                  />
                  <Select
                    size="small" placeholder="ĐL" allowClear value={panelFilterDl ?? undefined}
                    onChange={(v: number | undefined) => setPanelFilterDl(v ?? null)} style={{ width: 90 }}
                    options={panelDlOptions.map(d => ({ label: `${d} g`, value: d }))}
                  />
                  {(panelFilterMa || panelFilterDl != null) && (
                    <Button size="small" onClick={() => { setPanelFilterMa(''); setPanelFilterDl(null) }}>✕</Button>
                  )}
                </div>
              )}

              {kgByMa.length === 0 ? (
                <div style={{ padding: '10px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  Chưa có dữ liệu kết cấu giấy
                </div>
              ) : kgByKhoGroups.length === 0 ? (
                <div style={{ padding: '10px 0', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  Không có kết quả phù hợp
                </div>
              ) : (
                <div>
                  {kgByKhoGroups.map(group => (
                    <div key={group.kho} style={{ marginBottom: 10 }}>
                      {/* Group header */}
                      <div style={{
                        background: '#e6f4ff', borderRadius: '4px 4px 0 0',
                        padding: '5px 8px', display: 'flex', justifyContent: 'space-between',
                        border: '1px solid #bae0ff', borderBottom: 'none',
                      }}>
                        <span style={{ fontWeight: 700, color: '#1677ff', fontSize: 12 }}>
                          Khổ {group.kho} cm · {group.soLenh} lệnh
                        </span>
                        <span style={{ color: '#595959', fontSize: 12, fontWeight: 600 }}>
                          {group.totalKgGroup.toLocaleString('vi-VN')} kg
                        </span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f6ffed' }}>
                            <th style={{ padding: '5px 7px', border: '1px solid #b7eb8f' }}>Mã</th>
                            <th style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'center' }}>ĐL</th>
                            <th style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right' }}>Cần (kg)</th>
                            <th style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right' }}>Tồn (kg)</th>
                            <th style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'center' }}>Cuộn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.kgList.map((p, i) => {
                            const inv = inventoryByMaKho.get(`${p.ma}||${group.kho}`)
                            const canKg = Math.round(p.totalKg)
                            const tonKg = inv ? Math.round(inv.ton_luong) : null
                            const du    = tonKg !== null && tonKg >= canKg
                            const thieu = tonKg !== null && tonKg < canKg
                            const rowBg = thieu ? '#fff1f0' : du ? '#f6ffed' : (i % 2 === 0 ? '#fff' : '#f9f9f9')
                            const rowKey = `${p.ma}||${group.kho}`
                            const isExpanded = expandedRollRows.has(rowKey)
                            const rolls = inv
                              ? (rollsByKyHieu.get(p.ma) ?? [])
                                  .filter(r => Math.round(r.kho ?? 0) === group.kho)
                                  .sort((a, b) => b.trong_luong_con_lai - a.trong_luong_con_lai)
                              : []
                            return (
                              <React.Fragment key={i}>
                                <tr
                                  style={{ background: rowBg, cursor: rolls.length > 0 ? 'pointer' : 'default' }}
                                  onClick={() => {
                                    if (!rolls.length) return
                                    setExpandedRollRows(prev => {
                                      const next = new Set(prev)
                                      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey)
                                      return next
                                    })
                                  }}
                                >
                                  <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', fontWeight: 600, fontSize: 13 }}>{p.ma}</td>
                                  <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'center', color: '#8c8c8c' }}>
                                    {p.dl != null ? p.dl : '—'}
                                  </td>
                                  <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right', fontWeight: 700, color: '#389e0d', fontSize: 13 }}>
                                    {canKg.toLocaleString('vi-VN')}
                                  </td>
                                  <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right', fontWeight: 600,
                                    color: thieu ? '#cf1322' : du ? '#389e0d' : '#8c8c8c' }}>
                                    {tonKg !== null ? tonKg.toLocaleString('vi-VN') : <span style={{ color: '#bfbfbf' }}>—</span>}
                                  </td>
                                  <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'center', color: '#595959' }}>
                                    {inv ? (
                                      <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        {inv.so_cuon}
                                        {rolls.length > 0 && (
                                          <span style={{ fontSize: 9, color: '#1677ff', lineHeight: 1 }}>{isExpanded ? '▲' : '▼'}</span>
                                        )}
                                      </span>
                                    ) : <span style={{ color: '#bfbfbf' }}>—</span>}
                                  </td>
                                </tr>
                                {isExpanded && rolls.map(roll => (
                                  <tr key={`roll-${roll.id}`} style={{ background: '#f0f5ff' }}>
                                    <td colSpan={2} style={{ padding: '3px 7px 3px 16px', border: '1px solid #d6e4ff', fontSize: 11, fontFamily: 'monospace', color: '#595959' }}>
                                      {roll.barcode}
                                      {roll.trang_thai === 'dang_dung' && (
                                        <span style={{ marginLeft: 5, fontSize: 9, color: '#1677ff' }}>●đang dùng</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '3px 7px', border: '1px solid #d6e4ff' }} />
                                    <td style={{ padding: '3px 7px', border: '1px solid #d6e4ff', textAlign: 'right', fontWeight: 600, color: '#1677ff', fontSize: 12 }}>
                                      {Math.round(roll.trong_luong_con_lai).toLocaleString('vi-VN')}
                                    </td>
                                    <td style={{ padding: '3px 7px', border: '1px solid #d6e4ff' }} />
                                  </tr>
                                ))}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f0fbe6' }}>
                            <td colSpan={2} style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right', fontWeight: 700 }}>Tổng</td>
                            <td style={{ padding: '5px 7px', border: '1px solid #b7eb8f', textAlign: 'right', fontWeight: 800, color: '#fa8c16', fontSize: 13 }}>
                              {group.totalKgGroup.toLocaleString('vi-VN')} kg
                            </td>
                            <td colSpan={2} style={{ border: '1px solid #b7eb8f' }} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                  {/* Grand total */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 2px', borderTop: '2px solid #b7eb8f' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#595959', marginRight: 8 }}>
                      {(panelFilterMa || panelFilterDl != null) ? 'Tổng lọc:' : 'Tổng cộng:'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fa8c16' }}>
                      {kgByKhoGroups.reduce((s, g) => s + g.totalKgGroup, 0).toLocaleString('vi-VN')} kg
                    </span>
                  </div>
                </div>
              )}

              <Divider style={{ margin: '14px 0 10px' }} />

              {/* Nút xem kế hoạch — điều hướng đến Plan chứa các dòng này */}
              {(() => {
                // Lấy danh sách plan_id duy nhất từ planningRows
                const planIds = [...new Set(planningRows.map(r => r.plan_id))]
                const planLabels = [...new Set(planningRows.map(r => r.so_ke_hoach).filter(Boolean))]

                if (planIds.length === 1) {
                  // Tất cả cùng 1 plan → vào thẳng plan đó
                  return (
                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      block
                      size="middle"
                      style={{ marginBottom: 8 }}
                      onClick={() => navigate(`/production/plans/${planIds[0]}`)}
                    >
                      Xem Kế hoạch {planLabels[0]}
                    </Button>
                  )
                }
                // Nhiều plan → vào danh sách plans
                return (
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    block
                    size="middle"
                    style={{ marginBottom: 8 }}
                    onClick={() => navigate('/production/plans')}
                  >
                    Xem Kế hoạch SX ({planIds.length} kế hoạch)
                  </Button>
                )
              })()}

              <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', marginBottom: 10 }}>
                {selectedRows.length > 0
                  ? `Tính theo ${selectedRows.length} dòng đã tích chọn`
                  : hasFilter
                    ? `Tính theo ${planningRows.length} dòng đang lọc`
                    : 'Tính theo toàn bộ hàng chờ'}
              </Text>
            </Card>
          </div>
        )}
      </div>
    </div>

    {/* ── Drawer: tồn kho chi tiết theo mã ký hiệu ─────────────────────── */}
    <Drawer
      title="Tồn kho chi tiết theo mã ký hiệu"
      open={tonDetailOpen}
      onClose={() => setTonDetailOpen(false)}
      width={720}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <p style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
        Hiển thị tồn kho cho{' '}
        <strong style={{ color: '#389e0d' }}>{tonDetailRows.length} mã giấy</strong>{' '}
        đang cần trong hàng chờ.
        Mở rộng từng mã để xem chi tiết theo ký hiệu.
      </p>
      <Table<TonDetailRow>
        dataSource={tonDetailRows}
        size="small"
        pagination={false}
        rowClassName={r => r.children !== undefined ? 'ton-detail-parent' : ''}
        expandable={{ defaultExpandAllRows: true }}
        columns={[
          {
            title: 'Mã / Barcode',
            dataIndex: 'ma',
            key: 'ma',
            width: 170,
            render: (val: string, row) =>
              row.children !== undefined
                ? <span style={{ fontWeight: 800, fontSize: 14, color: '#1d1d1d' }}>{val}</span>
                : (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#595959' }}>
                    {val}
                    {row.trangThai === 'dang_dung' && (
                      <Tag color="processing" style={{ marginLeft: 4, fontSize: 9, padding: '0 3px', lineHeight: '14px' }}>đang dùng</Tag>
                    )}
                  </span>
                ),
          },
          {
            title: 'ĐL (g/m²)',
            dataIndex: 'dl',
            key: 'dl',
            align: 'center',
            width: 75,
            render: (val: number | null) => val != null ? val : <span style={{ color: '#bfbfbf' }}>—</span>,
          },
          {
            title: 'Khổ (cm)',
            dataIndex: 'khoMm',
            key: 'khoMm',
            align: 'center',
            width: 75,
            render: (val: number | null) => val != null ? val : <span style={{ color: '#bfbfbf' }}>—</span>,
          },
          {
            title: 'Kho',
            dataIndex: 'tenKho',
            key: 'tenKho',
            ellipsis: true,
            render: (val: string | null) => val ?? <span style={{ color: '#bfbfbf' }}>—</span>,
          },
          {
            title: 'Cần (kg)',
            dataIndex: 'canKg',
            key: 'canKg',
            align: 'right',
            width: 85,
            render: (val: number, row) =>
              row.children !== undefined
                ? <span style={{ fontWeight: 700, color: '#389e0d' }}>{Math.round(val).toLocaleString('vi-VN')}</span>
                : null,
          },
          {
            title: 'Tồn (kg)',
            dataIndex: 'tonKg',
            key: 'tonKg',
            align: 'right',
            width: 90,
            render: (val: number, row) => {
              if (row.children !== undefined) {
                const isLow = val < row.canKg
                const color = val === 0 ? '#bfbfbf' : isLow ? '#cf1322' : '#389e0d'
                return <span style={{ fontWeight: 700, color }}>{Math.round(val).toLocaleString('vi-VN')}</span>
              }
              // leaf = 1 cuộn
              return (
                <span style={{ fontWeight: 600, color: val > 0 ? '#1677ff' : '#bfbfbf' }}>
                  {val > 0 ? Math.round(val).toLocaleString('vi-VN') : '—'}
                </span>
              )
            },
          },
          {
            title: 'Cuộn',
            dataIndex: 'soCuon',
            key: 'soCuon',
            align: 'center',
            width: 55,
            render: (val: number, row) =>
              row.children !== undefined
                ? <span style={{ fontWeight: 600 }}>{val}</span>
                : <span style={{ color: '#bfbfbf' }}>—</span>,
          },
        ]}
        summary={() => (
          <Table.Summary.Row style={{ background: '#f6ffed' }}>
            <Table.Summary.Cell index={0} colSpan={4}>
              <span style={{ fontWeight: 700 }}>Tổng cộng</span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <span style={{ fontWeight: 800, color: '#fa8c16', fontSize: 13 }}>
                {Math.round(totalKg).toLocaleString('vi-VN')} kg
              </span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <span style={{ fontWeight: 800, color: '#389e0d', fontSize: 13 }}>
                {Math.round(tonDetailRows.reduce((s, r) => s + r.tonKg, 0)).toLocaleString('vi-VN')} kg
              </span>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="center">
              <span style={{ fontWeight: 700 }}>
                {tonDetailRows.reduce((s, r) => s + r.soCuon, 0)}
              </span>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Drawer>
    </>
  )
}
