import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Card,
  Collapse,
  Select,
  Table,
  Tag,
  Statistic,
  Space,
  Typography,
  Spin,
  Empty,
  Button,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FundViewOutlined } from '@ant-design/icons'
import { costAnalysisApi } from '../../api/cost_analysis'
import type { PaperRow, LsxCostItem } from '../../api/cost_analysis'
import { productionOrdersApi } from '../../api/productionOrders'

const { Title, Text } = Typography

const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' đ'

function deltaColor(value: number): string {
  if (value > 0) return '#cf1322'
  if (value < 0) return '#3f8600'
  return '#8c8c8c'
}

function DeltaCell({ value }: { value: number }) {
  const color = deltaColor(value)
  const prefix = value > 0 ? '+' : ''
  return (
    <span style={{ color, fontWeight: value !== 0 ? 600 : undefined }}>
      {prefix}{value.toLocaleString('vi-VN')}
    </span>
  )
}

const PAPER_COLUMNS: ColumnsType<PaperRow> = [
  { title: 'Lớp', dataIndex: 'vi_tri_lop', width: 80 },
  { title: 'Ký hiệu', dataIndex: 'ma_ky_hieu', width: 100 },
  {
    title: 'KH (kg)', dataIndex: 'kg_ke_hoach', align: 'right', width: 90,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'TT (kg)', dataIndex: 'kg_thuc_te', align: 'right', width: 90,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'Δ kg', dataIndex: 'delta_kg', align: 'right', width: 90,
    render: (v: number) => <DeltaCell value={v} />,
  },
  {
    title: 'Đơn giá KH', dataIndex: 'don_gia_ke_hoach', align: 'right', width: 110,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'Đơn giá TT', dataIndex: 'don_gia_thuc_te', align: 'right', width: 110,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'CP kế hoạch', dataIndex: 'chi_phi_ke_hoach', align: 'right', width: 120,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'CP thực tế', dataIndex: 'chi_phi_thuc_te', align: 'right', width: 120,
    render: (v: number) => v.toLocaleString('vi-VN'),
  },
  {
    title: 'Δ chi phí', dataIndex: 'delta_chi_phi', align: 'right', width: 120,
    render: (v: number) => <DeltaCell value={v} />,
  },
]

function LsxPanel({ item }: { item: LsxCostItem }) {
  return (
    <div>
      <Table<PaperRow>
        dataSource={item.paper_rows}
        columns={PAPER_COLUMNS}
        rowKey={(r) => r.vi_tri_lop + r.ma_ky_hieu}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        style={{ marginBottom: 12 }}
      />
      <Card size="small" style={{ background: '#fafafa' }}>
        <Space size="large" wrap>
          <Text>
            <Text strong>Tổng CP giấy: </Text>
            KH: <Text type="secondary">{formatVND(item.tong_chi_phi_giay_ke_hoach)}</Text>
            {' / '}
            TT: <Text style={{ color: item.tong_chi_phi_giay_thuc_te > item.tong_chi_phi_giay_ke_hoach ? '#cf1322' : '#3f8600' }}>
              {formatVND(item.tong_chi_phi_giay_thuc_te)}
            </Text>
          </Text>
          <Text>
            <Text strong>Giá thành/thùng: </Text>
            KH: <Text type="secondary">{formatVND(item.gia_thanh_giay_ke_hoach)}</Text>
            {' / '}
            TT: <Text style={{ color: item.gia_thanh_giay_thuc_te > item.gia_thanh_giay_ke_hoach ? '#cf1322' : '#3f8600' }}>
              {formatVND(item.gia_thanh_giay_thuc_te)}
            </Text>
          </Text>
        </Space>
      </Card>
    </div>
  )
}

export default function CostAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [khsxId, setKhsxId] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')

  // Read khsx_id from URL on mount
  useEffect(() => {
    const urlId = searchParams.get('khsx_id')
    if (urlId) {
      const n = parseInt(urlId)
      if (!isNaN(n)) setKhsxId(n)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search production orders by so_lenh / ten_hang
  const searchQuery = useQuery({
    queryKey: ['po-search-cost-analysis', searchText],
    queryFn: () =>
      productionOrdersApi.list({ search: searchText, page_size: 20 }).then(r => r.data),
    enabled: searchText.length >= 1,
    staleTime: 30_000,
  })

  const poOptions = (searchQuery.data?.items ?? []).map(po => ({
    value: po.id,
    label: `${po.so_lenh}${po.ten_hang ? ` — ${po.ten_hang}` : ''}${po.ten_khach_hang ? ` (${po.ten_khach_hang})` : ''}`,
  }))

  const handleSelect = (id: number) => {
    setKhsxId(id)
    setSearchParams({ khsx_id: String(id) }, { replace: true })
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['cost-analysis', khsxId],
    queryFn: () => costAnalysisApi.get(khsxId!).then((r) => r.data),
    enabled: khsxId !== null,
  })

  const summary = data?.summary
  const summaryDeltaColor = summary
    ? summary.delta_tong > 0 ? '#cf1322' : summary.delta_tong < 0 ? '#3f8600' : '#8c8c8c'
    : undefined

  const collapseItems = data?.items.map((item) => ({
    key: String(item.lsx_id),
    label: (
      <Space>
        <Text strong>{item.ten_hang}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>SL: {item.so_luong_ke_hoach.toLocaleString('vi-VN')}</Text>
        {item.has_bom
          ? <Tag color="green">Có BOM</Tag>
          : <Tag color="orange">Chưa có BOM</Tag>
        }
        {item.has_allocation
          ? <Tag color="green">Đã phân bổ</Tag>
          : <Tag color="default">Chưa phân bổ</Tag>
        }
      </Space>
    ),
    children: <LsxPanel item={item} />,
  }))

  return (
    <div style={{ padding: '16px 24px' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>Phân tích chi phí / Chênh lệch BOM vs Thực tế</Title>
        <Link to="/accounting/reports/production-costing">
          <Button icon={<FundViewOutlined />}>Giá thành sản xuất</Button>
        </Link>
      </Space>

      {/* Search bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            showSearch
            placeholder="Tìm lệnh sản xuất (mã lệnh, sản phẩm, khách hàng)..."
            style={{ width: 400 }}
            filterOption={false}
            onSearch={setSearchText}
            onSelect={handleSelect}
            loading={searchQuery.isFetching}
            options={poOptions}
            notFoundContent={searchText.length < 1 ? 'Nhập để tìm kiếm...' : searchQuery.isFetching ? <Spin size="small" /> : 'Không tìm thấy'}
            defaultValue={khsxId ?? undefined}
          />
          {data && (
            <Text>
              <Text strong>KHSX:</Text>{' '}
              <Text code>{data.so_lenh}</Text>
              {' | '}
              <Text>{data.items.length} lệnh SX</Text>
            </Text>
          )}
        </Space>
      </Card>

      {/* Loading / error states */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="Đang tải dữ liệu phân tích..." />
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <Empty
            description={
              <Text type="danger">
                Không tải được dữ liệu. Kiểm tra lại lệnh SX đã chọn hoặc kết nối server.
              </Text>
            }
          />
        </Card>
      )}

      {!khsxId && !isLoading && (
        <Card>
          <Empty description="Tìm và chọn lệnh kế hoạch sản xuất để xem phân tích chi phí" />
        </Card>
      )}

      {/* Summary */}
      {data && summary && (
        <Card style={{ marginBottom: 16 }}>
          <Space size="large" wrap>
            <Statistic
              title="Tổng chi phí kế hoạch"
              value={summary.tong_ke_hoach}
              formatter={(v) => formatVND(Number(v))}
              valueStyle={{ color: '#1677ff' }}
            />
            <Statistic
              title="Tổng chi phí thực tế"
              value={summary.tong_thuc_te}
              formatter={(v) => formatVND(Number(v))}
              valueStyle={{ color: summary.tong_thuc_te > summary.tong_ke_hoach ? '#cf1322' : '#3f8600' }}
            />
            <Statistic
              title="Chênh lệch (TT − KH)"
              value={summary.delta_tong}
              formatter={(v) => {
                const n = Number(v)
                const prefix = n > 0 ? '+' : ''
                return prefix + formatVND(n)
              }}
              valueStyle={{ color: summaryDeltaColor }}
            />
          </Space>
        </Card>
      )}

      {/* LSX list */}
      {data && data.items.length > 0 && (
        <Collapse
          items={collapseItems}
          defaultActiveKey={data.items.map((i) => String(i.lsx_id))}
        />
      )}

      {data && data.items.length === 0 && (
        <Card>
          <Empty description="Kế hoạch này chưa có lệnh sản xuất nào" />
        </Card>
      )}
    </div>
  )
}
