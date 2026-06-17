import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Table, Tag, Typography,
} from 'antd'
import { PlusOutlined, SwapOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import {
  internalTransferApi, InternalTransfer,
  TRANG_THAI_INTERNAL_TRANSFER, HINH_THUC_TT,
} from '../../api/accounting'
import { usePhapNhan } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography
const { RangePicker } = DatePicker

export default function InternalTransferListPage() {
  const navigate = useNavigate()
  const { phapNhanList } = usePhapNhan()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['internal-transfers', tuNgay, denNgay, filterTrangThai, filterPhapNhan, page],
    queryFn: () =>
      internalTransferApi.list({
        tu_ngay: tuNgay, den_ngay: denNgay,
        trang_thai: filterTrangThai,
        phap_nhan_id: filterPhapNhan,
        page, page_size: 20,
      }),
  })

  const transfers: InternalTransfer[] = data?.items ?? []
  const total: number = data?.total ?? transfers.length
  const tongSoTien = transfers.reduce((s, r) => s + (r.so_tien ?? 0), 0)

  const columns: ColumnsType<InternalTransfer> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v, r) => <a onClick={() => navigate(`/accounting/internal-transfers/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Ngày phiếu',
      dataIndex: 'ngay_phieu',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Từ pháp nhân',
      dataIndex: 'tu_phap_nhan_ten',
      ellipsis: true,
      render: (v, r) => v ?? (r.tu_tai_khoan ? `TK ${r.tu_tai_khoan}` : '—'),
    },
    {
      title: 'Đến pháp nhân',
      dataIndex: 'den_phap_nhan_ten',
      ellipsis: true,
      render: (v, r) => v ?? (r.den_tai_khoan ? `TK ${r.den_tai_khoan}` : '—'),
    },
    {
      title: 'Hình thức',
      dataIndex: 'hinh_thuc_tt',
      width: 120,
      render: v => HINH_THUC_TT[v] ?? v,
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      align: 'right',
      width: 150,
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: v => {
        const s = TRANG_THAI_INTERNAL_TRANSFER[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('accounting-internal-transfer', columns, { nonHideable: ['so_phieu'] })

  return (
    <PageLayout
      title="Chuyển tiền nội bộ"
      actions={
        <Space>
          {settingsButton}
          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={() => navigate('/accounting/internal-transfers/new')}
          >
            Tạo phiếu chuyển tiền
          </Button>
        </Space>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
                setPage(1)
              }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 160 }} allowClear placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_INTERNAL_TRANSFER).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 200 }} allowClear placeholder="Pháp nhân"
              onChange={v => { setFilterPhapNhan(v); setPage(1) }}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
        </Row>
      </Card>

      <Row style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng chuyển: </Text>
          <Text strong style={{ color: '#1677ff' }}>{fmtVND(tongSoTien)}</Text>
        </Col>
      </Row>

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        columns={displayColumns}
        dataSource={transfers}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: t => `${t} phiếu`,
          onChange: p => setPage(p),
        }}
      />
    </PageLayout>
  )
}
