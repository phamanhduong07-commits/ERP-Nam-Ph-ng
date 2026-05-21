import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Input, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import { AlertOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface DrainAlert {
  id: number
  bien_so: string
  xe_id: number | null
  ngay: string
  gio: string | null
  so_lit: number
  drain_rate_L_per_h: number
  dia_diem: string | null
  phan_loai: string
  muc_canh_bao: string
  trang_thai: string
  created_at: string | null
}

const PHAN_LOAI_CONFIG: Record<string, { color: string; label: string }> = {
  rut_khi_dung: { color: 'red', label: 'Rút khi dừng' },
  tieu_hao_bat_thuong: { color: 'orange', label: 'Tiêu hao bất thường' },
}

const TRANG_THAI_CONFIG: Record<string, { color: string; label: string }> = {
  moi: { color: 'red', label: 'Mới' },
  dang_xu_ly: { color: 'orange', label: 'Đang xử lý' },
  da_xu_ly: { color: 'green', label: 'Đã xử lý' },
}

const fmt1 = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export default function CanhBaoDauPage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.subtract(7, 'day'), today])
  const [filterPlate, setFilterPlate] = useState('')
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>(undefined)

  const fromDate = range[0].format('YYYY-MM-DD')
  const toDate = range[1].format('YYYY-MM-DD')

  const queryClient = useQueryClient()

  const { data = [], isFetching, refetch } = useQuery<DrainAlert[]>({
    queryKey: ['drain-alerts', fromDate, toDate, filterPlate, filterTrangThai],
    queryFn: async () => {
      const params: Record<string, string> = { from_date: fromDate, to_date: toDate }
      if (filterPlate) params.bien_so = filterPlate
      if (filterTrangThai) params.trang_thai = filterTrangThai
      const res = await client.get('/gps/drain-alerts', { params })
      return res.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, trang_thai }: { id: number; trang_thai: string }) => {
      await client.put(`/gps/drain-alerts/${id}`, null, { params: { trang_thai } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drain-alerts'] })
    },
  })

  const moiCount = data.filter(r => r.trang_thai === 'moi').length
  const dangXuLyCount = data.filter(r => r.trang_thai === 'dang_xu_ly').length
  const daXuLyCount = data.filter(r => r.trang_thai === 'da_xu_ly').length
  const rutKhiDungCount = data.filter(r => r.phan_loai === 'rut_khi_dung').length

  const columns = [
    {
      title: 'Biển số',
      dataIndex: 'bien_so',
      key: 'bien_so',
      width: 110,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      key: 'ngay',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Giờ phát hiện',
      dataIndex: 'gio',
      key: 'gio',
      width: 110,
      render: (v: string | null) => v ? dayjs(v).format('HH:mm') : '—',
    },
    {
      title: 'Hụt (L)',
      dataIndex: 'so_lit',
      key: 'so_lit',
      width: 80,
      align: 'right' as const,
      sorter: (a: DrainAlert, b: DrainAlert) => a.so_lit - b.so_lit,
      render: (v: number) => <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>{fmt1(v)}</Text>,
    },
    {
      title: 'Tốc độ (L/h)',
      dataIndex: 'drain_rate_L_per_h',
      key: 'drain_rate_L_per_h',
      width: 100,
      align: 'right' as const,
      sorter: (a: DrainAlert, b: DrainAlert) => a.drain_rate_L_per_h - b.drain_rate_L_per_h,
      render: (v: number) => <Text type="secondary">{fmt1(v)}</Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'phan_loai',
      key: 'phan_loai',
      width: 160,
      render: (v: string) => {
        const cfg = PHAN_LOAI_CONFIG[v] ?? { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Địa điểm',
      dataIndex: 'dia_diem',
      key: 'dia_diem',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Text type="secondary" style={{ fontSize: 12 }}>{v.slice(0, 50)}{v.length > 50 ? '…' : ''}</Text>
          </Tooltip>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 160,
      defaultSortOrder: 'ascend' as const,
      sorter: (a: DrainAlert, b: DrainAlert) => {
        const ORDER: Record<string, number> = { moi: 0, dang_xu_ly: 1, da_xu_ly: 2 }
        return (ORDER[a.trang_thai] ?? 0) - (ORDER[b.trang_thai] ?? 0)
      },
      render: (v: string, r: DrainAlert) => (
        <Select
          size="small"
          value={v}
          style={{ width: 140 }}
          loading={updateMutation.isPending}
          onChange={newVal => updateMutation.mutate({ id: r.id, trang_thai: newVal })}
          options={[
            { value: 'moi', label: <Tag color="red" style={{ margin: 0 }}>Mới</Tag> },
            { value: 'dang_xu_ly', label: <Tag color="orange" style={{ margin: 0 }}>Đang xử lý</Tag> },
            { value: 'da_xu_ly', label: <Tag color="green" style={{ margin: 0 }}>Đã xử lý</Tag> },
          ]}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <AlertOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
          Cảnh báo hụt dầu — Thời gian thực
        </Title>
        <Space wrap>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Input
            placeholder="Lọc biển số..."
            value={filterPlate}
            onChange={e => setFilterPlate(e.target.value)}
            allowClear
            style={{ width: 140 }}
          />
          <Select
            placeholder="Trạng thái"
            value={filterTrangThai}
            onChange={v => setFilterTrangThai(v)}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'moi', label: 'Mới' },
              { value: 'dang_xu_ly', label: 'Đang xử lý' },
              { value: 'da_xu_ly', label: 'Đã xử lý' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Tải lại
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng cảnh báo"
              value={data.length}
              valueStyle={{ color: '#1677ff' }}
              suffix="sự kiện"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Chưa xử lý"
              value={moiCount}
              valueStyle={{ color: moiCount > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix="cảnh báo"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Đang xử lý"
              value={dangXuLyCount}
              valueStyle={{ color: dangXuLyCount > 0 ? '#faad14' : '#8c8c8c' }}
              suffix="cảnh báo"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Rút khi dừng"
              value={rutKhiDungCount}
              valueStyle={{ color: rutKhiDungCount > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix={`/ ${data.length}`}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`Danh sách cảnh báo (${data.length})`}>
        <Table<DrainAlert>
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isFetching}
          size="small"
          pagination={{ pageSize: 50, showTotal: total => `Tổng ${total} sự kiện` }}
          onRow={r => ({
            style: {
              background: r.trang_thai === 'moi'
                ? '#fff1f0'
                : r.trang_thai === 'dang_xu_ly'
                  ? '#fffbe6'
                  : '',
            },
          })}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 Hệ thống tự động phát hiện 2 loại bất thường: (1) <strong>Rút khi dừng</strong> — xe dừng, dầu hụt ≥8L với tốc độ &gt;10 L/h;
          (2) <strong>Tiêu hao bất thường</strong> — xe chạy, tiêu hao &gt;2.5× định mức (L/100km).
          Cập nhật trạng thái để theo dõi xử lý từng sự kiện.
        </Text>
      </Card>
    </div>
  )
}
