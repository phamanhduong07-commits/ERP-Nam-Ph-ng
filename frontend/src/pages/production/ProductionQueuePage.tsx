import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Tag, Button, Space, Typography, Row, Col,
  Statistic, Popconfirm, message, Tooltip, Select, Badge, Divider,
} from 'antd'
import {
  PlayCircleOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, ClockCircleOutlined, ThunderboltOutlined,
  FilterOutlined, RocketOutlined, CalculatorOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TableRowSelection } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import { productionPlansApi } from '../../api/productionPlans'
import type { QueueLine } from '../../api/productionPlans'
import { LOAI_LAN_LABELS } from '../../api/quotes'

const { Text, Title } = Typography

const TRANG_THAI_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  cho:       { label: 'Chờ',        color: 'default',    icon: <ClockCircleOutlined /> },
  dang_chay: { label: 'Đang chạy', color: 'processing', icon: <ThunderboltOutlined /> },
}

// Hệ số sóng
const TAKE_UP: Record<string, number> = { E: 1.22, B: 1.32, C: 1.45, A: 1.56 }

// ─── Layer definition ────────────────────────────────────────────────────────

interface LayerDef {
  label: string        // Mặt ngoài / Sóng B / Mặt giữa…
  lbl: string          // MN / S-B / MG / MT…
  ma: string | null
  dl: number | null
  isSong: boolean
  songType: string | null  // E B C A
  kg: number
}

function getSongLetters(toHopSong: string | null | undefined): string[] {
  return (toHopSong ?? '').replace(/-/g, '').toUpperCase().split('').filter(Boolean)
}

function buildLayers(r: QueueLine): Omit<LayerDef, 'kg'>[] {
  const songs = getSongLetters(r.to_hop_song)
  const soLop = r.so_lop ?? 3

  const layers: Omit<LayerDef, 'kg'>[] = [
    { label: 'Mặt ngoài', lbl: 'MN',  ma: r.mat,    dl: r.mat_dl,    isSong: false, songType: null },
    { label: `Sóng ${songs[0] ?? '?'}`, lbl: `S-${songs[0] ?? '?'}`, ma: r.song_1, dl: r.song_1_dl, isSong: true, songType: songs[0] ?? null },
    { label: soLop <= 3 ? 'Mặt trong' : 'Mặt giữa', lbl: soLop <= 3 ? 'MT' : 'MG',
      ma: r.mat_1, dl: r.mat_1_dl, isSong: false, songType: null },
  ]
  if (soLop >= 5) {
    layers.push({ label: `Sóng ${songs[1] ?? '?'}`, lbl: `S-${songs[1] ?? '?'}`, ma: r.song_2, dl: r.song_2_dl, isSong: true, songType: songs[1] ?? null })
    layers.push({ label: soLop === 5 ? 'Mặt trong' : 'Mặt 2', lbl: soLop === 5 ? 'MT' : 'M2',
      ma: r.mat_2, dl: r.mat_2_dl, isSong: false, songType: null })
  }
  if (soLop >= 7) {
    layers.push({ label: `Sóng ${songs[2] ?? '?'}`, lbl: `S-${songs[2] ?? '?'}`, ma: r.song_3, dl: r.song_3_dl, isSong: true, songType: songs[2] ?? null })
    layers.push({ label: 'Mặt trong', lbl: 'MT', ma: r.mat_3, dl: r.mat_3_dl, isSong: false, songType: null })
  }
  return layers
}

/** Tính kg từng lớp cho 1 dòng */
function calcLayerKgs(r: QueueLine): LayerDef[] {
  const khoGiay = Number(r.kho_giay) || 0
  const daiTt   = Number(r.dai_tt)   || 0
  const soDao   = r.so_dao || 1
  const soLuong = Number(r.so_luong_ke_hoach)
  const khoMoiCon = soDao > 0 && khoGiay > 0 ? khoGiay / soDao : 0

  return buildLayers(r).map(l => {
    const take = l.isSong ? (TAKE_UP[l.songType ?? ''] ?? 1.0) : 1.0
    const area = khoMoiCon > 0 && daiTt > 0 ? (khoMoiCon * daiTt * take) / 10000 : 0
    const kg = area > 0 && (l.dl ?? 0) > 0
      ? Math.round((l.dl! * area / 1000) * soLuong * 10) / 10
      : 0
    return { ...l, kg }
  })
}

// ─── Kg summary (tổng hợp nhiều dòng) ────────────────────────────────────────

interface PaperKgEntry {
  ma: string
  dl: number | null
  isSong: boolean
  songType: string | null   // wave letter, chỉ khi isSong=true
  totalKg: number
}

/** Gộp kg từng mã giấy qua nhiều lệnh SX */
function calcKgSummary(rows: QueueLine[]): PaperKgEntry[] {
  const map = new Map<string, PaperKgEntry>()
  for (const r of rows) {
    for (const l of calcLayerKgs(r)) {
      if (!l.ma || l.kg <= 0) continue
      // key = mã giấy + định lượng + vị trí loại (sóng X hay mặt)
      const key = `${l.ma}||${l.dl ?? ''}||${l.isSong ? `song_${l.songType}` : 'mat'}`
      const ex = map.get(key)
      if (ex) {
        ex.totalKg = Math.round((ex.totalKg + l.kg) * 10) / 10
      } else {
        map.set(key, { ma: l.ma, dl: l.dl, isSong: l.isSong, songType: l.songType, totalKg: l.kg })
      }
    }
  }
  // Sort: mặt trước, sóng sau; cùng loại thì theo mã
  return Array.from(map.values()).sort((a, b) => {
    if (a.isSong !== b.isSong) return a.isSong ? 1 : -1
    return (a.ma ?? '').localeCompare(b.ma ?? '')
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProductionQueuePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [filterTT,      setFilterTT]      = useState<string | undefined>(undefined)
  const [filterKho,     setFilterKho]     = useState<number | undefined>(undefined)
  const [filterLoaiLan, setFilterLoaiLan] = useState<string | undefined>(undefined)
  const [selectedKeys,  setSelectedKeys]  = useState<React.Key[]>([])

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: allLines = [], isLoading, refetch } = useQuery({
    queryKey: ['production-queue', filterTT],
    queryFn: () => productionPlansApi.getQueue(filterTT).then(r => r.data),
    refetchInterval: 30_000,
  })

  const lines = useMemo(() => {
    let r = allLines
    if (filterKho)     r = r.filter(l => Number(l.kho_giay) === filterKho)
    if (filterLoaiLan) r = r.filter(l => l.loai_lan === filterLoaiLan)   // FIX: dùng loai_lan
    return r
  }, [allLines, filterKho, filterLoaiLan])

  const khoOptions = useMemo(() => {
    const s = new Set<number>()
    allLines.forEach(l => { if (l.kho_giay) s.add(Number(l.kho_giay)) })
    return Array.from(s).sort((a, b) => a - b).map(v => ({ value: v, label: `${v} cm` }))
  }, [allLines])

  const loaiLanOptions = useMemo(() => {   // FIX: dùng loai_lan
    const s = new Set<string>()
    allLines.forEach(l => { if (l.loai_lan) s.add(l.loai_lan) })
    return Array.from(s).sort().map(v => ({ value: v, label: LOAI_LAN_LABELS[v] ?? v }))
  }, [allLines])

  // ── selected & planning ───────────────────────────────────────────────────
  const selectedRows = useMemo(() => lines.filter(l => selectedKeys.includes(l.id)), [lines, selectedKeys])
  const planningRows = selectedRows.length > 0 ? selectedRows : (filterKho || filterLoaiLan) ? lines : []
  const kgSummary    = useMemo(() => calcKgSummary(planningRows), [planningRows])
  const kgMat        = kgSummary.filter(p => !p.isSong)
  const kgSong       = kgSummary.filter(p => p.isSong)
  const totalKg      = kgSummary.reduce((s, p) => s + p.totalKg, 0)
  const showPanel    = planningRows.length > 0

  // ── mutations ─────────────────────────────────────────────────────────────
  const startMut = useMutation({
    mutationFn: (id: number) => productionPlansApi.startQueueLine(id),
    onSuccess: () => { message.success('Đã bắt đầu chạy'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError:   (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const completeMut = useMutation({
    mutationFn: ({ planId, lineId }: { planId: number; lineId: number }) =>
      productionPlansApi.completeLine(planId, lineId),
    onSuccess: () => { message.success('Đã hoàn thành'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError:   (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const deleteMut = useMutation({
    mutationFn: ({ planId, lineId }: { planId: number; lineId: number }) =>
      productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError:   (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const choCnt      = allLines.filter(l => l.trang_thai === 'cho').length
  const dangChayCnt = allLines.filter(l => l.trang_thai === 'dang_chay').length

  // ── row selection ─────────────────────────────────────────────────────────
  const rowSelection: TableRowSelection<QueueLine> = {
    selectedRowKeys: selectedKeys,
    onChange: keys => setSelectedKeys(keys),
    getCheckboxProps: r => ({ disabled: r.trang_thai !== 'cho' }),
  }

  // ── columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<QueueLine> = [
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
      title: 'Tên hàng / KH',
      width: 160,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{r.ten_hang || '—'}</Text>
          {r.ten_khach_hang && (
            <Text type="secondary" style={{ fontSize: 10 }}>{r.ma_kh} · {r.ten_khach_hang}</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kích thước',
      width: 120,
      render: (_, r) => r.dai ? (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{r.dai}×{r.rong}×{r.cao}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>{r.loai_thung} · {r.so_lop}L</Text>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Loại lằn',
      dataIndex: 'loai_lan',
      width: 100,
      align: 'center',
      render: (v) => v
        ? <Tag color="volcano" style={{ fontSize: 11 }}>{LOAI_LAN_LABELS[v] ?? v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 62,
      align: 'center',
      render: v => v
        ? <Tag color="purple" style={{ fontSize: 13, fontWeight: 700, padding: '0 6px' }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khổ (cm)',
      dataIndex: 'kho_giay',
      width: 72,
      align: 'center',
      render: v => v
        ? <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{Number(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt (cm)',
      dataIndex: 'dai_tt',
      width: 68,
      align: 'center',
      render: v => v
        ? <Text strong style={{ fontSize: 13 }}>{Number(v)}</Text>
        : <Text type="secondary">—</Text>,
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
      width: 68,
      align: 'center',
      render: (_, r) => {
        const n = r.so_dao && r.so_dao > 0 ? Math.ceil(Number(r.so_luong_ke_hoach) / r.so_dao) : null
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
      // Kết cấu giấy — từng lớp riêng biệt với mã + ĐL
      title: 'Kết cấu giấy',
      width: 180,
      render: (_, r) => {
        const layers = buildLayers(r).filter(l => l.ma)
        if (!layers.length) return <Text type="secondary">—</Text>
        return (
          <Space direction="vertical" size={2}>
            {layers.map((l, i) => (
              <Space key={i} size={4} align="center">
                <Tag
                  color={l.isSong ? 'blue' : 'green'}
                  style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '16px', minWidth: 30, textAlign: 'center' }}
                >
                  {l.lbl}
                </Tag>
                <Text style={{ fontSize: 11, fontWeight: 500 }}>{l.ma}</Text>
                {l.dl != null && (
                  <Text type="secondary" style={{ fontSize: 10 }}>{l.dl}g</Text>
                )}
              </Space>
            ))}
          </Space>
        )
      },
    },
    {
      // Kg từng lớp — hover chi tiết
      title: 'Kg',
      width: 70,
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
                  <div key={i} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
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
        if (!v) return '—'
        const d = dayjs(v)
        const late = d.isBefore(dayjs(), 'day')
        return <Text style={{ fontSize: 11, color: late ? '#ff4d4f' : undefined }}>{d.format('DD/MM/YY')}</Text>
      },
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 90,
      align: 'center',
      render: v => {
        const cfg = TRANG_THAI_CFG[v] ?? { label: v, color: 'default', icon: null }
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Hành động',
      width: 90,
      align: 'center',
      fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.trang_thai === 'cho' && (
            <Tooltip title="Bắt đầu chạy máy">
              <Popconfirm title="Bắt đầu chạy dòng này?" onConfirm={() => startMut.mutate(r.id)} okText="Bắt đầu">
                <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={startMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.trang_thai === 'dang_chay' && (
            <Tooltip title="Hoàn thành">
              <Popconfirm title="Đánh dấu hoàn thành?" onConfirm={() => completeMut.mutate({ planId: r.plan_id, lineId: r.id })} okText="Hoàn thành">
                <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} loading={completeMut.isPending} />
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

  // ── expanded row: chi tiết từng lớp + kg ─────────────────────────────────
  const expandedRowRender = (r: QueueLine) => {
    const layers = calcLayerKgs(r)
    if (!layers.some(l => l.ma)) return <Text type="secondary">Chưa có thông tin kết cấu giấy</Text>
    const total = layers.reduce((s, l) => s + l.kg, 0)
    return (
      <div style={{ padding: '4px 0 4px 40px' }}>
        <Text strong style={{ fontSize: 12 }}>
          Chi tiết — Khổ {Number(r.kho_giay)} cm / Cắt {Number(r.dai_tt)} cm / {r.so_dao} dao / {Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')} thùng
        </Text>
        <table style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              {['Lớp', 'Loại', 'Mã giấy', 'ĐL (g/m²)', 'Hệ số sóng', 'Diện tích/c (m²)', 'Kg'].map(h => (
                <th key={h} style={{ padding: '4px 10px', border: '1px solid #f0f0f0', textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {layers.map((l, i) => {
              const khoGiay = Number(r.kho_giay) || 0
              const soDao   = r.so_dao || 1
              const daiTt   = Number(r.dai_tt) || 0
              const khoMoiCon = soDao > 0 ? khoGiay / soDao : 0
              const take = l.isSong ? (TAKE_UP[l.songType ?? ''] ?? 1.0) : 1.0
              const area = khoMoiCon > 0 && daiTt > 0 ? (khoMoiCon * daiTt * take) / 10000 : 0
              return (
                <tr key={i} style={{ background: l.isSong ? '#f0f5ff' : undefined }}>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0' }}>{l.label}</td>
                  <td style={{ padding: '3px 10px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Tag color={l.isSong ? 'blue' : 'green'} style={{ margin: 0, fontSize: 11 }}>
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

  // ─── Render bảng tổng hợp vật liệu ──────────────────────────────────────
  const renderKgTable = (entries: PaperKgEntry[], label: string, color: 'green' | 'blue') => (
    <>
      <div style={{ background: color === 'green' ? '#f6ffed' : '#f0f5ff', borderRadius: 4, padding: '4px 8px', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 12, color: color === 'green' ? '#389e0d' : '#1677ff' }}>
          {label} ({entries.length} mã)
        </Text>
      </div>
      {entries.length === 0 ? (
        <div style={{ padding: '4px 8px', color: '#bbb', fontSize: 12 }}>—</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '3px 6px', border: '1px solid #f0f0f0' }}>Mã giấy</th>
              <th style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>ĐL (g/m²)</th>
              {color === 'blue' && (
                <th style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>Sóng</th>
              )}
              <th style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'right' }}>Tổng kg</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((p, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? '#fafafa' : undefined }}>
                <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', fontWeight: 600 }}>{p.ma}</td>
                <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center', color: '#595959' }}>
                  {p.dl != null ? p.dl : '—'}
                </td>
                {color === 'blue' && (
                  <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Tag color="purple" style={{ margin: 0, fontSize: 10, padding: '0 3px' }}>{p.songType}</Tag>
                  </td>
                )}
                <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, color: '#1677ff' }}>
                  {p.totalKg.toFixed(1)}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#e6f4ff' }}>
              <td colSpan={color === 'blue' ? 3 : 2} style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 600, fontSize: 11 }}>
                Tổng {label.toLowerCase()}
              </td>
              <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, color: color === 'green' ? '#389e0d' : '#1677ff' }}>
                {entries.reduce((s, p) => s + p.totalKg, 0).toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  )

  // ─── render ───────────────────────────────────────────────────────────────
  return (
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
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
        </Col>
      </Row>

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

      {/* ── Filter bar ── */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <FilterOutlined style={{ color: '#8c8c8c' }} />
          <Select
            style={{ width: 140 }}
            placeholder="Trạng thái"
            allowClear
            value={filterTT}
            onChange={v => { setFilterTT(v); setSelectedKeys([]) }}
            options={[
              { value: 'cho',       label: 'Chờ chạy' },
              { value: 'dang_chay', label: 'Đang chạy' },
            ]}
          />
          <Select
            style={{ width: 160 }}
            placeholder="🔍 Lọc theo khổ giấy (cm)"
            allowClear
            value={filterKho}
            onChange={v => { setFilterKho(v); setSelectedKeys([]) }}
            options={khoOptions}
          />
          <Select
            style={{ width: 140 }}
            placeholder="Loại lằn"
            allowClear
            value={filterLoaiLan}
            onChange={v => { setFilterLoaiLan(v); setSelectedKeys([]) }}
            options={loaiLanOptions}
          />
          {(filterKho || filterLoaiLan || filterTT) && (
            <Button size="small" onClick={() => {
              setFilterKho(undefined); setFilterLoaiLan(undefined)
              setFilterTT(undefined); setSelectedKeys([])
            }}>
              Xóa lọc
            </Button>
          )}
          {selectedKeys.length > 0 && (
            <Tag color="blue" style={{ fontSize: 12 }}>
              Đã chọn {selectedKeys.length} dòng
            </Tag>
          )}
          {filterKho && (
            <Tag color="cyan" style={{ fontSize: 12 }}>
              Khổ {filterKho} cm — {lines.length} lệnh
            </Tag>
          )}
        </Space>
      </Card>

      {/* ── Main area: table + planning panel ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card bodyStyle={{ padding: 0 }}>
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="id"
              loading={isLoading}
              rowSelection={rowSelection}
              expandable={{
                expandedRowRender,
                rowExpandable: r => !!(r.mat || r.song_1),
              }}
              pagination={{ pageSize: 50, showSizeChanger: false }}
              size="small"
              scroll={{ x: 1500 }}
              rowClassName={r => r.trang_thai === 'dang_chay' ? 'ant-table-row-selected' : ''}
            />
          </Card>
        </div>

        {/* ── Planning panel ── */}
        {showPanel && (
          <div style={{ width: 340, flexShrink: 0 }}>
            <Card
              size="small"
              style={{ position: 'sticky', top: 16 }}
              title={
                <Space>
                  <CalculatorOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedRows.length > 0
                      ? `${selectedRows.length} lệnh đã chọn`
                      : filterKho
                        ? `Khổ ${filterKho} cm — ${lines.length} lệnh`
                        : `${lines.length} lệnh đang lọc`}
                  </span>
                </Space>
              }
            >
              {/* Tổng quan */}
              <Row gutter={8} style={{ marginBottom: 10 }}>
                <Col span={12}>
                  <Statistic title="Số lệnh SX" value={planningRows.length} valueStyle={{ fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tổng kg"
                    value={totalKg.toFixed(1)}
                    suffix="kg"
                    valueStyle={{ fontSize: 20, color: '#fa8c16' }}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              {/* ── Mặt giấy ── */}
              {renderKgTable(kgMat, 'Mặt giấy', 'green')}

              {/* ── Sóng ── */}
              {renderKgTable(kgSong, 'Sóng', 'blue')}

              {/* Tổng cộng */}
              {kgSummary.length > 0 && (
                <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4, padding: '6px 10px', marginBottom: 10 }}>
                  <Row justify="space-between" align="middle">
                    <Col><Text strong style={{ fontSize: 13 }}>Tổng cộng tất cả</Text></Col>
                    <Col><Text strong style={{ fontSize: 16, color: '#fa8c16' }}>{totalKg.toFixed(1)} kg</Text></Col>
                  </Row>
                </div>
              )}

              {kgSummary.length === 0 && (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                  Chưa có dữ liệu kết cấu giấy
                </div>
              )}

              <Divider style={{ margin: '8px 0' }} />

              {/* Nút đưa vào KHSX */}
              <Popconfirm
                title={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      Xác nhận đưa {planningRows.length} lệnh vào Kế hoạch SX?
                    </div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      Tổng vật liệu cần chuẩn bị: <b>{totalKg.toFixed(1)} kg</b>
                    </div>
                  </div>
                }
                onConfirm={() => {
                  message.success(
                    `Đã lập kế hoạch SX cho ${planningRows.length} lệnh (${totalKg.toFixed(0)} kg vật liệu)`
                  )
                  setSelectedKeys([])
                }}
                okText="Xác nhận lập KH"
                cancelText="Huỷ"
                okButtonProps={{ type: 'primary' }}
              >
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  block
                  size="middle"
                  style={{ marginBottom: 4 }}
                >
                  Đưa vào Kế hoạch SX
                </Button>
              </Popconfirm>

              <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center' }}>
                {selectedRows.length > 0
                  ? 'Đang tính cho các dòng đã tích chọn'
                  : 'Đang tính tất cả dòng đang lọc — tích chọn để lọc riêng'}
              </Text>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
