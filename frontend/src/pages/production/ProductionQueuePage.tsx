import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Tag, Button, Space, Typography, Row, Col,
  Statistic, Popconfirm, message, Tooltip, Select, Badge,
} from 'antd'
import {
  PlayCircleOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, ClockCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType, ExpandableConfig } from 'antd/es/table'
import dayjs from 'dayjs'
import { productionPlansApi } from '../../api/productionPlans'
import type { QueueLine } from '../../api/productionPlans'

const { Text, Title } = Typography

const TRANG_THAI_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  cho:        { label: 'Chờ',        color: 'default',    icon: <ClockCircleOutlined /> },
  dang_chay:  { label: 'Đang chạy', color: 'processing', icon: <ThunderboltOutlined /> },
}

// Hệ số sóng để tính kg
const TAKE_UP: Record<string, number> = { E: 1.22, B: 1.32, C: 1.45, A: 1.56 }

interface LayerKg {
  label: string
  ma: string | null
  dl: number | null
  isSong: boolean
  songType: string | null
  kg: number
}

function calcLayerKgs(r: QueueLine): LayerKg[] {
  const khoTt  = Number(r.kho_giay) || 0
  const daiTt  = Number(r.dai_tt)   || 0
  const soDao  = r.so_dao || 1
  const soLuong = Number(r.so_luong_ke_hoach)
  const khoMoiCon = soDao > 0 && khoTt > 0 ? khoTt / soDao : 0

  const songs = (r.to_hop_song ?? '').replace(/-/g, '').toUpperCase().split('')

  const layers: Array<{ label: string; ma: string | null; dl: number | null; isSong: boolean; songType: string | null }> = [
    { label: 'Mặt ngoài', ma: r.mat,    dl: r.mat_dl,    isSong: false, songType: null },
    { label: `Sóng ${songs[0] ?? ''}`,  ma: r.song_1, dl: r.song_1_dl, isSong: true, songType: songs[0] ?? null },
    { label: (r.so_lop ?? 3) <= 3 ? 'Mặt trong' : 'Mặt giữa', ma: r.mat_1, dl: r.mat_1_dl, isSong: false, songType: null },
  ]
  if ((r.so_lop ?? 3) >= 5) {
    layers.push({ label: `Sóng ${songs[1] ?? ''}`, ma: r.song_2, dl: r.song_2_dl, isSong: true, songType: songs[1] ?? null })
    layers.push({ label: (r.so_lop ?? 3) === 5 ? 'Mặt trong' : 'Mặt 2', ma: r.mat_2, dl: r.mat_2_dl, isSong: false, songType: null })
  }
  if ((r.so_lop ?? 3) >= 7) {
    layers.push({ label: `Sóng ${songs[2] ?? ''}`, ma: r.song_3, dl: r.song_3_dl, isSong: true, songType: songs[2] ?? null })
    layers.push({ label: 'Mặt trong', ma: r.mat_3, dl: r.mat_3_dl, isSong: false, songType: null })
  }

  return layers.map(l => {
    const take = l.isSong ? (TAKE_UP[l.songType ?? ''] ?? 1.0) : 1.0
    const area = khoMoiCon > 0 && daiTt > 0 ? (khoMoiCon * daiTt * take) / 10000 : 0
    const kg = area > 0 && (l.dl ?? 0) > 0 ? Math.round((l.dl! * area / 1000) * soLuong * 10) / 10 : 0
    return { ...l, kg }
  })
}

// Compact paper structure for table cell
function KetCauCell({ r }: { r: QueueLine }) {
  const layers = calcLayerKgs(r)
  const hasData = layers.some(l => l.ma)
  if (!hasData) return <Text type="secondary">—</Text>
  return (
    <Space direction="vertical" size={2}>
      {layers.map((l, i) => l.ma ? (
        <Space key={i} size={4} wrap={false}>
          <Tag color={l.isSong ? 'blue' : 'green'} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
            {l.isSong ? 'S' : 'M'}
          </Tag>
          <Text style={{ fontSize: 11 }}>{l.ma}</Text>
          {l.dl && <Text type="secondary" style={{ fontSize: 10 }}>{l.dl}g</Text>}
          {l.kg > 0 && <Text style={{ fontSize: 11, color: '#1677ff' }}>{l.kg.toFixed(0)}kg</Text>}
        </Space>
      ) : null)}
    </Space>
  )
}

export default function ProductionQueuePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filterTT, setFilterTT] = useState<string | undefined>(undefined)

  const { data: lines = [], isLoading, refetch } = useQuery({
    queryKey: ['production-queue', filterTT],
    queryFn: () => productionPlansApi.getQueue(filterTT).then(r => r.data),
    refetchInterval: 30_000,
  })

  const startMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.startQueueLine(lineId),
    onSuccess: () => { message.success('Đã bắt đầu chạy'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const completeMut = useMutation({
    mutationFn: ({ planId, lineId }: { planId: number; lineId: number }) =>
      productionPlansApi.completeLine(planId, lineId),
    onSuccess: () => { message.success('Đã hoàn thành'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const deleteMut = useMutation({
    mutationFn: ({ planId, lineId }: { planId: number; lineId: number }) =>
      productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['production-queue'] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const choCnt      = lines.filter(l => l.trang_thai === 'cho').length
  const dangChayCnt = lines.filter(l => l.trang_thai === 'dang_chay').length

  const columns: ColumnsType<QueueLine> = [
    {
      title: 'STT',
      dataIndex: 'thu_tu',
      width: 48,
      align: 'center',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 115,
      render: (v, r) => v
        ? <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
            onClick={() => navigate(`/production/orders/${r.production_order_item_id}`)}>
            {v}
          </Button>
        : '—',
    },
    {
      title: 'Tên hàng / Khách hàng',
      width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{r.ten_hang || '—'}</Text>
          {r.ten_khach_hang && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.ma_kh} · {r.ten_khach_hang}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kích thước / Loại lằn',
      width: 170,
      render: (_, r) => r.dai ? (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{r.loai_thung} · {r.dai}×{r.rong}×{r.cao} cm</Text>
          <Space size={4}>
            <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
              {r.so_lop} lớp
            </Tag>
            {r.to_hop_song && (
              <Text style={{ fontSize: 11, color: '#722ed1' }}>{r.to_hop_song}</Text>
            )}
          </Space>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khổ / Cắt',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
          {r.kho_giay
            ? <Text strong style={{ color: '#1677ff', fontSize: 13 }}>{Number(r.kho_giay)} cm</Text>
            : <Text type="secondary">—</Text>}
          {r.dai_tt
            ? <Text style={{ fontSize: 11 }}>cắt {Number(r.dai_tt)} cm</Text>
            : null}
        </Space>
      ),
    },
    {
      title: 'Số dao / Lần chạy',
      width: 110,
      align: 'center',
      render: (_, r) => {
        const soLanChay = r.so_dao && r.so_dao > 0
          ? Math.ceil(Number(r.so_luong_ke_hoach) / r.so_dao)
          : null
        return (
          <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
            {r.so_dao
              ? <><Text strong style={{ fontSize: 14 }}>{r.so_dao}</Text><Text type="secondary" style={{ fontSize: 10 }}> dao</Text></>
              : <Text type="secondary">—</Text>}
            {soLanChay
              ? <Text style={{ fontSize: 11, color: '#52c41a' }}>{soLanChay.toLocaleString('vi-VN')} lần</Text>
              : null}
          </Space>
        )
      },
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'so_luong_ke_hoach',
      width: 90,
      align: 'right',
      render: (v) => <Text strong style={{ fontSize: 13 }}>{Number(v).toLocaleString('vi-VN')}</Text>,
    },
    {
      title: 'Kết cấu giấy + kg',
      width: 200,
      render: (_, r) => <KetCauCell r={r} />,
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 85,
      align: 'center',
      render: (v) => {
        if (!v) return '—'
        const d = dayjs(v)
        const isLate = d.isBefore(dayjs(), 'day')
        return (
          <Text style={{ fontSize: 12, color: isLate ? '#ff4d4f' : undefined }}>
            {d.format('DD/MM/YY')}
          </Text>
        )
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      width: 110,
      render: (v) => v
        ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>
        : null,
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 100,
      align: 'center',
      render: (v) => {
        const cfg = TRANG_THAI_CFG[v] ?? { label: v, color: 'default', icon: null }
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Hành động',
      width: 110,
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

  // Expandable row: bảng chi tiết kết cấu giấy
  const expandable: ExpandableConfig<QueueLine> = {
    expandedRowRender: (r) => {
      const layers = calcLayerKgs(r)
      const hasData = layers.some(l => l.ma)
      if (!hasData) return <Text type="secondary">Chưa có thông tin kết cấu giấy</Text>
      const totalKg = layers.reduce((s, l) => s + l.kg, 0)
      return (
        <div style={{ padding: '4px 0 4px 32px' }}>
          <Text strong style={{ fontSize: 12 }}>Chi tiết kết cấu — chiều khổ {Number(r.kho_giay)} cm / cắt {Number(r.dai_tt)} cm / {r.so_dao} dao</Text>
          <table style={{ marginTop: 8, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                {['Lớp', 'Loại', 'Mã giấy', 'ĐL (g/m²)', 'Hệ số', 'Kg tổng'].map(h => (
                  <th key={h} style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {layers.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0' }}>{l.label}</td>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Tag color={l.isSong ? 'blue' : 'green'} style={{ margin: 0 }}>{l.isSong ? 'Sóng' : 'Mặt'}</Tag>
                  </td>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0' }}>{l.ma || '—'}</td>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'right' }}>{l.dl ?? '—'}</td>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    {l.isSong ? TAKE_UP[l.songType ?? '']?.toFixed(2) ?? '—' : '—'}
                  </td>
                  <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#1677ff', fontWeight: 600 }}>
                    {l.kg > 0 ? `${l.kg.toFixed(1)} kg` : '—'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#fffbe6' }}>
                <td colSpan={5} style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 600 }}>Tổng cộng</td>
                <td style={{ padding: '4px 12px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#fa8c16', fontWeight: 700 }}>
                  {totalKg.toFixed(1)} kg
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    },
    rowExpandable: (r) => !!(r.mat || r.song_1),
  }

  return (
    <div>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Kế hoạch sản xuất chờ
            {choCnt > 0 && <Badge count={choCnt} style={{ marginLeft: 8 }} />}
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              style={{ width: 150 }}
              placeholder="Tất cả trạng thái"
              allowClear
              value={filterTT}
              onChange={setFilterTT}
              options={[
                { value: 'cho',       label: 'Chờ' },
                { value: 'dang_chay', label: 'Đang chạy' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Chờ chạy" value={choCnt} valueStyle={{ color: '#8c8c8c' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Đang chạy" value={dangChayCnt} valueStyle={{ color: '#1677ff' }} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng dòng" value={lines.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Tổng SL"
              value={lines.reduce((s, l) => s + Number(l.so_luong_ke_hoach), 0).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={lines}
          rowKey="id"
          loading={isLoading}
          expandable={expandable}
          pagination={{ pageSize: 50, showSizeChanger: false }}
          size="small"
          scroll={{ x: 1400 }}
          rowClassName={(r) => r.trang_thai === 'dang_chay' ? 'ant-table-row-selected' : ''}
        />
      </Card>
    </div>
  )
}
