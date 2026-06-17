import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Drawer, Input, InputNumber, Row, Select, Space, Statistic, Table, Tag, Typography,
} from 'antd'
import { AuditOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { Dayjs } from 'dayjs'
import {
  accountingAuditApi,
  AccountingDimensionAuditItem,
  AccountingAuditLog,
  AccountingAuditLogParams,
} from '../../api/accounting'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

const TABLE_OPTIONS = [
  { value: 'bank_transactions', label: 'Giao dịch ngân hàng' },
  { value: 'cash_receipts', label: 'Phiếu thu' },
  { value: 'cash_payments', label: 'Phiếu chi' },
  { value: 'purchase_invoices', label: 'Hóa đơn mua hàng' },
  { value: 'production_cost_periods', label: 'Kỳ giá thành' },
  { value: 'journal_entries', label: 'Bút toán' },
]

const ACTION_META: Record<string, { label: string; color: string }> = {
  create: { label: 'Tạo', color: 'blue' },
  approve: { label: 'Duyệt', color: 'green' },
  cancel: { label: 'Hủy', color: 'red' },
  close: { label: 'Khóa kỳ', color: 'purple' },
  reconcile: { label: 'Đối soát', color: 'cyan' },
  unreconcile: { label: 'Bỏ đối soát', color: 'orange' },
  ignore: { label: 'Bỏ qua', color: 'default' },
  update: { label: 'Cập nhật', color: 'geekblue' },
}

function prettyJson(value: unknown) {
  if (value == null) return 'Không có dữ liệu'
  return JSON.stringify(value, null, 2)
}

export default function AccountingAuditPage() {
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [params, setParams] = useState<AccountingAuditLogParams>({
    tu_ngay: dayjs().startOf('month').format('YYYY-MM-DD'),
    den_ngay: dayjs().format('YYYY-MM-DD'),
    page: 1,
    page_size: 50,
  })
  const [selected, setSelected] = useState<AccountingAuditLog | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounting-audit-logs', params],
    queryFn: () => accountingAuditApi.list(params),
  })

  const dimensionParams = useMemo(() => ({
    tu_ngay: params.tu_ngay,
    den_ngay: params.den_ngay,
    limit: 100,
  }), [params.tu_ngay, params.den_ngay])

  const { data: dimensionAudit, isLoading: isDimensionLoading, refetch: refetchDimension } = useQuery({
    queryKey: ['accounting-dimension-audit', dimensionParams],
    queryFn: () => accountingAuditApi.dimensions(dimensionParams),
  })

  const tableLabelMap = useMemo(
    () => Object.fromEntries(TABLE_OPTIONS.map(item => [item.value, item.label])),
    [],
  )

  const dimensionColumns: ColumnsType<AccountingDimensionAuditItem> = [
    {
      title: 'Muc do',
      dataIndex: 'severity',
      width: 90,
      render: v => <Tag color={v === 'error' ? 'red' : 'orange'}>{v === 'error' ? 'Loi' : 'Canh bao'}</Tag>,
    },
    {
      title: 'Ngay',
      dataIndex: 'ngay',
      width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Bang',
      dataIndex: 'table',
      width: 170,
      render: v => tableLabelMap[v] || v,
    },
    {
      title: 'Chung tu',
      width: 150,
      render: (_, record) => record.record_code || (record.record_id ? `#${record.record_id}` : '-'),
    },
    {
      title: 'PN / PX',
      width: 130,
      render: (_, record) => `${record.phap_nhan_id ?? '-'} / ${record.phan_xuong_id ?? '-'}`,
    },
    {
      title: 'Can xu ly',
      dataIndex: 'message',
      ellipsis: true,
    },
  ]

  const columns: ColumnsType<AccountingAuditLog> = [
    {
      title: 'Thời điểm',
      dataIndex: 'created_at',
      width: 170,
      render: v => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
    },
    {
      title: 'Hành động',
      dataIndex: 'hanh_dong',
      width: 130,
      render: v => {
        const meta = ACTION_META[v] || { label: v, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Bảng',
      dataIndex: 'bang',
      width: 190,
      render: v => tableLabelMap[v] || v,
    },
    { title: 'Mã bản ghi', dataIndex: 'ban_ghi_id', width: 120, render: v => v || '-' },
    { title: 'User ID', dataIndex: 'user_id', width: 100, render: v => v ?? '-' },
    { title: 'IP', dataIndex: 'ip_address', width: 130, render: v => v || '-' },
    {
      title: '',
      key: 'action',
      width: 80,
      align: 'right',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(record)}>
          Xem
        </Button>
      ),
    },
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('accounting-audit', columns)

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <AuditOutlined style={{ fontSize: 24, color: '#1b168e' }} />
            <Title level={4} style={{ margin: 0 }}>Nhật ký audit kế toán</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            {settingsButton}
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Tải lại
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={7}>
            <Text type="secondary">Khoảng ngày</Text>
            <RangePicker
              style={{ width: '100%', marginTop: 4 }}
              value={dates}
              format="DD/MM/YYYY"
              onChange={value => {
                if (!value) return
                const next = value as [Dayjs, Dayjs]
                setDates(next)
                setParams(prev => ({
                  ...prev,
                  tu_ngay: next[0].format('YYYY-MM-DD'),
                  den_ngay: next[1].format('YYYY-MM-DD'),
                  page: 1,
                }))
              }}
            />
          </Col>
          <Col xs={24} md={5}>
            <Text type="secondary">Bảng</Text>
            <Select
              allowClear
              placeholder="Tất cả"
              style={{ width: '100%', marginTop: 4 }}
              options={TABLE_OPTIONS}
              value={params.bang}
              onChange={value => setParams(prev => ({ ...prev, bang: value, page: 1 }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary">Mã bản ghi</Text>
            <Input
              allowClear
              placeholder="ID"
              style={{ marginTop: 4 }}
              value={params.ban_ghi_id}
              onChange={event => setParams(prev => ({ ...prev, ban_ghi_id: event.target.value || undefined, page: 1 }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text type="secondary">User ID</Text>
            <InputNumber
              min={1}
              placeholder="User"
              style={{ width: '100%', marginTop: 4 }}
              value={params.user_id}
              onChange={value => setParams(prev => ({ ...prev, user_id: value ? Number(value) : undefined, page: 1 }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
              Lọc audit
            </Button>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title="Kiem soat phap nhan / xuong"
        extra={(
          <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchDimension()} loading={isDimensionLoading}>
            Tai lai
          </Button>
        )}
      >
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          <Col xs={12} md={6}>
            <Statistic title="Tong canh bao" value={dimensionAudit?.total || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Loi" value={dimensionAudit?.by_severity?.error || 0} valueStyle={{ color: '#cf1322' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Canh bao" value={dimensionAudit?.by_severity?.warning || 0} valueStyle={{ color: '#d48806' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Gioi han" value={dimensionAudit?.limited ? 'Co' : 'Khong'} />
          </Col>
        </Row>
        {dimensionAudit?.total ? (
          <Alert
            showIcon
            type={(dimensionAudit.by_severity?.error || 0) > 0 ? 'error' : 'warning'}
            message="Co du lieu ke toan can xu ly truoc khi khoa so hoac len bao cao theo phap nhan."
            style={{ marginBottom: 12 }}
          />
        ) : (
          <Alert
            showIcon
            type="success"
            message="Chua phat hien loi phap nhan/xuong trong khoang ngay dang loc."
            style={{ marginBottom: 12 }}
          />
        )}
        <Table
          locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
          rowKey={(record) => `${record.table}-${record.record_id ?? 'none'}-${record.category}-${record.message}`}
          size="small"
          loading={isDimensionLoading}
          dataSource={dimensionAudit?.items || []}
          columns={dimensionColumns}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data?.items || []}
        columns={displayColumns}
        scroll={{ x: 920 }}
        pagination={{
          total: data?.total || 0,
          current: params.page || 1,
          pageSize: params.page_size || 50,
          showSizeChanger: true,
          onChange: (page, pageSize) => setParams(prev => ({ ...prev, page, page_size: pageSize })),
        }}
      />

      <Drawer
        title={selected ? `Audit #${selected.id}` : 'Chi tiết audit'}
        open={!!selected}
        width={720}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Row gutter={[12, 8]}>
                <Col span={12}><Text type="secondary">Thời điểm</Text><br /><Text>{dayjs(selected.created_at).format('DD/MM/YYYY HH:mm:ss')}</Text></Col>
                <Col span={12}><Text type="secondary">Hành động</Text><br /><Text>{ACTION_META[selected.hanh_dong]?.label || selected.hanh_dong}</Text></Col>
                <Col span={12}><Text type="secondary">Bảng</Text><br /><Text>{tableLabelMap[selected.bang] || selected.bang}</Text></Col>
                <Col span={12}><Text type="secondary">Bản ghi</Text><br /><Text>{selected.ban_ghi_id || '-'}</Text></Col>
                <Col span={12}><Text type="secondary">User ID</Text><br /><Text>{selected.user_id ?? '-'}</Text></Col>
                <Col span={12}><Text type="secondary">IP</Text><br /><Text>{selected.ip_address || '-'}</Text></Col>
              </Row>
            </Card>

            <Card size="small" title="Dữ liệu cũ">
              <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                {prettyJson(selected.du_lieu_cu)}
              </Paragraph>
            </Card>

            <Card size="small" title="Dữ liệu mới">
              <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>
                {prettyJson(selected.du_lieu_moi)}
              </Paragraph>
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
