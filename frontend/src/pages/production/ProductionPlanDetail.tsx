import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Popconfirm, Space, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, ExportOutlined,
  PlusOutlined, PrinterOutlined, FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  productionPlansApi, type PlanLineResponse, PLAN_TRANG_THAI,
} from '../../api/productionPlans'
import { LOAI_LAN_LABELS } from '../../api/quotes'
import AddLinesModal from './AddLinesModal'
import { exportToExcel, printToPdf, fmtN } from '../../utils/exportUtils'

const { Text } = Typography

// ─── Hệ số sóng ───────────────────────────────────────────────────────────────
const TAKE_UP: Record<string, number> = { E: 1.22, B: 1.32, C: 1.45, A: 1.56 }

function getSongLetters(s: string | null | undefined) {
  return (s ?? '').replace(/-/g, '').toUpperCase().split('').filter(Boolean)
}

type SongSlot = { ma: string | null; dl: number | null; flute: string | null }

/** Map song_1/song_2 vào đúng cột C/B theo to_hop_song thực tế */
function getSongSlots(r: PlanLineResponse): { songC: SongSlot; songB: SongSlot } {
  const songs = getSongLetters(r.to_hop_song)
  const soLop = r.so_lop ?? 3
  const empty: SongSlot = { ma: null, dl: null, flute: null }
  let songC = { ...empty }
  let songB = { ...empty }

  const f1 = songs[0] ?? 'C'
  if (f1 === 'B') songB = { ma: r.song_1, dl: r.song_1_dl, flute: 'B' }
  else            songC = { ma: r.song_1, dl: r.song_1_dl, flute: f1 }

  if (soLop >= 5) {
    const f2 = songs[1] ?? 'B'
    if (f2 === 'B') songB = { ma: r.song_2, dl: r.song_2_dl, flute: 'B' }
    else            songC = { ma: r.song_2, dl: r.song_2_dl, flute: f2 }
  }

  return { songC, songB }
}

// ─── Tính toán ────────────────────────────────────────────────────────────────

function calcSoTam(slKeHoach: number, soDao: number | null): number {
  return soDao && soDao > 0 ? Math.ceil(slKeHoach / soDao) : Math.ceil(slKeHoach)
}

function calcMetToi(soTam: number, daiTt: number | null): number {
  if (!daiTt) return 0
  return Math.round(soTam * daiTt) / 100
}

function calcLayerKg(
  soTam: number,
  kho1: number | null,
  daiTt: number | null,
  dl: number | null,
  isSong: boolean,
  songType: string | null,
): number {
  if (!kho1 || !daiTt || !dl) return 0
  const take = isSong ? (TAKE_UP[songType ?? ''] ?? 1.0) : 1.0
  const area = (kho1 * daiTt * take) / 10000
  return Math.round((dl * area / 1000) * soTam * 10) / 10
}

/** Quy cách sản phẩm — dạng như PDF: 159*160_3L B hoặc 26*22*16_5L C-B */
function calcQuyCache(r: PlanLineResponse): string {
  const soLop = r.so_lop ?? 3
  const song = r.to_hop_song ?? ''
  if (r.cao && Number(r.cao) > 0) {
    return `${fmtN(r.dai, 1)}×${fmtN(r.rong, 1)}×${fmtN(r.cao, 1)}_${soLop}L ${song}`
  }
  // Tấm phẳng
  const daiTt = r.dai_tt ? fmtN(r.dai_tt, 1) : fmtN(r.dai, 1) || '?'
  const kho1  = r.kho1   ? fmtN(r.kho1,  1) : fmtN(r.rong, 1) || '?'
  return `${daiTt}×${kho1}_${soLop}L ${song}`
}

/** QCCL = chiều rộng mỗi nửa + cao + chiều rộng mỗi nửa */
function calcQCCL(rong: number | null, cao: number | null, soLop: number | null): string {
  if (!cao || Number(cao) <= 0 || !rong) return ''
  const layers = soLop ?? 3
  const allow  = layers <= 3 ? 0.1 : layers <= 5 ? 0.2 : 0.3
  const side   = Math.round((Number(rong) / 2 + allow) * 10) / 10
  return `${side}+${Number(cao)}+${side}`
}

/** Mặt trong là lớp mặt cuối cùng (innermost face) */
function getMatInner(r: PlanLineResponse): { ma: string | null; dl: number | null; isSongIdx: number } {
  const soLop = r.so_lop ?? 3
  if (soLop >= 7) return { ma: r.mat_3, dl: r.mat_3_dl, isSongIdx: 6 }
  if (soLop >= 5) return { ma: r.mat_2, dl: r.mat_2_dl, isSongIdx: 4 }
  return { ma: r.mat_1, dl: r.mat_1_dl, isSongIdx: 2 }
}

// ─── Kiểu dữ liệu bảng (bao gồm dòng tổng kết khổ) ─────────────────────────

/** Một mã giấy + tổng kg tại một vị trí lớp */
type LayerEntry = { ma: string; dl: number | null; kg: number }

/** Mỗi vị trí lớp là danh sách các mã giấy khác nhau (cùng mã → cộng gộp) */
type LayerKgSummary = {
  matC:  LayerEntry[]   // Mặt ngoài
  songC: LayerEntry[]   // Sóng C
  matB:  LayerEntry[]   // Mặt giữa (≥5L)
  songB: LayerEntry[]   // Sóng B   (≥5L)
  inner: LayerEntry[]   // Mặt trong
}

type GroupHeader = {
  _type: 'header'
  id: string
  kho: number
  soLenh: number
}
type GroupFooter = {
  _type: 'footer'
  id: string
  kho: number
  soLenh: number
  soTam: number
  soLuong: number
  soMT: number
  layers: LayerKgSummary
}
type LineRow = PlanLineResponse & { _type: 'line' }
type TableRow = LineRow | GroupHeader | GroupFooter

function isHeader(r: TableRow): r is GroupHeader { return r._type === 'header' }
function isFooter(r: TableRow): r is GroupFooter { return r._type === 'footer' }

/** Tích luỹ kg vào map {mã → entry}. Cùng mã → cộng, khác mã → thêm mới */
function accumLayer(
  map: Map<string, LayerEntry>,
  ma: string | null,
  dl: number | null,
  kg: number,
) {
  if (!ma || kg <= 0) return
  const existing = map.get(ma)
  if (existing) existing.kg += kg
  else map.set(ma, { ma, dl, kg })
}

/** Tính tổng kg từng lớp giấy cho một nhóm khổ — cùng mã cộng gộp */
function calcGroupLayers(group: PlanLineResponse[]): LayerKgSummary {
  const maps = {
    matC:  new Map<string, LayerEntry>(),
    songC: new Map<string, LayerEntry>(),
    matB:  new Map<string, LayerEntry>(),
    songB: new Map<string, LayerEntry>(),
    inner: new Map<string, LayerEntry>(),
  }
  for (const r of group) {
    const soTam = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
    const kho1  = r.kho1   ? Number(r.kho1)   : null
    const daiTt = r.dai_tt ? Number(r.dai_tt) : null
    const soLop = r.so_lop ?? 3
    const songs = getSongLetters(r.to_hop_song)
    const inner = getMatInner(r)

    const slots = getSongSlots(r)
    accumLayer(maps.matC,  r.mat,         r.mat_dl,       calcLayerKg(soTam, kho1, daiTt, r.mat_dl,        false, null))
    accumLayer(maps.songC, slots.songC.ma, slots.songC.dl, calcLayerKg(soTam, kho1, daiTt, slots.songC.dl, true,  slots.songC.flute))
    if (soLop >= 5) {
      accumLayer(maps.matB,  r.mat_1,        r.mat_1_dl,    calcLayerKg(soTam, kho1, daiTt, r.mat_1_dl,     false, null))
    }
    accumLayer(maps.songB, slots.songB.ma, slots.songB.dl, calcLayerKg(soTam, kho1, daiTt, slots.songB.dl, true,  slots.songB.flute))
    accumLayer(maps.inner, inner.ma, inner.dl, calcLayerKg(soTam, kho1, daiTt, inner.dl, false, null))
  }
  // Round kg và chuyển map → array
  const toEntries = (m: Map<string, LayerEntry>): LayerEntry[] =>
    [...m.values()].map(e => ({ ...e, kg: Math.round(e.kg) }))

  return {
    matC:  toEntries(maps.matC),
    songC: toEntries(maps.songC),
    matB:  toEntries(maps.matB),
    songB: toEntries(maps.songB),
    inner: toEntries(maps.inner),
  }
}

function buildTableRows(lines: PlanLineResponse[]): { rows: TableRow[]; totalMT: number } {
  const sorted = [...lines].sort((a, b) => {
    const ka = Number(a.kho_giay) || 0
    const kb = Number(b.kho_giay) || 0
    return ka !== kb ? ka - kb : a.thu_tu - b.thu_tu
  })

  // Gom nhóm theo kho_giay trước — để biết soLenh trước khi emit header
  const groups: { kho: number; groupLines: PlanLineResponse[] }[] = []
  for (const line of sorted) {
    const kho = Number(line.kho_giay) || 0
    const last = groups[groups.length - 1]
    if (!last || last.kho !== kho) groups.push({ kho, groupLines: [line] })
    else last.groupLines.push(line)
  }

  const rows: TableRow[] = []
  let totalMT = 0

  for (const { kho, groupLines } of groups) {
    // Header row — thanh xanh navy trước mỗi nhóm
    rows.push({ _type: 'header', id: `header-${kho}`, kho, soLenh: groupLines.length })

    // Các dòng lệnh
    for (const line of groupLines) {
      rows.push({ ...line, _type: 'line' })
    }

    // Footer row — tổng kết nhóm
    let soMT = 0
    let soTam = 0
    let soLuong = 0
    for (const r of groupLines) {
      const tam = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
      soTam += tam
      soMT  += calcMetToi(tam, r.dai_tt)
      soLuong += Number(r.so_luong_ke_hoach)
    }
    totalMT += soMT
    rows.push({
      _type: 'footer',
      id: `footer-${kho}`,
      kho,
      soLenh: groupLines.length,
      soTam,
      soLuong,
      soMT: Math.round(soMT * 10) / 10,
      layers: calcGroupLayers(groupLines),
    })
  }

  return { rows, totalMT: Math.round(totalMT * 10) / 10 }
}

// ─── Cell giấy (mã/ĐL + kg) — format: "54/140\n191 kg" (khớp báo giá) ────────
function PaperCell({ ma, dl, kg, isSong }: { ma: string | null; dl: number | null; kg: number; isSong: boolean }) {
  if (!ma) return <span style={{ color: '#d9d9d9' }}>—</span>
  return (
    <div style={{ lineHeight: 1.4 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: isSong ? '#1677ff' : '#389e0d', whiteSpace: 'nowrap' }}>
        {ma}{dl != null ? `/${Math.round(dl)}` : ''}
      </div>
      {kg > 0 && <div style={{ fontSize: 11, color: '#fa8c16', fontWeight: 600 }}>{Math.round(kg).toLocaleString('vi-VN')} kg</div>}
    </div>
  )
}

/** Cell hiển thị danh sách mã giấy + ĐL + kg trong dòng tổng kết khổ */
function LayerEntriesCell({ entries, isSong, bold }: { entries: LayerEntry[]; isSong: boolean; bold?: boolean }) {
  if (!entries.length) return <span style={{ color: '#d9d9d9', fontSize: 13 }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.map(e => (
        <span key={e.ma} style={{
          fontSize: bold ? 14 : 13,
          fontWeight: 700,
          color: isSong ? '#0958d9' : '#237804',
          whiteSpace: 'nowrap',
        }}>
          {e.ma}{e.dl != null ? `/${Math.round(e.dl)}` : ''}: <span style={{ color: '#ad4e00' }}>{Math.round(e.kg).toLocaleString('vi-VN')}kg</span>
        </span>
      ))}
    </div>
  )
}

// ─── Component chính ──────────────────────────────────────────────────────────

interface Props { planId: number; embedded?: boolean }

export default function ProductionPlanDetail({ planId, embedded }: Props) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: plan, isLoading } = useQuery({
    queryKey: ['production-plan', planId],
    queryFn: () => productionPlansApi.get(planId).then(r => r.data),
  })

  const exportMut = useMutation({
    mutationFn: () => productionPlansApi.export(planId),
    onSuccess: () => {
      message.success('Đã xuất kế hoạch')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
      qc.invalidateQueries({ queryKey: ['production-plans'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })
  const deleteLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['production-plan', planId] }) },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })
  const completeLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.completeLine(planId, lineId),
    onSuccess: () => {
      message.success('Hoàn thành')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
      qc.invalidateQueries({ queryKey: ['production-plans'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })
  const togglePhoiNgoaiMut = useMutation({
    mutationFn: ({ lineId, value }: { lineId: number; value: boolean }) =>
      productionPlansApi.togglePhoiNgoai(lineId, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-plan', planId] }),
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi'),
  })

  if (isLoading || !plan) return <div style={{ padding: 24 }}>Đang tải...</div>

  const statusInfo = PLAN_TRANG_THAI[plan.trang_thai] ?? { label: plan.trang_thai, color: 'default' }
  const canEdit   = plan.trang_thai !== 'hoan_thanh'
  const canExport = plan.trang_thai === 'nhap'

  const { rows, totalMT } = buildTableRows(plan.lines)
  const missingKhoGiayCount = plan.lines.filter(l => !l.kho_giay || Number(l.kho_giay) === 0).length
  const totalSLThung = plan.lines.reduce((s, l) => s + Number(l.so_luong_ke_hoach), 0)

  // Tổng kg toàn bộ kế hoạch — cộng từng mã riêng qua tất cả GroupFooter
  const grandMaps: Record<keyof LayerKgSummary, Map<string, LayerEntry>> = {
    matC:  new Map(), songC: new Map(),
    matB:  new Map(), songB: new Map(), inner: new Map(),
  }
  for (const row of rows) {
    if (!isFooter(row)) continue
    for (const key of Object.keys(grandMaps) as (keyof LayerKgSummary)[]) {
      for (const e of row.layers[key]) {
        const ex = grandMaps[key].get(e.ma)
        if (ex) ex.kg += e.kg
        else grandMaps[key].set(e.ma, { ...e })
      }
    }
  }
  const grandLayers: LayerKgSummary = {
    matC:  [...grandMaps.matC.values()],
    songC: [...grandMaps.songC.values()],
    matB:  [...grandMaps.matB.values()],
    songB: [...grandMaps.songB.values()],
    inner: [...grandMaps.inner.values()],
  }

  // ─── Export handlers ─────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const dataRows: (string | number | null | undefined)[][] = []
    for (const row of rows) {
      if (isHeader(row)) {
        dataRows.push([`▶ KHỔ GIẤY: ${row.kho} cm — ${row.soLenh} lệnh`, ...Array(20).fill('')])
        continue
      }
      if (isFooter(row)) {
        const layerStr = (entries: LayerEntry[]) =>
          entries.map(e => `${e.ma}${e.dl != null ? `/${Math.round(e.dl)}` : ''}: ${Math.round(e.kg)}kg`).join(' / ') || '—'
        dataRows.push([
          `${row.soLenh} lệnh`,
          layerStr(row.layers.matC), layerStr(row.layers.songC),
          layerStr(row.layers.matB), layerStr(row.layers.songB),
          layerStr(row.layers.inner),
          '', '', '', '', '', '', '', '', '', '',
          `Tổng: ${row.soTam.toLocaleString('vi-VN')} tấm`,
          '', '',
          `MT: ${row.soMT}`,
        ])
      } else {
        const r = row as LineRow
        const songs  = getSongLetters(r.to_hop_song)
        const soTam  = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
        const metToi = calcMetToi(soTam, r.dai_tt)
        const qccl   = r.qccl || calcQCCL(r.rong, r.cao, r.so_lop)
        const soLop  = r.so_lop ?? 3
        const inner  = getMatInner(r)
        const kho1   = r.kho1 ? Number(r.kho1) : null
        const daiTt  = r.dai_tt ? Number(r.dai_tt) : null
        dataRows.push([
          r.ten_khach_hang ?? '',
          r.so_lenh ?? '',
          r.mat ? `${r.mat}${r.mat_dl != null ? `/${Math.round(r.mat_dl)}` : ''}` : '',
          r.song_1 ? `${r.song_1}${r.song_1_dl != null ? `/${Math.round(r.song_1_dl)}` : ''}` : '',
          soLop >= 5 ? (r.mat_1 ? `${r.mat_1}${r.mat_1_dl != null ? `/${Math.round(r.mat_1_dl)}` : ''}` : '') : '',
          soLop >= 5 ? (r.song_2 ? `${r.song_2}${r.song_2_dl != null ? `/${Math.round(r.song_2_dl)}` : ''}` : '') : '',
          inner.ma ? `${inner.ma}${inner.dl != null ? `/${Math.round(inner.dl)}` : ''}` : '',
          calcQuyCache(r),
          r.to_hop_song ?? '',
          r.kho_giay != null ? Number(r.kho_giay) : '',
          daiTt ?? '',
          soTam,
          r.so_dao ?? '',
          qccl,
          kho1 != null && r.kho_tt != null ? `${fmtN(kho1, 1)}/${fmtN(r.kho_tt, 1)}` : (kho1 ?? ''),
          Number(r.so_luong_ke_hoach),
          r.loai_lan ? (LOAI_LAN_LABELS[r.loai_lan] ?? r.loai_lan) : '',
          r.loai_in ?? '',
          r.ghi_chu ?? '',
          metToi,
        ])
      }
    }
    exportToExcel(`KHSX_${plan.so_ke_hoach}_${dayjs(plan.ngay_ke_hoach).format('YYYYMMDD')}`, [{
      name: 'Kế hoạch SX',
      headers: [
        'Mã KH', 'Số LSX',
        'Mặt C', 'Sóng C', 'Mặt B', 'Sóng B', 'Mặt T',
        'Quy cách SP', 'Sóng', 'Khổ (cm)', 'Dài (cm)',
        'Số tấm', 'Dao', 'QCCL', 'Kho1/TT', 'SL thùng',
        'Loại lằn', 'Loại in', 'Ghi chú', 'Mét tới',
      ],
      rows: dataRows,
      colWidths: [12, 16, 14, 14, 14, 14, 14, 22, 8, 8, 8, 8, 6, 14, 8, 10, 12, 12, 20, 10],
    }])
  }

  const handleExportPdf = () => {
    // Helper: render ô giấy dạng "54/140\n191 kg" (khớp báo giá)
    const paperCell = (ma: string | null, dl: number | null, kg: number, isSong: boolean) => {
      if (!ma) return '<span style="color:#ccc">—</span>'
      const color = isSong ? '#1677ff' : '#237804'
      const label = dl != null ? `${ma}/${Math.round(dl)}` : ma
      const kgLine = kg > 0 ? `<br><span style="color:#fa8c16;font-weight:600">${Math.round(kg).toLocaleString('vi-VN')} kg</span>` : ''
      return `<span style="color:${color};font-weight:700">${label}</span>${kgLine}`
    }

    // Helper: render ô loại in + CT/CM
    const inCell = (r: PlanLineResponse) => {
      const loaiIn = r.loai_in && r.loai_in !== 'khong_in'
        ? (r.loai_in === 'flexo' ? 'Flexo' : r.loai_in === 'ky_thuat_so' ? 'KTS' : r.loai_in) + (r.so_mau ? ` ${r.so_mau}M` : '')
        : '<span style="color:#ccc">—</span>'
      const ct = r.c_tham && r.c_tham !== 'Không'
        ? `<br><span class="tag-ct">CT ${r.c_tham.replace('mặt','m').replace(/\s+/g,'')}</span>` : ''
      const cm = r.can_man && r.can_man !== 'Không'
        ? `<br><span class="tag-cm">CM ${r.can_man.replace('mặt','m').replace(/\s+/g,'')}</span>` : ''
      return loaiIn + ct + cm
    }

    const bodyRows = rows.map((row, i) => {
      // Dòng header nhóm (thanh navy)
      if (isHeader(row)) {
        return `<tr style="page-break-inside:avoid;page-break-after:avoid">
          <td colspan="20" style="background:#1a1a1a;color:#fff;font-weight:700;font-size:10px;padding:4px 6px;letter-spacing:0.5px;border:1px solid #000 !important">
            ▶ KHỔ GIẤY: ${row.kho} cm — ${row.soLenh} lệnh
          </td>
        </tr>`
      }

      if (isFooter(row)) {
        const { layers } = row
        const fmtGroup = (entries: { ma: string; dl: number | null; kg: number }[], isSong = false) =>
          entries.map(e => `<span style="color:${isSong ? '#1677ff' : '#237804'};font-weight:700">${e.ma}${e.dl != null ? `/${Math.round(e.dl)}` : ''}</span><br><span style="color:#fa8c16">${Math.round(e.kg).toLocaleString('vi-VN')} kg</span>`).join('<br>') || '—'
        return `<tr class="footer-row">
          <td colspan="2" style="font-weight:700;color:#614700">${row.soLenh} lệnh</td>
          <td>${fmtGroup(layers.matC, false)}</td>
          <td>${fmtGroup(layers.songC, true)}</td>
          <td>${fmtGroup(layers.matB, false)}</td>
          <td>${fmtGroup(layers.songB, true)}</td>
          <td>${fmtGroup(layers.inner, false)}</td>
          <td colspan="11" style="text-align:right;color:#614700">Tổng nhóm: <b style="color:#262626">${row.soTam.toLocaleString('vi-VN')} tấm</b> &nbsp;·&nbsp; MT:</td>
          <td style="text-align:right;font-weight:700;color:#fa8c16">${row.soMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</td>
        </tr>`
      }

      const r = row as LineRow
      const songs  = getSongLetters(r.to_hop_song)
      const soTam  = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
      const metToi = calcMetToi(soTam, r.dai_tt)
      const qccl   = r.qccl || calcQCCL(r.rong, r.cao, r.so_lop)
      const soLop  = r.so_lop ?? 3
      const inner  = getMatInner(r)
      const kho1   = r.kho1 ? Number(r.kho1) : null
      const daiTt  = r.dai_tt ? Number(r.dai_tt) : null

      const slots   = getSongSlots(r)
      const kgMatC  = calcLayerKg(soTam, kho1, daiTt, r.mat_dl,        false, null)
      const kgSongC = calcLayerKg(soTam, kho1, daiTt, slots.songC.dl,  true,  slots.songC.flute)
      const kgMatB  = soLop >= 5 ? calcLayerKg(soTam, kho1, daiTt, r.mat_1_dl, false, null) : 0
      const kgSongB = calcLayerKg(soTam, kho1, daiTt, slots.songB.dl,  true,  slots.songB.flute)
      const kgInner = calcLayerKg(soTam, kho1, daiTt, inner.dl, false, null)

      const loaiLan = r.loai_lan ? (LOAI_LAN_LABELS[r.loai_lan] ?? r.loai_lan) : '—'

      return `<tr>
        <td style="font-weight:600;white-space:nowrap">${r.ma_kh ?? '—'}</td>
        <td style="font-family:monospace;font-size:8px;font-weight:700"><span style="font-size:7px;color:#888;display:block;line-height:1">${r.thu_tu}</span>${r.so_lenh ?? '—'}${r.ngay_chay ? `<br><span style="color:#1677ff;font-size:7px">${dayjs(r.ngay_chay).format('DD/MM')}</span>` : ''}</td>
        <td>${paperCell(r.mat,          r.mat_dl,        kgMatC,  false)}</td>
        <td>${paperCell(slots.songC.ma, slots.songC.dl,  kgSongC, true)}</td>
        <td>${soLop >= 5 ? paperCell(r.mat_1, r.mat_1_dl, kgMatB, false) : '<span style="color:#ccc">—</span>'}</td>
        <td>${slots.songB.ma ? paperCell(slots.songB.ma, slots.songB.dl, kgSongB, true) : '<span style="color:#ccc">—</span>'}</td>
        <td>${paperCell(inner.ma, inner.dl, kgInner, false)}</td>
        <td style="white-space:nowrap">${calcQuyCache(r)}</td>
        <td class="center" style="font-weight:700;color:#531dab">${r.to_hop_song ?? '—'}</td>
        <td class="right" style="color:${!r.kho_giay || Number(r.kho_giay) === 0 ? '#ff4d4f' : '#1677ff'};font-weight:700;font-size:13px">${!r.kho_giay || Number(r.kho_giay) === 0 ? '⚠ —' : fmtN(r.kho_giay, 1)}</td>
        <td class="right">${daiTt != null ? fmtN(daiTt, 1) : '—'}</td>
        <td class="right" style="font-weight:800;font-size:15px">${soTam.toLocaleString('vi-VN')}</td>
        <td class="center" style="color:#1677ff;font-weight:700">${r.so_dao ?? '—'}</td>
        <td style="font-size:8px;font-family:monospace">${qccl || '—'}</td>
        <td class="center">${kho1 != null ? `<div style="font-size:7px;color:#8c8c8c">${fmtN(kho1, 1)}</div><div style="font-weight:700;color:#1677ff">${r.kho_tt != null ? fmtN(r.kho_tt, 1) : '—'}</div>` : '—'}</td>
        <td class="right" style="font-weight:600">${Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')}</td>
        <td class="center"><span class="tag-lan">${loaiLan}</span></td>
        <td class="center">${inCell(r)}</td>
        <td style="font-size:8px;color:#595959">${r.ghi_chu ?? ''}</td>
        <td class="right" style="font-weight:700;color:#fa8c16">${metToi > 0 ? metToi.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'}</td>
      </tr>`
    }).join('')

    const tableHtml = `
      <table>
        <thead><tr>
          <th>Mã KH</th>
          <th>Số LSX</th>
          <th>Mặt C</th><th>Sóng C</th><th>Mặt B</th><th>Sóng B</th><th>Mặt T</th>
          <th>Quy cách SP</th>
          <th class="center">Sóng</th>
          <th class="right">Khổ (cm)</th>
          <th class="right">Dài (cm)</th>
          <th class="right">Số tấm</th>
          <th class="center">Dao</th>
          <th>QCCL</th>
          <th class="center">Kho1/TT</th>
          <th class="right">SL thùng</th>
          <th class="center">Loại lằn</th>
          <th class="center">In / GC</th>
          <th>Ghi chú</th>
          <th class="right">Mét tới</th>
        </tr></thead>
        <tbody>
          ${bodyRows}
          <tr class="total-row">
            <td colspan="19" class="right"><strong>TỔNG SỐ MÉT TỚI:</strong></td>
            <td class="right"><strong>${totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong></td>
          </tr>
        </tbody>
      </table>`

    const headerMeta = [
      `Ngày: <b>${dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')}</b>`,
      plan.noi_sx ? `Nơi SX: <b>${plan.noi_sx}</b>` : '',
      plan.created_by_name ? `Người lập: <b>${plan.created_by_name}</b>` : '',
      `${plan.lines.length} lệnh`,
      `Tổng MT: <b>${totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b>`,
    ].filter(Boolean).join(' &nbsp;·&nbsp; ')

    printToPdf(
      `Kế hoạch SX ${plan.so_ke_hoach}`,
      `<style>
        @page { size: A4 landscape; margin: 8mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-size: 10px; }
        table { font-size: 10px !important; border-collapse: collapse !important; }
        th { padding: 3px 4px !important; font-size: 10px !important; border: 1px solid #333 !important; background: #2c2c2c !important; color: #fff !important; }
        td { padding: 3px 4px !important; font-size: 10px; border: 1px solid #555 !important; }
        .footer-row td { border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important; background: #e8e8e8 !important; color: #000 !important; }
        .total-row td { border-top: 3px solid #000 !important; background: #ccc !important; color: #000 !important; }
        .tag-ct { background:#e6fffb; color:#08979c; border:1px solid #87e8de; border-radius:3px; padding:0 3px; font-size:7px; }
        .tag-cm { background:#f9f0ff; color:#531dab; border:1px solid #d3adf7; border-radius:3px; padding:0 3px; font-size:7px; }
        .tag-lan{ background:#fff2e8; color:#d4380d; border:1px solid #ffbb96; border-radius:3px; padding:0 3px; font-size:7px; }
      </style>
      <h2 style="margin:0 0 4px;font-size:14px">KẾ HOẠCH SẢN XUẤT: ${plan.so_ke_hoach}</h2>
      <p class="meta" style="margin:0 0 6px;font-size:9px">${headerMeta}</p>
      ${tableHtml}`,
      true,
    )
  }

  // Tổng số cột trong bảng
  const TOTAL_COLS = 22  // 20 cột dữ liệu + 2 cột no-print (Mua phôi + Hành động)

  return (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {/* ── Print styles ── */}
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; font-size: 11px; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { font-size: 11px !important; border-collapse: collapse !important; }
          th, td { padding: 3px 4px !important; font-size: 11px !important; border: 1px solid #555 !important; }
          th { background: #2c2c2c !important; color: #fff !important; }
          .group-header-row td { background: #1a1a1a !important; color: #fff !important; font-size: 13px !important; }
          .group-header-row { page-break-after: avoid; break-after: avoid; }
          .group-footer-row td { border-top: 2px solid #333 !important; border-bottom: 2px solid #333 !important; background: #e8e8e8 !important; color: #000 !important; }
          .grand-total-row td { border-top: 3px solid #000 !important; background: #ccc !important; color: #000 !important; }
          .ant-tag { background: #e0e0e0 !important; color: #000 !important; border: 1px solid #555 !important; font-size: 7px !important; padding: 0 3px !important; }
          .plan-header { margin-bottom: 6px; }
          .cell-tam { font-size: 18px !important; font-weight: 800 !important; }
          .cell-kho { font-size: 15px !important; font-weight: 800 !important; }
          .cell-mt  { font-size: 13px !important; }
        }
      `}</style>

      {/* ── Header card (toolbar) ── */}
      <Card
        size="small"
        className="no-print"
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text strong style={{ fontSize: 15 }}>{plan.so_ke_hoach}</Text>
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')} · {plan.lines.length} lệnh · MT: {totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            </Text>
          </Space>
          <Space>
            {canExport && (
              <Button type="primary" icon={<ExportOutlined />} loading={exportMut.isPending} onClick={() => exportMut.mutate()}>
                Xuất kế hoạch
              </Button>
            )}
            <Button.Group>
              <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>Excel</Button>
              <Button icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf}>PDF</Button>
            </Button.Group>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
            {canEdit && <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm LSX</Button>}
          </Space>
        </div>
        {plan.ghi_chu && <Text type="secondary" style={{ fontSize: 12 }}>Ghi chú: {plan.ghi_chu}</Text>}
      </Card>

      {/* ── Cảnh báo thiếu khổ giấy ── */}
      {missingKhoGiayCount > 0 && (
        <Alert
          className="no-print"
          type="warning"
          showIcon
          style={{ marginBottom: 10 }}
          message={`${missingKhoGiayCount} dòng chưa có khổ giấy — cần bổ sung trước khi in phiếu cho xưởng`}
        />
      )}

      {/* ── PDF-style header ── */}
      <div className="plan-header" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 14 }}>
            <div><b>Ngày:</b> {dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')}</div>
            {plan.noi_sx && <div><b>Nơi SX:</b> {plan.noi_sx}</div>}
            <div><b>Số phiếu:</b> {plan.so_ke_hoach}</div>
            {plan.created_by_name && <div><b>Người lập:</b> {plan.created_by_name}</div>}
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>KẾ HOẠCH SẢN XUẤT</div>
          </div>
          <div style={{ fontSize: 14, textAlign: 'right' }}>
            <div>Tổng SL: <b style={{ color: '#1677ff', fontSize: 16 }}>{totalSLThung.toLocaleString('vi-VN')} thùng</b></div>
            <div>Tổng MT: <b style={{ color: '#fa8c16', fontSize: 16 }}>{totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b></div>
            <div style={{ color: '#888' }}>{plan.lines.length} lệnh</div>
          </div>
        </div>
      </div>

      {/* ── Bảng kế hoạch ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f0f5ff' }}>
              <th style={TH}>Mã KH</th>
              <th style={TH}>Số LSX</th>
              {/* Kết cấu giấy: 5 lớp */}
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt C</th>
              <th style={{ ...TH, background: '#e6f4ff', color: '#1677ff' }}>Sóng C</th>
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt B</th>
              <th style={{ ...TH, background: '#e6f4ff', color: '#1677ff' }}>Sóng B</th>
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt T</th>
              {/* Thông số */}
              <th style={TH}>Quy Cách Sản Phẩm</th>
              <th style={TH}>Sóng</th>
              <th style={{ ...TH, color: '#1677ff' }}>Khổ (cm)</th>
              <th style={TH}>Dài (cm)</th>
              <th style={TH}>Số Tấm</th>
              <th style={TH}>Dao</th>
              <th style={TH}>QCCL</th>
              <th style={TH}>Kho1/TT</th>
              <th style={TH}>SL Thùng</th>
              <th style={TH}>Loại Lằn</th>
              <th style={TH}>Loại In</th>
              <th style={TH}>Ghi Chú</th>
              <th style={{ ...TH, color: '#fa8c16' }}>Mét Tới</th>
              <th style={{ ...TH, color: '#cf1322' }} className="no-print">
                <Tooltip title="Đánh dấu line này phải mua phôi sóng từ NCC ngoài">
                  Mua phôi
                </Tooltip>
              </th>
              <th style={{ ...TH }} className="no-print">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              // ── GroupHeader row ─────────────────────────────────────────
              if (isHeader(row)) {
                return (
                  <tr key={row.id} className="group-header-row" style={{ pageBreakInside: 'avoid' }}>
                    <td colSpan={22} style={{
                      ...TD,
                      background: '#003a8c',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 15,
                      letterSpacing: 0.5,
                      padding: '6px 10px',
                    }}>
                      ▶ KHỔ GIẤY: <b style={{ fontSize: 19 }}>{row.kho} cm</b> — {row.soLenh} lệnh
                    </td>
                  </tr>
                )
              }

              // ── GroupFooter row ─────────────────────────────────────────
              if (isFooter(row)) {
                const { layers } = row
                return (
                  <tr key={row.id} className="group-footer-row" style={{ background: '#fff7e6', borderTop: '2px solid #ffa940', borderBottom: '2px solid #ffa940' }}>
                    <td colSpan={2} style={{ ...TD, background: '#fff1b8', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', color: '#614700' }}>
                      {row.soLenh} lệnh
                    </td>
                    <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={layers.matC} isSong={false} /></td>
                    <td style={{ ...TD, background: '#e6f4ff' }}><LayerEntriesCell entries={layers.songC} isSong={true} /></td>
                    <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={layers.matB} isSong={false} /></td>
                    <td style={{ ...TD, background: '#e6f4ff' }}><LayerEntriesCell entries={layers.songB} isSong={true} /></td>
                    <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={layers.inner} isSong={false} /></td>
                    {/* Quy Cách → Ghi Chú: hiện soTam + soLuong */}
                    <td colSpan={12} style={{ ...TD, textAlign: 'right', color: '#614700', fontSize: 13 }}>
                      <b style={{ color: '#262626', fontSize: 15 }}>{row.soTam.toLocaleString('vi-VN')} tấm</b>
                      &nbsp;·&nbsp;<b style={{ color: '#1677ff', fontSize: 15 }}>{row.soLuong.toLocaleString('vi-VN')} thùng</b>
                      &nbsp;·&nbsp;MT:
                    </td>
                    <td className="cell-mt" style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#fa8c16', fontSize: 16, background: '#fff1b8' }}>
                      {row.soMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                    </td>
                    <td style={TD} className="no-print" />
                    <td style={TD} className="no-print" />
                  </tr>
                )
              }

              const r = row as LineRow
              const songs    = getSongLetters(r.to_hop_song)
              const soTam    = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
              const metToi   = calcMetToi(soTam, r.dai_tt)
              const qccl     = r.qccl || calcQCCL(r.rong, r.cao, r.so_lop)
              const soLop    = r.so_lop ?? 3
              const inner    = getMatInner(r)
              const kho1     = r.kho1 ? Number(r.kho1) : null
              const daiTt    = r.dai_tt ? Number(r.dai_tt) : null

              // Kg từng lớp — map đúng cột theo loại sóng thực tế
              const slots    = getSongSlots(r)
              const kgMatC   = calcLayerKg(soTam, kho1, daiTt, r.mat_dl,        false, null)
              const kgSongC  = calcLayerKg(soTam, kho1, daiTt, slots.songC.dl,  true,  slots.songC.flute)
              const kgMatB   = soLop >= 5 ? calcLayerKg(soTam, kho1, daiTt, r.mat_1_dl, false, null) : 0
              const kgSongB  = calcLayerKg(soTam, kho1, daiTt, slots.songB.dl,  true,  slots.songB.flute)
              const kgInner  = calcLayerKg(soTam, kho1, daiTt, inner.dl, false, null)

              const hasNoKho = !r.kho_giay || Number(r.kho_giay) === 0
              const isDangChay = r.trang_thai === 'dang_chay'
              const isOdd = idx % 2 === 0
              const rowBg = hasNoKho ? '#fff1f0'
                : r.trang_thai === 'hoan_thanh' ? '#f6ffed'
                : isDangChay ? '#fffbe6'
                : isOdd ? '#fff' : '#fafafa'
              const rowBorderLeft = hasNoKho ? '3px solid #ff4d4f'
                : isDangChay ? '3px solid #faad14'
                : undefined

              return (
                <tr key={r.id} style={{ background: rowBg, ...(rowBorderLeft ? { borderLeft: rowBorderLeft } : {}) }}>
                  {/* Mã KH */}
                  <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.ma_kh || '—'}</td>

                  {/* Số LSX + STT nhỏ + ngày chạy */}
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 10, color: '#8c8c8c', lineHeight: 1 }}>{r.thu_tu}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.so_lenh || '—'}</div>
                    {r.ngay_chay && (() => {
                      const today = dayjs().startOf('day')
                      const nc = dayjs(r.ngay_chay).startOf('day')
                      const ngayColor = nc.isBefore(today) ? '#ff4d4f' : nc.isSame(today) ? '#fa8c16' : '#1677ff'
                      return (
                        <div style={{ fontSize: 11, color: ngayColor, marginTop: 1, fontWeight: nc.isBefore(today) || nc.isSame(today) ? 700 : 400 }}>
                          📅 {dayjs(r.ngay_chay).format('DD/MM')}
                        </div>
                      )
                    })()}
                  </td>

                  {/* Mặt C */}
                  <td style={TD}>
                    <PaperCell ma={r.mat} dl={r.mat_dl} kg={kgMatC} isSong={false} />
                  </td>

                  {/* Sóng C */}
                  <td style={TD}>
                    {slots.songC.ma
                      ? <PaperCell ma={slots.songC.ma} dl={slots.songC.dl} kg={kgSongC} isSong={true} />
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>—</span>}
                  </td>

                  {/* Mặt B (chỉ có ≥5 lớp) */}
                  <td style={TD}>
                    {soLop >= 5
                      ? <PaperCell ma={r.mat_1} dl={r.mat_1_dl} kg={kgMatB} isSong={false} />
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>—</span>}
                  </td>

                  {/* Sóng B */}
                  <td style={TD}>
                    {slots.songB.ma
                      ? <PaperCell ma={slots.songB.ma} dl={slots.songB.dl} kg={kgSongB} isSong={true} />
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>—</span>}
                  </td>

                  {/* Mặt trong */}
                  <td style={TD}>
                    <PaperCell ma={inner.ma} dl={inner.dl} kg={kgInner} isSong={false} />
                  </td>

                  {/* Quy cách sản phẩm */}
                  <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {calcQuyCache(r)}
                  </td>

                  {/* Sóng */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {r.to_hop_song
                      ? <Tag color="purple" style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{r.to_hop_song}</Tag>
                      : '—'}
                  </td>

                  {/* Khổ */}
                  <td className="cell-kho" style={{ ...TD, textAlign: 'center', fontWeight: 700, color: hasNoKho ? '#ff4d4f' : '#1677ff', fontSize: 20 }}>
                    {hasNoKho ? '⚠ —' : fmtN(r.kho_giay, 1)}
                  </td>

                  {/* Dài */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {daiTt != null ? fmtN(daiTt, 1) : '—'}
                  </td>

                  {/* Số Tấm — to hơn, công nhân nhìn chính */}
                  <td className="cell-tam" style={{ ...TD, textAlign: 'center', fontWeight: 700, fontSize: 24 }}>
                    {soTam.toLocaleString('vi-VN')}
                  </td>

                  {/* Dao */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#1677ff' }}>
                    {r.so_dao ?? '—'}
                  </td>

                  {/* QCCL */}
                  <td style={{ ...TD, textAlign: 'center', fontFamily: 'monospace', fontSize: 12 }}>
                    {qccl || '—'}
                  </td>

                  {/* Kho1/TT: kho1 (nhỏ, xám) + kho_tt (to, xanh) */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {kho1 != null ? (
                      <>
                        <div style={{ fontSize: 10, color: '#8c8c8c' }}>{fmtN(kho1, 1)}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1677ff' }}>
                          {r.kho_tt != null ? fmtN(r.kho_tt, 1) : '—'}
                        </div>
                      </>
                    ) : <span style={{ color: '#d9d9d9' }}>—</span>}
                  </td>

                  {/* SL Thùng — nhỏ hơn, tham khảo */}
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 400, fontSize: 12, color: '#595959' }}>
                    {Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')}
                  </td>

                  {/* Loại Lằn */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {r.loai_lan
                      ? <Tag color="volcano" style={{ margin: 0, fontSize: 12 }}>
                          {LOAI_LAN_LABELS[r.loai_lan] ?? r.loai_lan}
                        </Tag>
                      : <span style={{ color: '#d9d9d9' }}>—</span>}
                  </td>

                  {/* Loại In */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {r.loai_in && r.loai_in !== 'khong_in'
                        ? <span style={{ fontSize: 12 }}>{r.loai_in === 'flexo' ? 'Flexo' : r.loai_in === 'ky_thuat_so' ? 'KTS' : r.loai_in}{r.so_mau ? ` ${r.so_mau}M` : ''}</span>
                        : <span style={{ color: '#d9d9d9', fontSize: 12 }}>—</span>}
                      {r.c_tham && r.c_tham !== 'Không' && (
                        <Tag color="cyan" style={{ margin: 0, fontSize: 11, lineHeight: '16px', padding: '0 5px' }}>
                          CT {r.c_tham.replace('mặt', 'm').replace(/\s+/g, '')}
                        </Tag>
                      )}
                      {r.can_man && r.can_man !== 'Không' && (
                        <Tag color="purple" style={{ margin: 0, fontSize: 11, lineHeight: '16px', padding: '0 5px' }}>
                          CM {r.can_man.replace('mặt', 'm').replace(/\s+/g, '')}
                        </Tag>
                      )}
                    </div>
                  </td>

                  {/* Ghi Chú — nổi bật khi có nội dung */}
                  <td style={{ ...TD, maxWidth: 200, background: r.ghi_chu ? '#fffbe6' : undefined }}>
                    {r.ghi_chu
                      ? <span style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>📌 {r.ghi_chu}</span>
                      : <span style={{ fontSize: 11, color: '#d9d9d9' }}>—</span>}
                  </td>

                  {/* Mét Tới */}
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#fa8c16', fontSize: 14 }}>
                    {metToi > 0 ? metToi.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'}
                  </td>

                  {/* Mua phôi ngoài */}
                  <td style={{ ...TD, textAlign: 'center' }} className="no-print">
                    <Tooltip title={r.mua_phoi_ngoai
                      ? 'Đang đánh dấu mua phôi ngoài'
                      : 'Đánh dấu nếu phải mua phôi sóng từ NCC ngoài'}>
                      <Checkbox
                        checked={!!r.mua_phoi_ngoai}
                        disabled={!canEdit || togglePhoiNgoaiMut.isPending}
                        onChange={e => togglePhoiNgoaiMut.mutate({
                          lineId: r.id, value: e.target.checked
                        })}
                      />
                    </Tooltip>
                  </td>

                  {/* Hành động */}
                  <td style={{ ...TD, textAlign: 'center' }} className="no-print">
                    <Space size={4}>
                      {canEdit && r.trang_thai !== 'hoan_thanh' && (
                        <Popconfirm title="Hoàn thành dòng này?" onConfirm={() => completeLineMut.mutate(r.id)} okText="Có">
                          <Button size="small" type="text" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
                        </Popconfirm>
                      )}
                      {canEdit && (
                        <Popconfirm title="Xóa dòng này?" onConfirm={() => deleteLineMut.mutate(r.id)} okText="Xóa" okButtonProps={{ danger: true }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                      {r.trang_thai === 'hoan_thanh' && (
                        <Tag color="success" style={{ fontSize: 10 }}>HT</Tag>
                      )}
                    </Space>
                  </td>
                </tr>
              )
            })}

            {/* ── Dòng tổng cộng toàn kế hoạch ── */}
            <tr className="grand-total-row" style={{ background: '#fffbe6', fontWeight: 700, borderTop: '3px solid #faad14' }}>
              <td colSpan={2} style={{ ...TD, background: '#ffe58f', fontSize: 14, fontWeight: 700, color: '#614700', whiteSpace: 'nowrap' }}>
                TỔNG KẾ HOẠCH · {plan.lines.length} lệnh
              </td>
              {/* Kg từng lớp tổng (cùng mã gộp, khác mã tách) */}
              <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={grandLayers.matC}  isSong={false} bold /></td>
              <td style={{ ...TD, background: '#e6f4ff' }}><LayerEntriesCell entries={grandLayers.songC} isSong={true}  bold /></td>
              <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={grandLayers.matB}  isSong={false} bold /></td>
              <td style={{ ...TD, background: '#e6f4ff' }}><LayerEntriesCell entries={grandLayers.songB} isSong={true}  bold /></td>
              <td style={{ ...TD, background: '#f6ffed' }}><LayerEntriesCell entries={grandLayers.inner} isSong={false} bold /></td>
              {/* Tổng SL thùng + MT toàn kế hoạch */}
              <td colSpan={12} style={{ ...TD, textAlign: 'right', color: '#8c8c8c', fontSize: 13 }}>
                <b style={{ color: '#1677ff', fontSize: 15 }}>{totalSLThung.toLocaleString('vi-VN')} thùng</b>
                &nbsp;·&nbsp;Tổng MT:
              </td>
              {/* Tổng MT */}
              <td className="cell-mt" style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#fa8c16', fontSize: 18, background: '#ffe58f' }}>
                {totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
              </td>
              <td style={TD} className="no-print" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal thêm LSX */}
      <AddLinesModal
        open={addOpen}
        planId={planId}
        existingItemIds={plan.lines.map(l => l.production_order_item_id)}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['production-plan', planId] }) }}
      />
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #b0b0b0',
  textAlign: 'center',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: '#f0f5ff',
}

const TD: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #d0d0d0',
  verticalAlign: 'middle',
  fontSize: 13,
}
