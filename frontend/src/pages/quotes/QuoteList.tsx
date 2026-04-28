import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Space, Tag, Input, Select, DatePicker,
  Popconfirm, message, Card, Row, Col, Typography, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckCircleOutlined, StopOutlined, FileAddOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { quotesApi, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../api/quotes'
import type { QuoteListItem } from '../../api/quotes'
import { exportToExcel, printToPdf, fmtVND, fmtDate, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export default function QuoteList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | []>([])
  const [page, setPage] = useState(1)

  const isEmbedded = !!onSelect

  const handleExportExcel = () => {
    const items = data?.items ?? []
    exportToExcel(`BaoGia_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Báo giá',
      headers: ['STT', 'Số BG', 'Ngày BG', 'Khách hàng', 'Ngày HH', 'Số dòng', 'Tổng cộng (đ)', 'Trạng thái'],
      rows: items.map((r, i) => [
        i + 1, r.so_bao_gia, fmtDate(r.ngay_bao_gia), r.ten_khach_hang ?? '',
        fmtDate(r.ngay_het_han ?? null), r.so_dong, Number(r.tong_cong ?? 0), QUOTE_STATUS_LABELS[r.trang_thai] ?? r.trang_thai,
      ]),
      colWidths: [5, 18, 12, 30, 12, 8, 16, 14],
    }])
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const cols = [
      { header: 'STT', align: 'center' as const },
      { header: 'Số BG' }, { header: 'Ngày BG' }, { header: 'Khách hàng' },
      { header: 'Ngày HH' }, { header: 'Số dòng', align: 'center' as const },
      { header: 'Tổng cộng (đ)', align: 'right' as const }, { header: 'Trạng thái' },
    ]
    const rows = items.map((r, i) => [
      i + 1, r.so_bao_gia, fmtDate(r.ngay_bao_gia), r.ten_khach_hang ?? '',
      fmtDate(r.ngay_het_han ?? null), r.so_dong, fmtVND(r.tong_cong), QUOTE_STATUS_LABELS[r.trang_thai] ?? r.trang_thai,
    ])
    printToPdf(
      'Danh sách báo giá',
      `<h2>DANH SÁCH BÁO GIÁ</h2>
       <p class="meta">Xuất ngày: ${dayjs().format('DD/MM/YYYY HH:mm')} — ${items.length} báo giá</p>
       ${buildHtmlTable(cols, rows)}`,
      true,
    )
  }

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search, trangThai, dateRange, page],
    queryFn: () =>
      quotesApi.list({
        search,
        trang_thai: trangThai,
        tu_ngay: dateRange[0],
        den_ngay: dateRange[1],
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => quotesApi.approve(id),
    onSuccess: () => {
      message.success('Đã duyệt báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => quotesApi.cancel(id),
    onSuccess: () => {
      message.success('Đã huỷ báo giá')
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi huỷ'),
  })

  const taoDonMutation = useMutation({
    mutationFn: (id: number) => quotesApi.taoDonHang(id),
    onSuccess: (res) => {
      message.success(`Đã tạo ${res.data.so_don}`)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      navigate('/sales/orders')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo đơn'),
  })

  const compactColumns: ColumnsType<QuoteListItem> = [
    {
      title: 'Số BG',
      dataIndex: 'so_bao_gia',
      render: (v) => <Text style={{ color: '#1677ff', fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_bao_gia',
      width: 76,
      render: (v) => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'TT',
      dataIndex: 'trang_thai',
      width: 86,
      render: (v) => <Tag color={QUOTE_STATUS_COLORS[v] || 'default'} style={{ fontSize: 11 }}>{QUOTE_STATUS_LABELS[v] || v}</Tag>,
    },
  ]

  const fullColumns: ColumnsType<QuoteListItem> = [
    {
      title: 'Số BG',
      dataIndex: 'so_bao_gia',
      width: 140,
      render: (v, row) => (
        <Button type="link" size="small" onClick={() => navigate(`/quotes/${row.id}`)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày lập',
      dataIndex: 'created_at',
      width: 130,
      render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Ngày BG',
      dataIndex: 'ngay_bao_gia',
      width: 100,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
    },
    {
      title: 'Ngày HH',
      dataIndex: 'ngay_het_han',
      width: 100,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 80,
      align: 'center',
    },
    {
      title: 'Tổng cộng',
      dataIndex: 'tong_cong',
      width: 140,
      align: 'right',
      render: (v) => v ? v.toLocaleString('vi-VN') + ' ₫' : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v) => (
        <Tag color={QUOTE_STATUS_COLORS[v] || 'default'}>
          {QUOTE_STATUS_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/quotes/${row.id}`)} />
          </Tooltip>
          {row.trang_thai === 'moi' && (
            <Tooltip title="Duyệt">
              <Popconfirm title="Duyệt báo giá này?" onConfirm={() => approveMutation.mutate(row.id)}>
                <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost />
              </Popconfirm>
            </Tooltip>
          )}
          {(row.trang_thai === 'moi' || row.trang_thai === 'da_duyet') && (
            <Tooltip title="Lập đơn hàng">
              <Popconfirm title="Tạo đơn hàng từ báo giá này?" onConfirm={() => taoDonMutation.mutate(row.id)}>
                <Button size="small" icon={<FileAddOutlined />} type="primary" />
              </Popconfirm>
            </Tooltip>
          )}
          {row.trang_thai !== 'huy' && (
            <Tooltip title="Huỷ">
              <Popconfirm title="Huỷ báo giá này?" onConfirm={() => cancelMutation.mutate(row.id)}>
                <Button size="small" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <style>{`.md-selected-row > td { background-color: #e6f4ff !important; }`}</style>

      <Card style={{ marginBottom: 8 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={5} style={{ margin: 0 }}>Báo giá</Title>
          </Col>
          <Col>
            <Space size={4}>
              {!isEmbedded && (
                <>
                  <Tooltip title="Xuất Excel">
                    <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} />
                  </Tooltip>
                  <Tooltip title="Xuất PDF">
                    <Button size="small" icon={<FilePdfOutlined />} style={{ color: '#e53935', borderColor: '#e53935' }} onClick={handleExportPdf} />
                  </Tooltip>
                </>
              )}
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => navigate('/quotes/new')}
              >
                Thêm mới
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số BG, khách hàng..."
              prefix={<SearchOutlined />}
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="TT"
              size="small"
              style={{ width: 110 }}
              allowClear
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(QUOTE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 8 }}>
          <Col span={24}>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Ngày BG từ', 'Đến ngày']}
              onChange={(_, s) => {
                setDateRange(s[0] && s[1] ? [
                  dayjs(s[0], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                  dayjs(s[1], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                ] : [])
                setPage(1)
              }}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </Card>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={isEmbedded ? compactColumns : fullColumns}
        dataSource={data?.items || []}
        rowClassName={(r) => r.id === selectedId ? 'md-selected-row' : ''}
        onRow={(r) => ({
          onClick: isEmbedded ? () => onSelect!(r.id) : undefined,
          style: isEmbedded ? { cursor: 'pointer' } : undefined,
        })}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
          showTotal: (t) => `${t} báo giá`,
          showSizeChanger: false,
          size: 'small',
        }}
        size="small"
        scroll={isEmbedded ? undefined : { x: 900 }}
      />
    </div>
  )
}
