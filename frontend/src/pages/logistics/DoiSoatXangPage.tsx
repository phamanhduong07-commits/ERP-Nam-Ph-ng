import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd'
import { AlertOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import * as XLSX from 'xlsx'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface FuelRow {
  xe_id: number
  bien_so: string
  loai_xe: string | null
  dinh_muc_dau: number
  km_gps: number
  dau_ly_thuyet: number | null
  dau_thuc_te: number
  chenh_lech_lit: number | null
  chenh_lech_pct: number | null
  canh_bao: 'ok' | 'warning' | 'danger' | 'no_data'
}

const fmt1 = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const ALERT_CONFIG = {
  ok: { color: 'green', text: 'Bình thường' },
  warning: { color: 'orange', text: 'Chú ý (5-10%)' },
  danger: { color: 'red', text: 'Bất thường (>10%)' },
  no_data: { color: 'default', text: 'Chưa đủ dữ liệu' },
}

const ROW_BG: Record<string, string> = {
  danger: '#fff1f0',
  warning: '#fffbe6',
  ok: '',
  no_data: '',
}

export default function DoiSoatXangPage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.startOf('month'), today])

  const fromDate = range[0].format('YYYY-MM-DD')
  const toDate = range[1].format('YYYY-MM-DD')

  const { data = [], isFetching, refetch } = useQuery<FuelRow[]>({
    queryKey: ['fuel-comparison', fromDate, toDate],
    queryFn: async () => {
      const res = await client.get('/gps/fuel-comparison', { params: { from_date: fromDate, to_date: toDate } })
      return res.data
    },
  })

  const exportToExcel = () => {
    const rows = data.map(r => ({
      'Biển số': r.bien_so,
      'Loại xe': r.loai_xe ?? '',
      'Định mức (L/100km)': r.dinh_muc_dau,
      'Km GPS': r.km_gps,
      'Dầu lý thuyết (L)': r.dau_ly_thuyet ?? '',
      'Dầu thực tế (L)': r.dau_thuc_te,
      'Chênh lệch (L)': r.chenh_lech_lit ?? '',
      'Chênh lệch (%)': r.chenh_lech_pct ?? '',
      'Trạng thái': r.canh_bao,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Đối soát xăng')
    XLSX.writeFile(wb, `DoiSoatXang_${fromDate}_${toDate}.xlsx`)
  }

  const alertCount = data.filter(r => r.canh_bao === 'danger').length
  const warnCount = data.filter(r => r.canh_bao === 'warning').length
  const totalLyThuyet = data.reduce((s, r) => s + (r.dau_ly_thuyet ?? 0), 0)
  const totalThucTe = data.reduce((s, r) => s + r.dau_thuc_te, 0)

  const columns = [
    {
      title: 'Biển số',
      dataIndex: 'bien_so',
      key: 'bien_so',
      width: 120,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Loại xe',
      dataIndex: 'loai_xe',
      key: 'loai_xe',
      width: 120,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Định mức (L/100km)',
      dataIndex: 'dinh_muc_dau',
      key: 'dinh_muc_dau',
      width: 150,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text>{fmt1(v)} L</Text> : <Text type="secondary">Chưa cài</Text>,
    },
    {
      title: 'Km GPS',
      dataIndex: 'km_gps',
      key: 'km_gps',
      width: 100,
      align: 'right' as const,
      sorter: (a: FuelRow, b: FuelRow) => a.km_gps - b.km_gps,
      render: (v: number) => <Text style={{ color: '#1677ff' }}>{fmt1(v)} km</Text>,
    },
    {
      title: 'Dầu lý thuyết',
      dataIndex: 'dau_ly_thuyet',
      key: 'dau_ly_thuyet',
      width: 120,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null
          ? <Text type="secondary">{fmt1(v)} L</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Dầu thực tế',
      dataIndex: 'dau_thuc_te',
      key: 'dau_thuc_te',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text strong>{fmt1(v)} L</Text>,
    },
    {
      title: 'Chênh lệch',
      key: 'chenh_lech',
      width: 150,
      align: 'right' as const,
      sorter: (a: FuelRow, b: FuelRow) => Math.abs(a.chenh_lech_pct ?? 0) - Math.abs(b.chenh_lech_pct ?? 0),
      render: (_: unknown, r: FuelRow) => {
        if (r.chenh_lech_lit == null || r.chenh_lech_pct == null) return <Text type="secondary">—</Text>
        const color = r.chenh_lech_pct > 0 ? '#ff4d4f' : '#52c41a'
        const sign = r.chenh_lech_pct > 0 ? '+' : ''
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ color }}>{sign}{fmt1(r.chenh_lech_lit)} L</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{sign}{fmt1(r.chenh_lech_pct)}%</Text>
          </Space>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'canh_bao',
      key: 'canh_bao',
      width: 160,
      defaultSortOrder: 'descend' as const,
      sorter: (a: FuelRow, b: FuelRow) => {
        const ORDER: Record<string, number> = { no_data: 0, ok: 1, warning: 2, danger: 3 }
        return (ORDER[a.canh_bao] ?? 0) - (ORDER[b.canh_bao] ?? 0)
      },
      render: (v: FuelRow['canh_bao'], r: FuelRow) => {
        const cfg = ALERT_CONFIG[v]
        return (
          <Tooltip title={r.dinh_muc_dau === 0 ? 'Chưa cài định mức cho xe này' : undefined}>
            <Tag color={cfg.color}>{cfg.text}</Tag>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <AlertOutlined style={{ marginRight: 8, color: '#faad14' }} />
          Đối chiếu xăng dầu — GPS vs Thực tế
        </Title>
        <Space>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Tải lại
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportToExcel} disabled={data.length === 0}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Xe bất thường (>10%)"
              value={alertCount}
              valueStyle={{ color: alertCount > 0 ? '#ff4d4f' : '#52c41a' }}
              suffix="xe"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Xe cần chú ý (5–10%)"
              value={warnCount}
              valueStyle={{ color: warnCount > 0 ? '#faad14' : '#52c41a' }}
              suffix="xe"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Dầu lý thuyết"
              value={totalLyThuyet}
              formatter={v => fmt1(Number(v))}
              suffix="L"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Dầu thực tế đổ"
              value={totalThucTe}
              formatter={v => fmt1(Number(v))}
              suffix="L"
              valueStyle={{ color: totalThucTe > totalLyThuyet ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`Danh sách xe (${data.length})`}>
        <Table<FuelRow>
          dataSource={data}
          columns={columns}
          rowKey="xe_id"
          loading={isFetching}
          size="small"
          pagination={false}
          rowClassName={r => r.canh_bao === 'danger' ? 'ant-table-row-danger' : ''}
          onRow={r => ({ style: { background: ROW_BG[r.canh_bao] } })}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={3}>Tổng cộng</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right" />
                <Table.Summary.Cell index={4} align="right">
                  <Text type="secondary">{fmt1(totalLyThuyet)} L</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong>{fmt1(totalThucTe)} L</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  {totalLyThuyet > 0 && (
                    <Text style={{ color: totalThucTe > totalLyThuyet ? '#ff4d4f' : '#52c41a' }}>
                      {totalThucTe > totalLyThuyet ? '+' : ''}{fmt1(totalThucTe - totalLyThuyet)} L
                    </Text>
                  )}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 Dầu lý thuyết = Km GPS × Định mức (L/100km) / 100. Cần cài định mức trong danh mục Xe để tính được.
          Chênh lệch dương = dùng nhiều hơn lý thuyết. Ngưỡng cảnh báo: &gt;5% chú ý, &gt;10% bất thường.
        </Text>
      </Card>
    </div>
  )
}
