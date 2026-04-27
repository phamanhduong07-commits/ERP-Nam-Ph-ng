import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography, DatePicker, Row, Col,
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { procurementApi, RECEIPT_TRANG_THAI } from '../../api/procurement'
import type { ReceiptListItem } from '../../api/procurement'

const { Title } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export default function MaterialReceiptList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['material-receipts', search, trangThai, dateRange, page],
    queryFn: () => procurementApi.listReceipts({
      search,
      trang_thai: trangThai,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page,
      page_size: 20,
    }).then(r => r.data),
  })

  const columns: ColumnsType<ReceiptListItem> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 150,
      render: (v, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onSelect ? onSelect(row.id) : navigate(`/procurement/material-receipts/${row.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày nhập',
      dataIndex: 'ngay_nhap',
      width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_nha_cung_cap',
      ellipsis: true,
    },
    {
      title: 'Kho',
      dataIndex: 'ten_kho',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Đơn mua',
      dataIndex: 'so_don_mua',
      width: 140,
      render: v => v || '—',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_tien',
      width: 130,
      align: 'right',
      render: v => Number(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: v => {
        const s = RECEIPT_TRANG_THAI[v]
        return s ? <Tag color={s.color}>{s.label}</Tag> : <Tag>{v}</Tag>
      },
    },
  ]

  return (
    <Card
      size="small"
      title={<Title level={5} style={{ margin: 0 }}>Phiếu nhập nguyên liệu</Title>}
      extra={
        <Button
          icon={<PlusOutlined />}
          type="primary"
          size="small"
          onClick={() => navigate('/procurement/material-receipts/new')}
        >
          Tạo phiếu nhập
        </Button>
      }
    >
      <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
        <Col span={8}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm số phiếu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            allowClear
            size="small"
          />
        </Col>
        <Col span={6}>
          <Select
            placeholder="Trạng thái"
            allowClear
            size="small"
            style={{ width: '100%' }}
            value={trangThai}
            onChange={v => { setTrangThai(v); setPage(1) }}
            options={Object.entries(RECEIPT_TRANG_THAI).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Col>
        <Col span={10}>
          <RangePicker
            size="small"
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            onChange={vals => {
              if (vals) {
                setDateRange([vals[0]!.format('YYYY-MM-DD'), vals[1]!.format('YYYY-MM-DD')])
              } else {
                setDateRange(null)
              }
              setPage(1)
            }}
          />
        </Col>
      </Row>

      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={data?.items}
        loading={isLoading}
        rowSelection={onSelect ? {
          type: 'radio',
          selectedRowKeys: selectedId ? [selectedId] : [],
          onChange: keys => keys[0] && onSelect(Number(keys[0])),
        } : undefined}
        onRow={onSelect ? (row) => ({ onClick: () => onSelect(row.id), style: { cursor: 'pointer' } }) : undefined}
        rowClassName={row => row.id === selectedId ? 'ant-table-row-selected' : ''}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: t => `${t} phiếu`,
        }}
        scroll={{ x: 700 }}
      />
    </Card>
  )
}
