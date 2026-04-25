import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Tag, Button, Space, Typography, Row, Col,
  Statistic, Popconfirm, message, Tooltip, Badge, Divider, Alert,
} from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import {
  PlayCircleOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, ClockCircleOutlined, ThunderboltOutlined,
  FileTextOutlined, CalculatorOutlined, InfoCircleOutlined,
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
  const soLuong = Number(r.so_luong_ke_hoach)
  const khoMoiCon = soDao > 0 && khoGiay > 0 ? khoGiay / soDao : 0
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductionQueuePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Antd table filter state
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({})
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])

  const handleTableChange = (
    _pagination: any,
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

  const planningRows = selectedRows.length > 0 ? selectedRows : hasFilter ? filteredLines : []
  const kgSummary    = useMemo(() => calcKgSummary(planningRows), [planningRows])
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
      width: 155,
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
      width: 110,
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
        ? <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{Number(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Cắt (cm)',
      dataIndex: 'dai_tt',
      width: 70,
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
      width: 70,
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
      // Từng lớp riêng: [tag lớp] mã  dl g
      title: 'Kết cấu giấy',
      width: 185,
      render: (_, r) => {
        const layers = calcLayerKgs(r).filter(l => l.ma)
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
      width: 90,
      align: 'center',
      filters: ttOptions,
      filteredValue: filteredInfo['trang_thai'] || null,
      onFilter: (value, r) => r.trang_thai === value,
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

  // ── expanded row ──────────────────────────────────────────────────────────
  const expandedRowRender = (r: QueueLine) => {
    const layers = calcLayerKgs(r)
    if (!layers.some(l => l.ma)) return <Text type="secondary">Chưa có thông tin kết cấu giấy</Text>
    const total = layers.reduce((s, l) => s + l.kg, 0)
    const khoGiay   = Number(r.kho_giay) || 0
    const soDao     = r.so_dao || 1
    const daiTt     = Number(r.dai_tt) || 0
    const khoMoiCon = soDao > 0 ? khoGiay / soDao : 0
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
              <Tag color="blue">Đã chọn {selectedKeys.length} dòng</Tag>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
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

      {/* ── Main area ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card bodyStyle={{ padding: 0 }}>
            <Table
              columns={columns}
              dataSource={allLines}
              rowKey="id"
              loading={isLoading}
              rowSelection={rowSelection}
              onChange={handleTableChange}
              expandable={{
                expandedRowRender,
                rowExpandable: r => !!(r.mat || r.song_1),
              }}
              pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t, [s, e]) => `${s}-${e} / ${t}` }}
              size="small"
              scroll={{ x: 1460 }}
              rowClassName={r => r.trang_thai === 'dang_chay' ? 'ant-table-row-selected' : ''}
            />
          </Card>
        </div>

        {/* ── Planning panel ── */}
        {showPanel && (
          <div style={{ width: 330, flexShrink: 0 }}>
            <Card
              size="small"
              style={{ position: 'sticky', top: 16 }}
              title={
                <Space>
                  <CalculatorOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedRows.length > 0
                      ? `${selectedRows.length} lệnh đã chọn`
                      : `${planningRows.length} lệnh đang lọc`}
                  </span>
                </Space>
              }
            >
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col span={12}>
                  <Statistic title="Số lệnh SX" value={planningRows.length} valueStyle={{ fontSize: 20 }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Tổng kg" value={totalKg.toFixed(1)} suffix="kg"
                    valueStyle={{ fontSize: 20, color: '#fa8c16' }} />
                </Col>
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              {/* Bảng vật liệu — mỗi lớp là 1 dòng riêng */}
              {kgSummary.length === 0 ? (
                <div style={{ padding: '12px 0', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                  Chưa có dữ liệu kết cấu giấy
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '4px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>Lớp</th>
                      <th style={{ padding: '4px 6px', border: '1px solid #f0f0f0' }}>Mã giấy</th>
                      <th style={{ padding: '4px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>ĐL</th>
                      <th style={{ padding: '4px 6px', border: '1px solid #f0f0f0', textAlign: 'right' }}>Kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kgSummary.map((p, i) => (
                      <tr key={i} style={{ background: p.isSong ? '#f0f5ff' : '#f6ffed' }}>
                        <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          <Tag
                            color={p.isSong ? 'blue' : 'green'}
                            style={{ fontSize: 10, padding: '0 4px', margin: 0, lineHeight: '16px' }}
                          >
                            {p.lbl}
                          </Tag>
                        </td>
                        <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', fontWeight: 600 }}>{p.ma}</td>
                        <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'center', color: '#8c8c8c' }}>
                          {p.dl != null ? `${p.dl}g` : '—'}
                        </td>
                        <td style={{ padding: '3px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, color: '#1677ff' }}>
                          {p.totalKg.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fffbe6' }}>
                      <td colSpan={3} style={{ padding: '4px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700 }}>
                        Tổng cộng
                      </td>
                      <td style={{ padding: '4px 6px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 700, color: '#fa8c16' }}>
                        {totalKg.toFixed(1)} kg
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              <Divider style={{ margin: '10px 0 8px' }} />

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

              <Alert
                type="info"
                icon={<InfoCircleOutlined />}
                showIcon
                style={{ fontSize: 11, padding: '4px 8px' }}
                message={
                  <span style={{ fontSize: 11 }}>
                    Dữ liệu <b>không mất</b> khỏi hàng chờ. Dòng chỉ rời hàng chờ khi được đánh dấu <b>Hoàn thành</b>.
                  </span>
                }
              />

              <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 6 }}>
                {selectedRows.length > 0
                  ? 'Tính theo dòng đã tích chọn'
                  : 'Tính theo tất cả dòng đang lọc'}
              </Text>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
