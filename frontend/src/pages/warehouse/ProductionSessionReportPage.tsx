import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, Empty, Row, Select, Spin,
  Statistic, Table, Tag, Typography,
} from 'antd'
import { ReloadOutlined, BarChartOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { warehouseApi, type SessionSummaryReportItem } from '../../api/warehouse'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLOR: Record<string, string> = {
  dang_chay: 'processing',
  cho_phan_bo: 'warning',
  da_chot: 'success',
}
const STATUS_LABEL: Record<string, string> = {
  dang_chay: 'Đang chạy',
  cho_phan_bo: 'Chờ phân bổ',
  da_chot: 'Đã chốt',
}

function fmt(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}

function PctCell({ v, warnAt, dangerAt }: { v: number | null; warnAt?: number; dangerAt?: number }) {
  if (v == null) return <Text type="secondary">—</Text>
  const color = dangerAt != null && v > dangerAt ? '#cf1322'
    : warnAt != null && v > warnAt ? '#d48806'
    : '#52c41a'
  return <Text style={{ color }}>{v}%</Text>
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProductionSessionReportPage() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>(undefined)

  const { data: phanXuongs } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const params = {
    tu_ngay: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
    den_ngay: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
    phan_xuong_id: phanXuongId,
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['production-sessions-summary-report', params],
    queryFn: () => warehouseApi.getProductionSessionsSummaryReport(params).then(r => r.data),
  })

  const items: SessionSummaryReportItem[] = data?.items ?? []

  // Tổng hợp
  const totKH = items.reduce((s, r) => s + r.ke_hoach, 0)
  const totTT = items.reduce((s, r) => s + r.thuc_te, 0)
  const totLoi = items.reduce((s, r) => s + r.so_luong_loi, 0)
  const totDung = items.reduce((s, r) => s + r.tong_phut_dung, 0)
  const avgHT = totKH > 0 ? Math.round(totTT / totKH * 100 * 10) / 10 : null
  const avgLoi = totTT > 0 ? Math.round(totLoi / totTT * 100 * 100) / 100 : null
  const totCP = items.reduce((s, r) => s + (r.tong_chi_phi ?? 0), 0)

  const columns = [
    {
      title: 'Phiên sản xuất',
      dataIndex: 'ten_phien',
      ellipsis: true,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_tao',
      width: 110,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'phan_xuong_ten',
      width: 130,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'KH (cái)',
      dataIndex: 'ke_hoach',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'TT (cái)',
      dataIndex: 'thuc_te',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '% HT',
      dataIndex: 'ty_le_hoan_thanh',
      width: 80,
      align: 'right' as const,
      sorter: (a: SessionSummaryReportItem, b: SessionSummaryReportItem) =>
        (a.ty_le_hoan_thanh ?? 0) - (b.ty_le_hoan_thanh ?? 0),
      render: (v: number | null) => <PctCell v={v} warnAt={85} dangerAt={200} />,
    },
    {
      title: '% Lỗi',
      dataIndex: 'ty_le_loi',
      width: 80,
      align: 'right' as const,
      sorter: (a: SessionSummaryReportItem, b: SessionSummaryReportItem) =>
        (a.ty_le_loi ?? 0) - (b.ty_le_loi ?? 0),
      render: (v: number | null) => <PctCell v={v} warnAt={2} dangerAt={5} />,
    },
    {
      title: 'Hao hụt',
      dataIndex: 'ty_le_hao_hut',
      width: 85,
      align: 'right' as const,
      sorter: (a: SessionSummaryReportItem, b: SessionSummaryReportItem) =>
        (a.ty_le_hao_hut ?? 0) - (b.ty_le_hao_hut ?? 0),
      render: (v: number | null) => <PctCell v={v} warnAt={4} dangerAt={8} />,
    },
    {
      title: 'Dừng máy (ph)',
      dataIndex: 'tong_phut_dung',
      width: 110,
      align: 'right' as const,
      sorter: (a: SessionSummaryReportItem, b: SessionSummaryReportItem) =>
        a.tong_phut_dung - b.tong_phut_dung,
      render: (v: number) => v > 0
        ? <Text type={v > 60 ? 'danger' : undefined}>{v}</Text>
        : <Text type="secondary">0</Text>,
    },
    {
      title: 'Tổng chi phí',
      dataIndex: 'tong_chi_phi',
      width: 130,
      align: 'right' as const,
      sorter: (a: SessionSummaryReportItem, b: SessionSummaryReportItem) =>
        (a.tong_chi_phi ?? 0) - (b.tong_chi_phi ?? 0),
      render: (v: number | null) => v != null
        ? <Text>{fmt(v)} ₫</Text>
        : <Text type="secondary">—</Text>,
    },
  ]

  return (
    <div style={{ padding: '16px 20px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <BarChartOutlined /> Báo cáo tổng hợp phiên sản xuất
      </Title>

      {/* ── Bộ lọc ─────────────────────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col>
            <RangePicker
              value={dateRange}
              onChange={v => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Tất cả phân xưởng"
              style={{ width: 180 }}
              allowClear
              value={phanXuongId}
              onChange={v => setPhanXuongId(v)}
              options={(phanXuongs ?? []).map((px: { id: number; ten_xuong: string }) => ({
                value: px.id,
                label: px.ten_xuong,
              }))}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>
          </Col>
          {data && (
            <Col>
              <Text type="secondary">{data.total} phiên</Text>
            </Col>
          )}
        </Row>
      </Card>

      {/* ── KPI tổng hợp ───────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <Statistic title="TB % hoàn thành" value={avgHT ?? 0} suffix="%" precision={1} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
              <Statistic title="TB % lỗi" value={avgLoi ?? 0} suffix="%" precision={2} valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="Tổng SL kế hoạch" value={totKH} formatter={v => fmt(Number(v))} suffix="cái" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="Tổng SL thực tế" value={totTT} formatter={v => fmt(Number(v))} suffix="cái" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}>
              <Statistic title="Tổng phút dừng máy" value={totDung} valueStyle={{ color: totDung > 120 ? '#cf1322' : '#d48806' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" style={{ background: '#fff0f6', border: '1px solid #ffadd2' }}>
              <Statistic title="Tổng chi phí (đã chốt)" value={totCP} formatter={v => fmt(Number(v))} suffix="₫" valueStyle={{ color: '#c41d7f' }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Bảng chi tiết ──────────────────────────────────────────────────── */}
      <Card size="small">
        {isLoading
          ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          : items.length === 0
            ? <Empty description="Không có dữ liệu. Chọn khoảng ngày và nhấn Tải lại." />
            : (
              <Table
                size="small"
                rowKey="id"
                dataSource={items}
                columns={columns}
                pagination={{ pageSize: 30, showTotal: t => `${t} phiên` }}
                scroll={{ x: 1100 }}
              />
            )
        }
      </Card>
    </div>
  )
}
