import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Popconfirm, Row,
  Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd'
import { DeleteOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { cd2Api, MayScan, ScanLog } from '../../api/cd2'
import CD2WorkshopSelector from '../../components/CD2WorkshopSelector'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function ScanHistoryPage() {
  const qc = useQueryClient()
  const [machineId, setMachineId] = useState<number | null>(null)
  const [soLsx, setSoLsx] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const { phanXuongId, setPhanXuongId, phanXuongList } = useCD2Workshop()

  // Tính days từ range picker
  const days = dateRange
    ? Math.max(1, dateRange[1].diff(dateRange[0], 'day') + 1)
    : 30

  const { data: mayScanList = [] } = useQuery({
    queryKey: ['may-scan', phanXuongId],
    queryFn: () => cd2Api.listMayScan(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
  })

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['scan-history-all', machineId, days, soLsx, phanXuongId],
    queryFn: () =>
      cd2Api.getScanHistory({
        may_scan_id: machineId ?? undefined,
        days,
        so_lsx: soLsx.trim() || undefined,
        phan_xuong_id: phanXuongId,
      }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cd2Api.deleteScanLog(id),
    onSuccess: () => {
      message.success('Đã xoá')
      qc.invalidateQueries({ queryKey: ['scan-history-all'] })
    },
  })

  // Lọc theo ngày nếu có range picker
  const filtered = dateRange
    ? logs.filter((l: ScanLog) => {
        const d = dayjs(l.created_at)
        return d.isAfter(dateRange[0].startOf('day').subtract(1, 'ms'))
          && d.isBefore(dateRange[1].endOf('day').add(1, 'ms'))
      })
    : logs

  const totalQty = filtered.reduce((s: number, l: ScanLog) => s + l.so_luong_tp, 0)
  const totalDt = filtered.reduce((s: number, l: ScanLog) => s + (l.dien_tich ?? 0), 0)
  const totalLuong = filtered.reduce((s: number, l: ScanLog) => s + (l.tien_luong ?? 0), 0)

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      width: 120,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM/YY'),
      sorter: (a: ScanLog, b: ScanLog) =>
        dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Máy',
      dataIndex: 'ten_may',
      width: 110,
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    { title: 'Số LSX', dataIndex: 'so_lsx', width: 110 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    {
      title: 'Người SX',
      dataIndex: 'nguoi_sx',
      width: 100,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'SL TP',
      dataIndex: 'so_luong_tp',
      width: 80,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'DT (m²)',
      dataIndex: 'dien_tich',
      width: 90,
      align: 'right' as const,
      render: (v: number | null) => v != null ? v.toFixed(2) : '—',
    },
    {
      title: 'Đ.giá',
      dataIndex: 'don_gia',
      width: 85,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—',
    },
    {
      title: 'Tiền lương',
      dataIndex: 'tien_luong',
      width: 110,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null
          ? <strong style={{ color: '#52c41a' }}>{Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</strong>
          : '—',
    },
    {
      title: '',
      width: 44,
      render: (_: unknown, row: ScanLog) => (
        <Popconfirm title="Xoá bản ghi này?" onConfirm={() => deleteMutation.mutate(row.id)} okText="Xoá" cancelText="Không">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <HistoryOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Lịch sử Scan Sản Lượng</Title>
            <CD2WorkshopSelector value={phanXuongId} onChange={id => { setPhanXuongId(id); setMachineId(null) }} phanXuongList={phanXuongList} />
          </Space>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 160 }}
            placeholder="Tất cả máy scan"
            allowClear
            value={machineId}
            onChange={v => setMachineId(v ?? null)}
            options={mayScanList.map((m: MayScan) => ({ label: m.ten_may, value: m.id }))}
          />
          <Input.Search
            style={{ width: 200 }}
            placeholder="Tìm số LSX..."
            allowClear
            value={soLsx}
            onChange={e => setSoLsx(e.target.value)}
            onSearch={v => setSoLsx(v)}
          />
          <RangePicker
            value={dateRange}
            onChange={v => setDateRange(v as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
            allowClear
          />
        </Space>
      </Card>

      {/* Tổng kết */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Tổng SL TP"
              value={totalQty}
              formatter={v => Number(v).toLocaleString('vi-VN')}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Tổng diện tích" value={totalDt} suffix="m²" precision={2} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Tổng tiền lương"
              value={totalLuong}
              valueStyle={{ color: '#52c41a' }}
              formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          loading={isLoading}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: total => `${total} bản ghi` }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  )
}
