import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Col, Row, Select, Space, Statistic, Table, Tag, Typography, Tabs,
} from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import type { PhanXuong } from '../../api/warehouse'
import { warehouseApi } from '../../api/warehouse'

const { Text, Title } = Typography

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'

interface HangLoiRow {
  id: number
  so_phieu: string
  ngay_nhap: string | null
  so_lenh: string | null
  ten_hang: string | null
  so_luong_loi: number
  dvt: string
  ten_khach_hang: string | null
  ten_phan_xuong: string | null
  ten_phap_nhan: string | null
  ghi_chu: string | null
}

interface HangTraVeRow {
  id: number
  so_phieu_tra: string | null
  ngay_tra: string | null
  so_luong_tra: number
  tinh_trang_hang: string | null
  dvt: string
  ten_khach_hang: string | null
  ly_do_tra: string | null
  ghi_chu: string | null
}

interface KhoLoiData {
  hang_loi: HangLoiRow[]
  hang_tra_ve: HangTraVeRow[]
}

const TINH_TRANG_LABELS: Record<string, string> = {
  hong: 'Hỏng',
  loi: 'Lỗi',
  tot: 'Tốt',
}
const TINH_TRANG_COLORS: Record<string, string> = {
  hong: 'red',
  loi: 'orange',
  tot: 'green',
}

export default function KhoLoiPage() {
  const [filterPhapNhanId, setFilterPhapNhanId] = useState<number | undefined>()
  const [filterPhanXuongId, setFilterPhanXuongId] = useState<number | undefined>()

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: phapNhanList = [] } = useQuery<{ id: number; ten_viet_tat: string }[]>({
    queryKey: ['phap-nhan-list'],
    queryFn: () => client.get<{ id: number; ten_viet_tat: string }[]>('/master/phap-nhan').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const filterParams = {
    phap_nhan_id: filterPhapNhanId,
    phan_xuong_id: filterPhanXuongId,
  }

  const { data, isLoading, refetch } = useQuery<KhoLoiData>({
    queryKey: ['kho-loi-tra-ve', filterParams],
    queryFn: () => client.get<KhoLoiData>('/warehouse/kho-loi-tra-ve', { params: filterParams }).then(r => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const hangLoi: HangLoiRow[] = data?.hang_loi ?? []
  const hangTraVe: HangTraVeRow[] = data?.hang_tra_ve ?? []

  const colsLoi: ColumnsType<HangLoiRow> = [
    {
      title: 'Phiếu nhập TP',
      dataIndex: 'so_phieu',
      width: 150,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_nhap',
      width: 100,
      render: (v: string | null) => v ? v.split('T')[0].split('-').reverse().join('/') : '—',
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string | null) => v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      width: 130,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 120,
      render: (v: string | null) => v ? <Tag>{v.replace(/^Xưởng\s+/i, '')}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 110,
      render: (v: string | null) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'SL lỗi',
      dataIndex: 'so_luong_loi',
      width: 90,
      align: 'right' as const,
      render: (v: number, r: HangLoiRow) => (
        <Text strong style={{ color: '#cf1322' }}>{fmtN(v)} {r.dvt}</Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
  ]

  const colsTra: ColumnsType<HangTraVeRow> = [
    {
      title: 'Số phiếu trả',
      dataIndex: 'so_phieu_tra',
      width: 150,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày trả',
      dataIndex: 'ngay_tra',
      width: 100,
      render: (v: string | null) => v ? v.split('T')[0].split('-').reverse().join('/') : '—',
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
      render: (v: string | null) => v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tình trạng',
      dataIndex: 'tinh_trang_hang',
      width: 100,
      render: (v: string | null) => v ? (
        <Tag color={TINH_TRANG_COLORS[v] || 'default'}>{TINH_TRANG_LABELS[v] || v}</Tag>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'SL trả',
      dataIndex: 'so_luong_tra',
      width: 90,
      align: 'right' as const,
      render: (v: number, r: HangTraVeRow) => (
        <Text strong style={{ color: '#fa8c16' }}>{fmtN(v)} {r.dvt}</Text>
      ),
    },
    {
      title: 'Lý do',
      dataIndex: 'ly_do_tra',
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text>,
    },
  ]

  const totalLoi = hangLoi.reduce((s, r) => s + r.so_luong_loi, 0)
  const totalTra = hangTraVe.reduce((s, r) => s + r.so_luong_tra, 0)

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <WarningOutlined style={{ fontSize: 20, color: '#cf1322' }} />
            <Title level={4} style={{ margin: 0 }}>Kho ảo — Hàng lỗi & Trả về</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              size="small"
              style={{ width: 140 }}
              placeholder="Pháp nhân"
              allowClear
              value={filterPhapNhanId}
              onChange={v => setFilterPhapNhanId(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat }))}
            />
            <Select
              size="small"
              style={{ width: 150 }}
              placeholder="Xưởng"
              allowClear
              value={filterPhanXuongId}
              onChange={v => setFilterPhanXuongId(v)}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong.replace(/^Xưởng\s+/i, '') }))}
            />
            <span
              style={{ fontSize: 12, color: '#1677ff', cursor: 'pointer' }}
              onClick={() => refetch()}
            >
              Làm mới
            </span>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Statistic
            title="Hàng lỗi (phiếu)"
            value={hangLoi.length}
            valueStyle={{ fontSize: 18, color: '#cf1322' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Tổng SL lỗi"
            value={totalLoi}
            formatter={v => fmtN(Number(v))}
            valueStyle={{ fontSize: 18, color: '#cf1322' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Hàng trả về (dòng)"
            value={hangTraVe.length}
            valueStyle={{ fontSize: 18, color: '#fa8c16' }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Statistic
            title="Tổng SL trả xấu"
            value={totalTra}
            formatter={v => fmtN(Number(v))}
            valueStyle={{ fontSize: 18, color: '#fa8c16' }}
          />
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'loi',
            label: `Hàng lỗi (${hangLoi.length})`,
            children: (
              <Table<HangLoiRow>
                rowKey="id"
                size="small"
                loading={isLoading}
                dataSource={hangLoi}
                columns={colsLoi}
                pagination={{ pageSize: 50, showSizeChanger: false }}
                scroll={{ x: 900 }}
              />
            ),
          },
          {
            key: 'tra',
            label: `Hàng trả về xấu (${hangTraVe.length})`,
            children: (
              <Table<HangTraVeRow>
                rowKey="id"
                size="small"
                loading={isLoading}
                dataSource={hangTraVe}
                columns={colsTra}
                pagination={{ pageSize: 50, showSizeChanger: false }}
                scroll={{ x: 800 }}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
