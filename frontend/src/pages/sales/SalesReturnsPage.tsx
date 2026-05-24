import { useState } from 'react'
import { getErrorMessage } from '../../utils/errorUtils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, DatePicker, Space, Tag, Typography,
  Card, Row, Col, message, Modal, Tooltip, Statistic,
} from 'antd'
import {
  FileExcelOutlined, PlusOutlined, EyeOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, CheckOutlined,
  ExclamationCircleOutlined, DollarOutlined, BankOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  salesReturnsApi,
  type SalesReturnListItem,
  type SalesReturnSummary,
  type PagedReturnsResponse,
  SALES_RETURN_TRANG_THAI_LABELS,
  SALES_RETURN_TRANG_THAI_COLORS,
  PHUONG_AN_LABELS,
} from '../../api/salesReturns'
import { customersApi } from '../../api/customers'
import { exportToExcel } from '../../utils/exportUtils'
import { useAuthStore } from '../../store/auth'

const APPROVE_ROLES = ['ADMIN', 'BGD_GIAM_DOC', 'BGD_TO_TRUONG', 'KE_TOAN_TRUONG', 'KE_TOAN_CONG_NO', 'TRUONG_PHONG_SALE_ADMIN', 'SALE_ADMIN', 'KINH_DOANH_TO_TRUONG']

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { confirm } = Modal

const PHUONG_AN_ICONS: Record<string, React.ReactNode> = {
  chua_xuat_hd: <CheckOutlined />,
  da_xuat_hd: <ExclamationCircleOutlined />,
  da_thu_tien: <DollarOutlined />,
}

const TRANG_THAI_HOAN_TIEN_LABELS: Record<string, { label: string; color: string }> = {
  nhap:     { label: 'Chờ xử lý', color: 'orange' },
  da_duyet: { label: 'Đã hoàn', color: 'green' },
  huy:      { label: 'Đã hủy', color: 'red' },
}

export default function SalesReturnsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canApproveRole = APPROVE_ROLES.includes(user?.role ?? '')
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string>('')
  const [phuongAn, setPhuongAn] = useState<string>('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.list({ page_size: 500 }).then(r => r.data.items),
  })

  // Khi filter phuong_an active: load toàn bộ (page_size=500) để client-side filter chính xác
  const effectivePageSize = phuongAn ? 500 : pageSize
  const effectivePage = phuongAn ? 1 : page

  const { data: returnsData, isLoading, refetch } = useQuery<PagedReturnsResponse>({
    queryKey: ['sales-returns', search, trangThai, customerId, dateRange, page, pageSize, phuongAn],
    queryFn: () => salesReturnsApi.list({
      search: search || undefined,
      trang_thai: trangThai || undefined,
      customer_id: customerId || undefined,
      tu_ngay: dateRange[0]?.format('YYYY-MM-DD'),
      den_ngay: dateRange[1]?.format('YYYY-MM-DD'),
      page: effectivePage,
      page_size: effectivePageSize,
    }).then(r => r.data as PagedReturnsResponse),
  })

  const allRows: SalesReturnListItem[] = returnsData?.items || []
  const summary: SalesReturnSummary | undefined = returnsData?.summary

  // Client-side filter by phuong_an (computed field, không filter ở server)
  const returnRows = phuongAn
    ? allRows.filter(r => r.phuong_an_can_tru === phuongAn)
    : allRows

  const handleApprove = async (record: SalesReturnListItem) => {
    confirm({
      title: 'Xác nhận duyệt phiếu trả hàng',
      content: (
        <div>
          <p>Duyệt phiếu <strong>{record.so_phieu_tra}</strong>?</p>
          <p style={{ color: '#666', fontSize: 13 }}>
            Hệ thống sẽ: nhập hàng vào kho · giảm công nợ phải thu · ghi bút toán 155/632 và 5213/131
          </p>
        </div>
      ),
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await salesReturnsApi.approve(record.id)
          message.success('Đã duyệt phiếu trả hàng')
          refetch()
          queryClient.invalidateQueries({ queryKey: ['ton-kho-tp-lsx'] })
          queryClient.invalidateQueries({ queryKey: ['ton-kho'] })
        } catch (err: any) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const handleCancel = async (record: SalesReturnListItem) => {
    confirm({
      title: 'Xác nhận hủy phiếu trả hàng',
      content: `Bạn có chắc muốn hủy phiếu trả hàng ${record.so_phieu_tra}? Nếu đã duyệt, hàng sẽ được xuất lại khỏi kho.`,
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
          message.error(getErrorMessage(err))
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
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/sales/returns/${r.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày trả',
      dataIndex: 'ngay_tra',
      width: 100,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'so_don_ban',
      width: 115,
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
      width: 95,
      render: (v: string) => (
        <Tag color={SALES_RETURN_TRANG_THAI_COLORS[v] || 'default'}>
          {SALES_RETURN_TRANG_THAI_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: 'Phương án',
      dataIndex: 'phuong_an_can_tru',
      width: 130,
      render: (v: string | null, r) => {
        if (r.trang_thai !== 'da_duyet') return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        const info = v ? PHUONG_AN_LABELS[v] : null
        if (!info) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        return (
          <Tag color={info.color} icon={PHUONG_AN_ICONS[v!]} style={{ fontSize: 12 }}>
            {info.label}
          </Tag>
        )
      },
    },
    {
      title: 'Hoàn tiền',
      dataIndex: 'trang_thai_hoan_tien',
      width: 105,
      render: (v: string | null, r) => {
        if (r.trang_thai !== 'da_duyet') return null
        const info = v ? TRANG_THAI_HOAN_TIEN_LABELS[v] : null
        if (!info) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        return <Tag color={info.color} style={{ fontSize: 12 }}>{info.label}</Tag>
      },
    },
    {
      title: 'SL trả',
      dataIndex: 'tong_so_luong_tra',
      width: 70,
      align: 'right',
      render: (v: number) => new Intl.NumberFormat('vi-VN').format(v || 0),
    },
    {
      title: 'Tổng tiền trả',
      dataIndex: 'tong_tien_tra',
      width: 130,
      align: 'right',
      render: (v) => (
        <Text strong style={{ color: '#cf1322' }}>
          {new Intl.NumberFormat('vi-VN').format(v)}đ
        </Text>
      ),
    },
    {
      title: 'Thao tác',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/sales/returns/${r.id}`)}
            />
          </Tooltip>
          {r.trang_thai === 'moi' && canApproveRole && (
            <>
              <Tooltip title="Duyệt phiếu">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(r)}
                />
              </Tooltip>
              <Tooltip title="Hủy phiếu">
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancel(r)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  const handleExportExcel = () => {
    exportToExcel(`TraHangBan_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Trả hàng bán',
      headers: [
        'Số phiếu trả', 'Ngày trả', 'Đơn hàng', 'Khách hàng', 'Lý do trả',
        'Trạng thái', 'Phương án cấn trừ', 'Hoàn tiền', 'SL trả', 'Tổng tiền (đ)',
      ],
      rows: returnRows.map((r: SalesReturnListItem) => [
        r.so_phieu_tra,
        dayjs(r.ngay_tra).format('DD/MM/YYYY'),
        r.so_don_ban || '',
        r.ten_khach_hang,
        r.ly_do_tra || '',
        SALES_RETURN_TRANG_THAI_LABELS[r.trang_thai] || r.trang_thai,
        r.phuong_an_can_tru ? (PHUONG_AN_LABELS[r.phuong_an_can_tru]?.label ?? r.phuong_an_can_tru) : '',
        r.trang_thai_hoan_tien ? (TRANG_THAI_HOAN_TIEN_LABELS[r.trang_thai_hoan_tien]?.label ?? r.trang_thai_hoan_tien) : '',
        r.tong_so_luong_tra || 0,
        r.tong_tien_tra,
      ]),
      colWidths: [18, 12, 14, 25, 25, 12, 16, 14, 10, 16],
    }])
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={4} style={{ margin: 0 }}>Quản lý trả lại hàng bán</Title>
        <Space>
          <Button
            icon={<FileExcelOutlined />}
            style={{ color: '#217346', borderColor: '#217346' }}
            onClick={handleExportExcel}
          >
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/sales/returns/create')}>
            Tạo phiếu trả hàng
          </Button>
        </Space>
      </Space>

      {/* Summary KPIs */}
      {summary && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {(customerId || dateRange[0] || dateRange[1]) && (
            <Col xs={24} style={{ marginBottom: 6 }}>
              <Tag color="blue">Theo bộ lọc hiện tại</Tag>
            </Col>
          )}
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
              <Statistic
                title={<Space size={4}><ClockCircleOutlined style={{ color: '#1677ff' }} /><span>Chờ duyệt</span></Space>}
                value={summary.so_phieu_cho_duyet}
                suffix="phiếu"
                valueStyle={{ color: '#1677ff', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
              <Statistic
                title={<Space size={4}><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Đã duyệt</span></Space>}
                value={summary.so_phieu_da_duyet}
                suffix="phiếu"
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
              <Statistic
                title={<Space size={4}><BankOutlined style={{ color: '#cf1322' }} /><span>Tổng tiền trả</span></Space>}
                value={summary.tong_tien_tra}
                formatter={(v) => new Intl.NumberFormat('vi-VN').format(v as number) + 'đ'}
                valueStyle={{ color: '#cf1322', fontSize: 16 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card
              size="small"
              styles={{ body: { padding: '12px 16px' } }}
              style={summary.so_hoan_tien_cho_xu_ly > 0 ? { border: '1px solid #fa8c16' } : {}}
            >
              <Statistic
                title={<Space size={4}><ExclamationCircleOutlined style={{ color: '#fa8c16' }} /><span>Hoàn tiền chờ xử lý</span></Space>}
                value={summary.so_hoan_tien_cho_xu_ly}
                suffix="phiếu"
                valueStyle={{
                  color: summary.so_hoan_tien_cho_xu_ly > 0 ? '#fa8c16' : '#8c8c8c',
                  fontSize: 20,
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]}>
          <Col xs={24} sm={6}>
            <Input
              placeholder="Tìm theo số phiếu, đơn hàng..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col xs={12} sm={4}>
            <Select
              placeholder="Trạng thái"
              value={trangThai || undefined}
              onChange={(v) => { setTrangThai(v || ''); setPage(1) }}
              allowClear
              style={{ width: '100%' }}
            >
              {Object.entries(SALES_RETURN_TRANG_THAI_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select
              placeholder="Phương án"
              value={phuongAn || undefined}
              onChange={(v) => { setPhuongAn(v || ''); setPage(1) }}
              allowClear
              style={{ width: '100%' }}
            >
              {Object.entries(PHUONG_AN_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  <Tag color={v.color} style={{ marginRight: 4 }}>{v.label}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Khách hàng"
              value={customerId}
              onChange={(v) => { setCustomerId(v); setPage(1) }}
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
          <Col xs={24} sm={6}>
            <RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])
                setPage(1)
              }}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={2}>
            <Button onClick={() => {
              setSearch('')
              setTrangThai('')
              setPhuongAn('')
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
          scroll={{ x: 1000 }}
          locale={{ emptyText: phuongAn ? 'Không có phiếu nào phù hợp với phương án đã chọn' : 'Không có dữ liệu' }}
          rowClassName={(r) => {
            if (r.trang_thai === 'da_duyet' && r.trang_thai_hoan_tien === 'nhap') return 'row-warning'
            return ''
          }}
          pagination={{
            current: page,
            pageSize,
            total: phuongAn ? returnRows.length : (returnsData?.total || 0),
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

      <style>{`
        .row-warning td { background: #fffbe6 !important; }
        .row-warning:hover td { background: #fff7cc !important; }
      `}</style>
    </div>
  )
}
