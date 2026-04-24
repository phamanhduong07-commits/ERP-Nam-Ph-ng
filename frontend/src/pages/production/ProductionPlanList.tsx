import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Input, Select, Space, Table, Tag, Typography, DatePicker,
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  productionPlansApi, PlanListItem, PLAN_TRANG_THAI,
} from '../../api/productionPlans'

const { Text } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId: number | null
  onSelect: (id: number) => void
}

export default function ProductionPlanList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['production-plans', search, trangThai, dateRange, page],
    queryFn: () =>
      productionPlansApi.list({
        search,
        trang_thai: trangThai,
        tu_ngay: dateRange?.[0],
        den_ngay: dateRange?.[1],
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const cols: ColumnsType<PlanListItem> = [
    {
      title: 'Số KH',
      dataIndex: 'so_ke_hoach',
      width: 140,
      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_ke_hoach',
      width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => {
        const s = PLAN_TRANG_THAI[v] ?? { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Dòng / SL',
      width: 90,
      render: (_: unknown, r: PlanListItem) => (
        <Text style={{ fontSize: 12 }}>
          {r.so_dong} dòng
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Intl.NumberFormat('vi-VN').format(Number(r.tong_sl))}
          </Text>
        </Text>
      ),
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Space wrap size={6} style={{ width: '100%' }}>
        <Input
          placeholder="Tìm số kế hoạch..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ width: 170 }}
          allowClear
        />
        <Select
          placeholder="Trạng thái"
          value={trangThai}
          onChange={v => { setTrangThai(v); setPage(1) }}
          allowClear
          style={{ width: 130 }}
          options={Object.entries(PLAN_TRANG_THAI).map(([v, s]) => ({
            value: v, label: s.label,
          }))}
        />
        <RangePicker
          format="DD/MM/YYYY"
          style={{ width: 210 }}
          onChange={(dates) => {
            setDateRange(
              dates && dates[0] && dates[1]
                ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                : null
            )
            setPage(1)
          }}
          placeholder={['Từ ngày', 'Đến ngày']}
          size="middle"
        />
      </Space>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ width: '100%' }}
        onClick={() => navigate('/production/plans/new')}
      >
        Tạo kế hoạch mới
      </Button>

      <Table<PlanListItem>
        rowKey="id"
        dataSource={data?.items ?? []}
        columns={cols}
        loading={isLoading}
        size="small"
        pagination={{
          total: data?.total ?? 0,
          current: page,
          pageSize: 20,
          onChange: setPage,
          showTotal: t => `${t} kế hoạch`,
          showSizeChanger: false,
          size: 'small',
        }}
        rowClassName={r => r.id === selectedId ? 'ant-table-row-selected' : ''}
        onRow={r => ({ onClick: () => onSelect(r.id), style: { cursor: 'pointer' } })}
        scroll={{ x: 440 }}
      />
    </Space>
  )
}
