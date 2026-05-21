import { useState } from 'react'
import {
  Button, Card, Col, DatePicker, InputNumber, Row, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import { CheckOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs, { Dayjs } from 'dayjs'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

interface TripCostRow {
  id: number
  so_phieu: string
  ngay_xuat: string
  khach_hang: string
  tai_xe: string
  xe: string
  trang_thai: string
  doanh_thu: number
  tien_chuyen: number
  tien_luong: number
  xang_dau: number
  cau_duong: number
  sua_chua: number
  tien_com: number
  phi_khac: number
  tong_chi_phi: number
}

const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })

const STATUS_COLOR: Record<string, string> = {
  da_giao: 'green',
  da_xuat: 'blue',
  nhap: 'default',
  huy: 'red',
}
const STATUS_TEXT: Record<string, string> = {
  da_giao: 'Đã giao',
  da_xuat: 'Đã xuất',
  nhap: 'Nháp',
  huy: 'Huỷ',
}

export default function ChiPhiChuyenPage() {
  const today = dayjs()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([today.startOf('month'), today])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Record<string, number>>({})
  const qc = useQueryClient()

  const { data = [], isFetching, refetch } = useQuery<TripCostRow[]>({
    queryKey: ['trip-costs', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')],
    queryFn: async () => {
      const res = await client.get('/hr/trip-costs', {
        params: { from_date: range[0].format('YYYY-MM-DD'), to_date: range[1].format('YYYY-MM-DD') },
      })
      return res.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: Record<string, number> }) => {
      await client.patch(`/hr/trip-costs/${id}`, values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-costs'] })
      setEditingId(null)
      setEditValues({})
    },
  })

  const startEdit = (record: TripCostRow) => {
    setEditingId(record.id)
    setEditValues({
      cau_duong: record.cau_duong,
      sua_chua: record.sua_chua,
      tien_com: record.tien_com,
      phi_khac: record.phi_khac,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditValues({}) }

  const totalRow = data.reduce(
    (acc, r) => ({
      doanh_thu: acc.doanh_thu + r.doanh_thu,
      tong_chi_phi: acc.tong_chi_phi + r.tong_chi_phi,
      tien_chuyen: acc.tien_chuyen + r.tien_chuyen,
      tien_luong: acc.tien_luong + r.tien_luong,
      xang_dau: acc.xang_dau + r.xang_dau,
      cau_duong: acc.cau_duong + r.cau_duong,
      sua_chua: acc.sua_chua + r.sua_chua,
      tien_com: acc.tien_com + r.tien_com,
      phi_khac: acc.phi_khac + r.phi_khac,
    }),
    { doanh_thu: 0, tong_chi_phi: 0, tien_chuyen: 0, tien_luong: 0, xang_dau: 0, cau_duong: 0, sua_chua: 0, tien_com: 0, phi_khac: 0 },
  )

  const editableCell = (field: string, value: number, record: TripCostRow) => {
    if (editingId === record.id) {
      return (
        <InputNumber
          size="small"
          value={editValues[field] ?? value}
          min={0}
          formatter={v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => Number(v?.replace(/,/g, '') ?? 0)}
          onChange={v => setEditValues(prev => ({ ...prev, [field]: v ?? 0 }))}
          style={{ width: 100 }}
        />
      )
    }
    return <Text>{fmt(value)}</Text>
  }

  const columns = [
    {
      title: 'Phiếu / Ngày',
      key: 'phieu',
      width: 130,
      render: (_: unknown, r: TripCostRow) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{r.so_phieu}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ngay_xuat}</Text>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'khach_hang',
      key: 'khach_hang',
      width: 130,
      ellipsis: true,
    },
    {
      title: 'Tài xế / Xe',
      key: 'tai_xe',
      width: 120,
      render: (_: unknown, r: TripCostRow) => (
        <Space direction="vertical" size={0}>
          <Text>{r.tai_xe || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.xe || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{STATUS_TEXT[s] ?? s}</Tag>,
    },
    {
      title: 'Doanh thu',
      dataIndex: 'doanh_thu',
      key: 'doanh_thu',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmt(v)}</Text>,
    },
    {
      title: 'Tiền chuyến',
      dataIndex: 'tien_chuyen',
      key: 'tien_chuyen',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text>{fmt(v)}</Text>,
    },
    {
      title: 'Tiền lương',
      dataIndex: 'tien_luong',
      key: 'tien_luong',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text>{fmt(v)}</Text>,
    },
    {
      title: 'Xăng dầu',
      dataIndex: 'xang_dau',
      key: 'xang_dau',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text>{fmt(v)}</Text>,
    },
    {
      title: 'Cầu đường',
      key: 'cau_duong',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, r: TripCostRow) => editableCell('cau_duong', r.cau_duong, r),
    },
    {
      title: 'Sửa chữa',
      key: 'sua_chua',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, r: TripCostRow) => editableCell('sua_chua', r.sua_chua, r),
    },
    {
      title: 'Tiền cơm',
      key: 'tien_com',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, r: TripCostRow) => editableCell('tien_com', r.tien_com, r),
    },
    {
      title: 'Phí khác',
      key: 'phi_khac',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, r: TripCostRow) => editableCell('phi_khac', r.phi_khac, r),
    },
    {
      title: 'Tổng chi phí',
      dataIndex: 'tong_chi_phi',
      key: 'tong_chi_phi',
      width: 115,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#ff4d4f' }}>{fmt(v)}</Text>,
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_: unknown, r: TripCostRow) => {
        if (editingId === r.id) {
          return (
            <Space>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate({ id: r.id, values: editValues })}
              />
              <Button size="small" onClick={cancelEdit}>Huỷ</Button>
            </Space>
          )
        }
        return (
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(r)}>
            Nhập
          </Button>
        )
      },
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Chi phí đội xe — Từng chuyến</Title>
        <Space>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]) }}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Tải lại
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Số chuyến" value={data.length} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="Tổng Doanh thu" value={totalRow.doanh_thu} formatter={v => fmt(Number(v))} valueStyle={{ color: '#52c41a' }} suffix="đ" />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic title="Tổng Chi phí" value={totalRow.tong_chi_phi} formatter={v => fmt(Number(v))} valueStyle={{ color: '#ff4d4f' }} suffix="đ" />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="Lợi nhuận"
              value={totalRow.doanh_thu - totalRow.tong_chi_phi}
              formatter={v => fmt(Number(v))}
              valueStyle={{ color: totalRow.doanh_thu - totalRow.tong_chi_phi >= 0 ? '#52c41a' : '#ff4d4f' }}
              suffix="đ"
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small">
            <Statistic
              title="Xăng dầu"
              value={totalRow.xang_dau}
              formatter={v => fmt(Number(v))}
              valueStyle={{ color: '#faad14' }}
              suffix="đ"
            />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Text>
            Danh sách chuyến xe ({data.length})
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              — Nhấn "Nhập" để điền chi phí cầu đường / sửa chữa / cơm / khác
            </Text>
          </Text>
        }
      >
        <Table<TripCostRow>
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={isFetching}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          scroll={{ x: 1400 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={4}>Tổng cộng</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#52c41a' }}>{fmt(totalRow.doanh_thu)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{fmt(totalRow.tien_chuyen)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">{fmt(totalRow.tien_luong)}</Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">{fmt(totalRow.xang_dau)}</Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">{fmt(totalRow.cau_duong)}</Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">{fmt(totalRow.sua_chua)}</Table.Summary.Cell>
                <Table.Summary.Cell index={10} align="right">{fmt(totalRow.tien_com)}</Table.Summary.Cell>
                <Table.Summary.Cell index={11} align="right">{fmt(totalRow.phi_khac)}</Table.Summary.Cell>
                <Table.Summary.Cell index={12} align="right">
                  <Text strong style={{ color: '#ff4d4f' }}>{fmt(totalRow.tong_chi_phi)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={13} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  )
}
