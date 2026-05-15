import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Input, Select, Space, Tag, Card, Typography,
  DatePicker, Row, Col, Tooltip, Popconfirm, message,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, EyeOutlined,
  CheckOutlined, CloseOutlined, FileExcelOutlined, FilePdfOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/salesOrders'
import type { SalesOrderListItem } from '../../api/salesOrders'
import { phapNhanApi } from '../../api/phap_nhan'
import { fmtVND, fmtDate, buildHtmlTable, smartExportExcel, smartPrintPdf } from '../../utils/exportUtils'
import ImportExcelDialog from '../../components/ImportExcelDialog'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const SS_KEY = 'order-list-filters'

interface Props {
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export default function OrderList({ selectedId, onSelect }: Props) {
  const navigate = useNavigate()
  const isEmbedded = !!onSelect

  // ── Restore filters từ sessionStorage (chỉ khi không embedded) ──
  const savedFilters = !isEmbedded
    ? (() => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) ?? '{}') } catch { return {} } })()
    : {}

  const [search, setSearch] = useState<string>(savedFilters.search ?? '')
  const [trangThai, setTrangThai] = useState<string | undefined>(savedFilters.trangThai)
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>(savedFilters.phapNhanId)
  const [dateRange, setDateRange] = useState<[string, string] | null>(savedFilters.dateRange ?? null)
  const [page, setPage] = useState<number>(savedFilters.page ?? 1)
  const [importVisible, setImportVisible] = useState(false)

  // ── Persist filters vào sessionStorage ──
  useEffect(() => {
    if (isEmbedded) return
    sessionStorage.setItem(SS_KEY, JSON.stringify({ search, trangThai, phapNhanId, dateRange, page }))
  }, [search, trangThai, phapNhanId, dateRange, page, isEmbedded])

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales-orders', search, trangThai, phapNhanId, dateRange, page],
    queryFn: () => salesOrdersApi.list({
      search,
      trang_thai: trangThai,
      phap_nhan_id: phapNhanId,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page,
      page_size: 20,
    }).then((r) => r.data),
  })

  const handleApprove = async (id: number, soDon: string) => {
    try {
      await salesOrdersApi.approve(id)
      message.success(`Đã duyệt đơn hàng ${soDon}`)
      refetch()
    } catch {
      message.error('Duyệt đơn thất bại')
    }
  }

  const handleCancel = async (id: number, soDon: string) => {
    try {
      await salesOrdersApi.cancel(id)
      message.success(`Đã huỷ đơn hàng ${soDon}`)
      refetch()
    } catch {
      message.error('Huỷ đơn thất bại')
    }
  }

  const handleExportExcel = () => {
    const items = data?.items ?? []
    const defaultConfig = [
      { key: 'stt', label: 'STT', width: 5 },
      { key: 'so_don', label: 'Số đơn hàng', width: 18 },
      { key: 'ngay_don', label: 'Ngày đơn', width: 12 },
      { key: 'ten_khach_hang', label: 'Khách hàng', width: 30 },
      { key: 'ten_phap_nhan', label: 'Pháp nhân', width: 20 },
      { key: 'ngay_giao_hang', label: 'Ngày giao', width: 12 },
      { key: 'so_dong', label: 'Số dòng', width: 8 },
      { key: 'tong_tien', label: 'Tổng tiền (đ)', width: 16 },
      { key: 'trang_thai_lbl', label: 'Trạng thái', width: 14 },
    ]

    const exportData = items.map((r, i) => ({
      ...r,
      stt: i + 1,
      ngay_don: fmtDate(r.ngay_don),
      ngay_giao_hang: fmtDate(r.ngay_giao_hang),
      tong_tien: Number(r.tong_tien),
      trang_thai_lbl: TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    }))

    smartExportExcel('SALES_ORDER', exportData, defaultConfig, `DonHang_${dayjs().format('YYYYMMDD')}`)
  }

  const handleExportPdf = () => {
    const items = data?.items ?? []
    const cols = [
      { header: 'STT', key: 'stt', align: 'center' as const },
      { header: 'Số đơn hàng', key: 'so_don' },
      { header: 'Ngày đơn', key: 'ngay_don' },
      { header: 'Khách hàng', key: 'ten_khach_hang' },
      { header: 'Pháp nhân', key: 'ten_phap_nhan' },
      { header: 'Ngày giao', key: 'ngay_giao_hang' },
      { header: 'Số dòng', key: 'so_dong', align: 'center' as const },
      { header: 'Tổng tiền (đ)', key: 'tong_tien', align: 'right' as const },
      { header: 'Trạng thái', key: 'trang_thai_lbl' },
    ]

    const rows = items.map((r, i) => ({
      stt: i + 1,
      so_don: r.so_don,
      ngay_don: fmtDate(r.ngay_don),
      ten_khach_hang: r.ten_khach_hang ?? '',
      ten_phap_nhan: r.ten_phap_nhan ?? '—',
      ngay_giao_hang: fmtDate(r.ngay_giao_hang),
      so_dong: r.so_dong,
      tong_tien: fmtVND(r.tong_tien),
      trang_thai_lbl: TRANG_THAI_LABELS[r.trang_thai] ?? r.trang_thai,
    }))

    const table = buildHtmlTable(cols.map(c => ({ header: c.header, align: c.align })), rows.map(r => cols.map(c => r[c.key as keyof typeof r])))

    const printData = {
      subtitle: 'DANH SÁCH ĐƠN HÀNG',
      document_date: dayjs().format('DD/MM/YYYY HH:mm'),
      document_number: `${items.length} đơn hàng`,
      body_html: table,
    }

    smartPrintPdf('SALES_ORDER', printData)
  }

  const compactColumns: ColumnsType<SalesOrderListItem> = [
    {
      title: 'Số đơn',
      dataIndex: 'so_don',
      render: (v) => <Text style={{ color: '#1677ff', fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_don',
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
      width: 90,
      render: (v) => <Tag color={TRANG_THAI_COLORS[v]} style={{ fontSize: 11 }}>{TRANG_THAI_LABELS[v] || v}</Tag>,
    },
  ]

  const fullColumns: ColumnsType<SalesOrderListItem> = [
    {
      title: 'Số đơn',
      dataIndex: 'so_don',
      width: 150,
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/sales/orders/${r.id}`)} style={{ padding: 0 }}>
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
      title: 'Ngày đơn',
      dataIndex: 'ngay_don',
      width: 100,
      render: (v) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      ellipsis: true,
      minWidth: 160,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 130,
      ellipsis: true,
      render: (v) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 100,
      render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Số dòng',
      dataIndex: 'so_dong',
      width: 75,
      align: 'center',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'tong_tien_sau_giam',
      width: 130,
      align: 'right',
      render: (v) => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v) => (
        <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 110,
      align: 'center',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/sales/orders/${r.id}`)} />
          </Tooltip>
          {r.trang_thai === 'moi' && (
            <Tooltip title="Duyệt đơn">
              <Popconfirm
                title={`Duyệt đơn hàng ${r.so_don}?`}
                onConfirm={() => handleApprove(r.id, r.so_don)}
                okText="Duyệt"
              >
                <Button size="small" type="primary" icon={<CheckOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['moi', 'da_duyet'].includes(r.trang_thai) && (
            <Tooltip title="Huỷ đơn">
              <Popconfirm
                title={`Huỷ đơn hàng ${r.so_don}?`}
                onConfirm={() => handleCancel(r.id, r.so_don)}
                okText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<CloseOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const hasFilter = !!(search || trangThai || phapNhanId || dateRange)

  return (
    <div>
      <style>{`.md-selected-row > td { background-color: #e6f4ff !important; }`}</style>

      <Card style={{ marginBottom: 8 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={5} style={{ margin: 0 }}>Đơn hàng</Title>
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
                onClick={() => navigate('/sales/orders/new')}
              >
                Tạo đơn hàng
              </Button>
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={() => setImportVisible(true)}
              >
                Import
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col flex="auto">
            <Input
              placeholder="Tìm số đơn, khách hàng..."
              prefix={<SearchOutlined />}
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              size="small"
              style={{ width: 120 }}
              allowClear
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Col>
          <Col>
            <Select
              placeholder="Pháp nhân"
              size="small"
              style={{ width: 150 }}
              allowClear
              showSearch
              value={phapNhanId}
              onChange={(v) => { setPhapNhanId(v); setPage(1) }}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={phapNhanList.map((p: any) => ({
                value: p.id,
                label: p.ten_phap_nhan,
              }))}
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 8 }}>
          <Col span={24}>
            <RangePicker
              style={{ width: '100%' }}
              size="small"
              format="DD/MM/YYYY"
              placeholder={['Ngày đơn từ', 'Đến ngày']}
              value={dateRange ? [dayjs(dateRange[0], 'YYYY-MM-DD'), dayjs(dateRange[1], 'YYYY-MM-DD')] : null}
              onChange={(_, s) => {
                setDateRange(s[0] && s[1] ? [
                  dayjs(s[0], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                  dayjs(s[1], 'DD/MM/YYYY').format('YYYY-MM-DD'),
                ] : null)
                setPage(1)
              }}
            />
          </Col>
        </Row>
      </Card>

      <Table
        columns={isEmbedded ? compactColumns : fullColumns}
        dataSource={data?.items || []}
        rowKey="id"
        loading={isLoading}
        locale={{ emptyText: hasFilter ? 'Không tìm thấy đơn hàng nào' : 'Chưa có đơn hàng nào' }}
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
          showTotal: (t) => `${t} đơn hàng`,
          showSizeChanger: false,
          size: 'small',
        }}
        size="small"
        scroll={isEmbedded ? undefined : { x: 1200 }}
      />

      <ImportExcelDialog
        title="Import đơn hàng từ Excel"
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => refetch()}
        importFn={(file, commit) => salesOrdersApi.importOrders(file, commit)}
        templateUrl="/api/sales-orders/import-template"
      />
    </div>
  )
}
