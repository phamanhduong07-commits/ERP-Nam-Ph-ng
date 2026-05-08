import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, DatePicker, Space, Tag, Typography,
  Card, Row, Col, message, Modal, Descriptions, List, Divider,
} from 'antd'
import { FileExcelOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { salesReturnsApi, type SalesReturnListItem, SALES_RETURN_TRANG_THAI_LABELS, SALES_RETURN_TRANG_THAI_COLORS } from '../../api/salesReturns'
import { customersApi } from '../../api/customers'
import { exportToExcel } from '../../utils/exportUtils'

const { Title } = Typography
const { RangePicker } = DatePicker
const { confirm } = Modal

export default function SalesReturnsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string>('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.list({ page_size: 100 }).then(r => r.data.items),
  })

  const { data: returnsData, isLoading, refetch } = useQuery({
    queryKey: ['sales-returns', search, trangThai, customerId, dateRange, page, pageSize],
    queryFn: () => salesReturnsApi.list({
      search: search || undefined,
      trang_thai: trangThai || undefined,
      customer_id: customerId || undefined,
      tu_ngay: dateRange[0]?.format('YYYY-MM-DD'),
      den_ngay: dateRange[1]?.format('YYYY-MM-DD'),
      page,
      page_size: pageSize,
    }).then(r => r.data),
  })
  const returnRows = returnsData?.items || (returnsData as { data?: SalesReturnListItem[] } | undefined)?.data || []

  const handleApprove = async (record: SalesReturnListItem) => {
    try {
      await salesReturnsApi.approve(record.id)
      message.success('Đã duyệt phiếu trả hàng')
      refetch()
      queryClient.invalidateQueries({ queryKey: ['ton-kho-tp-lsx'] })
      queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    }
  }

  const handleCancel = async (record: SalesReturnListItem) => {
    confirm({
      title: 'Xác nhận hủy phiếu trả hàng',
      content: `Bạn có chắc muốn hủy phiếu trả hàng ${record.so_phieu_tra}?`,
      okText: 'Hủy phiếu',
      okType: 'danger',
      cancelText: 'Không',
      onOk: async () => {
        try {
          await salesReturnsApi.cancel(record.id)
          message.success('Đã hủy phiếu trả hàng')
          refetch()
          queryClient.invalidateQueries({ queryKey: ['ton-kho-tp-lsx'] })
          queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
        } catch (err: any) {
          message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
        }
      },
    })
  }

  const columns: ColumnsType<SalesReturnListItem> = [
    {
      title: 'Số phiếu trả',
      dataIndex: 'so_phieu_tra',
      width: 140,
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/sales/returns/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày trả',
      dataIndex: 'ngay_tra',
      width: 120,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don_ban',
      width: 120,
      render: (v) => v || '—',
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'Lý do trả',
      dataIndex: 'ly_do_tra',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 100,
      render: (v: string) => (
        <Tag color={SALES_RETURN_TRANG_THAI_COLORS[v] || 'default'}>
          {SALES_RETURN_TRANG_THAI_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_tien_tra',
      width: 120,
      align: 'right',
      render: (v) => new Intl.NumberFormat('vi-VN').format(v) + 'đ',
    },
    {
      title: 'SL trả',
      dataIndex: 'tong_so_luong_tra',
      width: 90,
      align: 'right',
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0),
    },
    {
      title: 'Thao tác',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sales/returns/${r.id}`)}
          />
          {r.trang_thai === 'moi' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(r)}
              />
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancel(r)}
              />
            </>
          )}
        </Space>
      ),
    },
  ]

  const handleExportExcel = () => {
    exportToExcel(`TraHangBan_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Trả hàng bán',
      headers: ['Số phiếu trả', 'Ngày trả', 'Đơn hàng', 'Khách hàng', 'Lý do trả', 'Trạng thái', 'SL trả', 'Tổng tiền (đ)'],
      rows: returnRows.map((r: SalesReturnListItem) => [
        r.so_phieu_tra,
        dayjs(r.ngay_tra).format('DD/MM/YYYY'),
        r.so_don_ban || '',
        r.ten_khach_hang,
        r.ly_do_tra || '',
        SALES_RETURN_TRANG_THAI_LABELS[r.trang_thai] || r.trang_thai,
        r.tong_so_luong_tra || 0,
        r.tong_tien_tra,
      ]),
      colWidths: [18, 12, 14, 25, 25, 12, 10, 16],
    }])
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Quản lý trả lại hàng bán</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/sales/returns/create')}>
            Tạo phiếu trả hàng
          </Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Input
              placeholder="Tìm theo số phiếu, đơn hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Trạng thái"
              value={trangThai}
              onChange={setTrangThai}
              allowClear
              style={{ width: '100%' }}
            >
              {Object.entries(SALES_RETURN_TRANG_THAI_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="Khách hàng"
              value={customerId}
              onChange={setCustomerId}
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {customers?.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  [{c.ma_kh}] {c.ten_viet_tat}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={2}>
            <Button onClick={() => {
              setSearch('')
              setTrangThai('')
              setCustomerId(null)
              setDateRange([null, null])
              setPage(1)
            }}>
              Xóa lọc
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={returnRows}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: returnsData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} phiếu`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          size="small"
        />
      </Card>
    </div>
  )
}
