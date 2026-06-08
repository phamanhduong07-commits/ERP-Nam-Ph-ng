import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Col, DatePicker, Input, Row, Select, Space, Table, Tag, Typography, Tooltip,
} from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import client from '../../api/client'
import type { PhanXuong } from '../../api/warehouse'
import { warehouseApi } from '../../api/warehouse'

const { Text } = Typography

const fmtN = (v: number) =>
  v > 0 ? new Intl.NumberFormat('vi-VN').format(Math.round(v)) : '—'

const fmtMoney = (v: number) =>
  v > 0
    ? new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(v) + 'đ'
    : '—'

interface LenhSummaryRow {
  id: number
  so_lenh: string
  trang_thai: string
  ngay_lenh: string | null
  ten_hang: string | null
  ten_khach: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  sl_ke_hoach: number
  sl_cd1_chay: number
  sl_cd1_loi: number
  sl_in_ok: number
  sl_in_loi: number
  sl_tp_ok: number
  sl_tp_loi: number
  sl_giao: number
  sl_tra: number
  sl_con_kho: number
  doanh_thu: number
}

const TRANG_THAI_CONFIG: Record<string, { color: string; label: string }> = {
  moi:         { color: 'default', label: 'Mới' },
  dang_chay:   { color: 'processing', label: 'Đang chạy' },
  hoan_thanh:  { color: 'success', label: 'Hoàn thành' },
  huy:         { color: 'error', label: 'Huỷ' },
  mua_ngoai:   { color: 'warning', label: 'Mua ngoài' },
}

function PairCell({ ok, loi, label }: { ok: number; loi: number; label: string }) {
  const loiPct = ok + loi > 0 ? loi / (ok + loi) : 0
  const loiHigh = loiPct > 0.05 && loi > 0
  return (
    <Tooltip title={label}>
      <div style={{ lineHeight: 1.4, minWidth: 70 }}>
        <div style={{ color: '#15803d', fontWeight: ok > 0 ? 600 : 400 }}>
          {fmtN(ok)}
        </div>
        {loi > 0 && (
          <div style={{ color: loiHigh ? '#dc2626' : '#f59e0b', fontSize: 12 }}>
            -{fmtN(loi)} lỗi
          </div>
        )}
      </div>
    </Tooltip>
  )
}

export default function LenhTheoDoiPage() {
  const navigate = useNavigate()

  const [tuNgay, setTuNgay] = useState<Dayjs | null>(null)
  const [denNgay, setDenNgay] = useState<Dayjs | null>(null)
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 60_000,
  })

  const params = {
    tu_ngay: tuNgay?.format('YYYY-MM-DD'),
    den_ngay: denNgay?.format('YYYY-MM-DD'),
    phan_xuong_id: phanXuongId,
    trang_thai: trangThai,
    q: search || undefined,
  }

  const { data: rawData, isLoading, refetch } = useQuery<LenhSummaryRow[]>({
    queryKey: ['lenh-summary', params],
    queryFn: () =>
      client.get<LenhSummaryRow[]>('/production-orders/lenh-summary', { params }).then(r => r.data),
    staleTime: 0,
  })
  const rows = useMemo<LenhSummaryRow[]>(() => (Array.isArray(rawData) ? rawData : []), [rawData])

  const columns: ColumnsType<LenhSummaryRow> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 200,
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.so_lenh}</Text>
          {r.ten_hang && (
            <div style={{ color: '#374151', fontSize: 12, marginTop: 2 }}>
              {r.ten_hang}
            </div>
          )}
          {r.ten_khach && (
            <div style={{ color: '#6b7280', fontSize: 11 }}>{r.ten_khach}</div>
          )}
        </div>
      ),
    },
    {
      key: 'xuong_ngay',
      title: 'Xưởng / Ngày',
      width: 110,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.ten_phan_xuong && <div style={{ fontWeight: 500 }}>{r.ten_phan_xuong}</div>}
          {r.ngay_lenh && (
            <div style={{ color: '#6b7280' }}>
              {r.ngay_lenh.split('-').reverse().join('/')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'SL yêu cầu',
      dataIndex: 'sl_ke_hoach',
      width: 90,
      align: 'right',
      render: v => <Text strong>{fmtN(v)}</Text>,
    },
    {
      key: 'cd1',
      title: (
        <Tooltip title="Chạy phôi sóng (CD1)">
          <span>CD1 Phôi</span>
        </Tooltip>
      ),
      width: 90,
      render: (_, r) => <PairCell ok={r.sl_cd1_chay} loi={r.sl_cd1_loi} label="CD1: chạy / lỗi" />,
    },
    {
      key: 'in_cd2',
      title: (
        <Tooltip title="Số lượng sau in (CD2)">
          <span>In</span>
        </Tooltip>
      ),
      width: 90,
      render: (_, r) => <PairCell ok={r.sl_in_ok} loi={r.sl_in_loi} label="In: tốt / lỗi" />,
    },
    {
      key: 'nhap_tp',
      title: 'Nhập TP',
      width: 90,
      render: (_, r) => <PairCell ok={r.sl_tp_ok} loi={r.sl_tp_loi} label="Nhập TP: tốt / lỗi" />,
    },
    {
      key: 'giao_tra',
      title: 'Giao / Trả',
      width: 90,
      render: (_, r) => (
        <div style={{ lineHeight: 1.4 }}>
          <div style={{ color: '#15803d', fontWeight: r.sl_giao > 0 ? 600 : 400 }}>
            {fmtN(r.sl_giao)}
          </div>
          {r.sl_tra > 0 && (
            <div style={{ color: '#dc2626', fontSize: 12 }}>-{fmtN(r.sl_tra)} trả</div>
          )}
        </div>
      ),
    },
    {
      title: 'Còn kho',
      dataIndex: 'sl_con_kho',
      width: 80,
      align: 'right',
      render: v => (
        <Text style={{ color: v > 0 ? '#1d4ed8' : v < 0 ? '#dc2626' : '#9ca3af' }}>
          {fmtN(Math.abs(v))}
        </Text>
      ),
    },
    {
      title: 'Doanh thu',
      dataIndex: 'doanh_thu',
      width: 100,
      align: 'right',
      render: v => <Text style={{ color: '#15803d' }}>{fmtMoney(v)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const cfg = TRANG_THAI_CONFIG[v] ?? { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <DatePicker
            size="small"
            format="DD/MM/YYYY"
            placeholder="Từ ngày"
            value={tuNgay}
            onChange={v => setTuNgay(v)}
            allowClear
          />
        </Col>
        <Col>
          <DatePicker
            size="small"
            format="DD/MM/YYYY"
            placeholder="Đến ngày"
            value={denNgay}
            onChange={v => setDenNgay(v)}
            allowClear
          />
        </Col>
        <Col>
          <Select
            size="small"
            allowClear
            placeholder="Xưởng"
            style={{ width: 150 }}
            value={phanXuongId}
            onChange={v => setPhanXuongId(v)}
            options={phanXuongList.map(px => ({
              value: px.id,
              label: (px.ten_xuong || '').replace(/^Xưởng\s+/i, ''),
            }))}
          />
        </Col>
        <Col>
          <Select
            size="small"
            allowClear
            placeholder="Trạng thái"
            style={{ width: 130 }}
            value={trangThai}
            onChange={v => setTrangThai(v)}
            options={Object.entries(TRANG_THAI_CONFIG).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
        </Col>
        <Col>
          <Input
            size="small"
            placeholder="Tìm LSX / tên hàng"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
        </Col>
        <Col>
          <Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rows.length} lệnh
            </Text>
          </Space>
        </Col>
      </Row>

      <Table<LenhSummaryRow>
        size="small"
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1050 }}
        onRow={r => ({
          onClick: () => navigate(`/production/orders/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        rowClassName={r => {
          if (r.trang_thai === 'hoan_thanh') return 'row-done'
          if (r.trang_thai === 'huy') return 'row-cancelled'
          return ''
        }}
      />
    </div>
  )
}
