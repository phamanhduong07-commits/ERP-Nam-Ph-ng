import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Input, Modal, Row, Select, Space,
  Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckOutlined, CloseOutlined, PrinterOutlined, LinkOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  billingApi, InvoiceAdjustmentLog, AdjustmentLogFilter, TRANG_THAI_INVOICE,
} from '../../api/billing'
import { useAuthStore } from '../../store/auth'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const APPROVE_ROLES = ['KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  na:       { label: 'Đã áp dụng', color: 'blue' },
  pending:  { label: 'Chờ duyệt',  color: 'orange' },
  approved: { label: 'Đã duyệt',   color: 'green' },
  rejected: { label: 'Từ chối',    color: 'red' },
}

const LOAI_MAP: Record<string, { label: string; color: string }> = {
  truoc_ket_chuyen: { label: 'Trước KC', color: 'blue' },
  sau_ket_chuyen:   { label: 'Sau KC',   color: 'orange' },
}

export default function InvoiceAdjustmentListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canApprove = APPROVE_ROLES.includes(user?.role ?? '')

  const [filter, setFilter] = useState<AdjustmentLogFilter>({})
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const { data: logs = [], isLoading } = useQuery<InvoiceAdjustmentLog[]>({
    queryKey: ['billing-adjustment-logs', filter],
    queryFn: () => billingApi.listAdjustmentLogs(filter),
  })

  const approveMut = useMutation({
    mutationFn: ({ logId, approved, ghi_chu }: { logId: number; approved: boolean; ghi_chu?: string }) =>
      billingApi.approveAdjustment(logId, { approved, ghi_chu }),
    onSuccess: (_, vars) => {
      message.success(vars.approved ? 'Đã duyệt' : 'Đã từ chối')
      qc.invalidateQueries({ queryKey: ['billing-adjustment-logs'] })
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi xử lý'),
  })

  const handleApprove = (log: InvoiceAdjustmentLog) => {
    const after = log.du_lieu_sau ? JSON.parse(log.du_lieu_sau) : {}
    Modal.confirm({
      title: 'Duyệt yêu cầu điều chỉnh?',
      content: (
        <div>
          <p>Hóa đơn: <strong>#{log.invoice_id}</strong></p>
          <p>Tổng mới: <strong style={{ color: '#1677ff' }}>
            {Number(after.tong_cong ?? 0).toLocaleString('vi-VN')} đ
          </strong></p>
          <p style={{ marginTop: 8, color: '#888' }}>Thao tác này sẽ áp dụng ngay vào sổ công nợ.</p>
        </div>
      ),
      okText: 'Duyệt',
      onOk: () => approveMut.mutate({ logId: log.id, approved: true }),
    })
  }

  const handleReject = (log: InvoiceAdjustmentLog) => {
    let reason = ''
    Modal.confirm({
      title: 'Từ chối yêu cầu điều chỉnh?',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối..."
          onChange={e => { reason = e.target.value }}
        />
      ),
      okText: 'Từ chối',
      okButtonProps: { danger: true },
      onOk: () => approveMut.mutate({ logId: log.id, approved: false, ghi_chu: reason }),
    })
  }

  const printSelected = () => {
    selectedIds.forEach(id => {
      window.open(`/api/billing/adjustment-logs/${id}/print`, '_blank')
    })
  }

  const expandedRowRender = (record: InvoiceAdjustmentLog) => {
    const b = record.du_lieu_truoc ? JSON.parse(record.du_lieu_truoc) : {}
    const a = record.du_lieu_sau   ? JSON.parse(record.du_lieu_sau)   : {}
    const beforeItems: unknown[] = b.items ?? []
    type MergedItem = { item_id: number; ten_hang?: string; dvt?: string; so_luong: number; sl_moi?: number; don_gia?: number; thanh_tien: number; tt_moi?: number }
    const afterItems: MergedItem[] = a.items ?? []

    if (beforeItems.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>Không có dữ liệu chi tiết dòng hàng.</Text>

    const merged = (beforeItems as MergedItem[]).map((bi) => {
      const ai = afterItems.find((x) => x.item_id === bi.item_id) ?? bi
      return { ...bi, sl_moi: ai.so_luong, tt_moi: ai.thanh_tien }
    })

    return (
      <Table
        dataSource={merged}
        rowKey="item_id"
        size="small"
        pagination={false}
        style={{ marginLeft: 48, marginBottom: 8 }}
        columns={[
          { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
          { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
          {
            title: 'SL cũ',
            dataIndex: 'so_luong',
            width: 80,
            align: 'right',
            render: (v: number, row: MergedItem) => (
              <Text style={{ color: row.sl_moi !== v ? '#ff4d4f' : undefined }}>{v}</Text>
            ),
          },
          {
            title: 'SL mới',
            dataIndex: 'sl_moi',
            width: 80,
            align: 'right',
            render: (v: number, row: MergedItem) => (
              <Text strong style={{ color: v !== row.so_luong ? '#1677ff' : undefined }}>{v}</Text>
            ),
          },
          {
            title: 'Đơn giá',
            dataIndex: 'don_gia',
            width: 110,
            align: 'right',
            render: (v: number) => v.toLocaleString('vi-VN'),
          },
          {
            title: 'Tiền cũ',
            dataIndex: 'thanh_tien',
            width: 120,
            align: 'right',
            render: (v: number, row: MergedItem) => (
              <Text style={{ color: row.tt_moi !== v ? '#ff4d4f' : undefined }}>
                {v.toLocaleString('vi-VN')}
              </Text>
            ),
          },
          {
            title: 'Tiền mới',
            dataIndex: 'tt_moi',
            width: 120,
            align: 'right',
            render: (v: number, row: MergedItem) => (
              <Text strong style={{ color: v !== row.thanh_tien ? '#1677ff' : undefined }}>
                {v.toLocaleString('vi-VN')}
              </Text>
            ),
          },
        ]}
      />
    )
  }

  const columns: ColumnsType<InvoiceAdjustmentLog> = [
    {
      title: 'Hóa đơn',
      dataIndex: 'invoice_id',
      width: 130,
      render: (v: number) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          style={{ padding: 0 }}
          onClick={() => navigate(`/billing/invoices/${v}`)}
        >
          HĐ #{v}
        </Button>
      ),
    },
    {
      title: 'Ngày yêu cầu',
      dataIndex: 'adjusted_at',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      sorter: (a, b) => dayjs(a.adjusted_at).unix() - dayjs(b.adjusted_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Người yêu cầu',
      dataIndex: 'adjusted_by_name',
      width: 140,
      render: (v: string | null, r) => v ?? `User #${r.adjusted_by_id}`,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 100,
      render: (v: string) => {
        const m = LOAI_MAP[v]
        return <Tag color={m?.color}>{m?.label ?? v}</Tag>
      },
    },
    {
      title: 'Trước điều chỉnh',
      width: 150,
      align: 'right',
      render: (_: unknown, r: InvoiceAdjustmentLog) => {
        const b = r.du_lieu_truoc ? JSON.parse(r.du_lieu_truoc) : {}
        return (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Tiền hàng: {Number(b.tong_tien_hang ?? 0).toLocaleString('vi-VN')}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>VAT: {b.ty_le_vat ?? 0}%</Text>
            <Text strong style={{ fontSize: 12 }}>{Number(b.tong_cong ?? 0).toLocaleString('vi-VN')} đ</Text>
          </Space>
        )
      },
    },
    {
      title: 'Sau điều chỉnh',
      width: 150,
      align: 'right',
      render: (_: unknown, r: InvoiceAdjustmentLog) => {
        const a = r.du_lieu_sau ? JSON.parse(r.du_lieu_sau) : {}
        return (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Tiền hàng: {Number(a.tong_tien_hang ?? 0).toLocaleString('vi-VN')}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>VAT: {a.ty_le_vat ?? 0}%</Text>
            <Text strong style={{ color: '#1677ff', fontSize: 12 }}>{Number(a.tong_cong ?? 0).toLocaleString('vi-VN')} đ</Text>
          </Space>
        )
      },
    },
    {
      title: 'Chênh lệch',
      width: 120,
      align: 'right',
      render: (_: unknown, r: InvoiceAdjustmentLog) => {
        const b = r.du_lieu_truoc ? JSON.parse(r.du_lieu_truoc) : {}
        const a = r.du_lieu_sau  ? JSON.parse(r.du_lieu_sau)  : {}
        const diff = Number(a.tong_cong ?? 0) - Number(b.tong_cong ?? 0)
        return (
          <Text strong style={{ color: diff >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
            {diff >= 0 ? '+' : ''}{diff.toLocaleString('vi-VN')} đ
          </Text>
        )
      },
    },
    {
      title: 'Lý do',
      dataIndex: 'ghi_chu',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (v: string) => {
        const m = STATUS_MAP[v]
        return <Tag color={m?.color}>{m?.label ?? v}</Tag>
      },
    },
    {
      title: 'Người duyệt',
      dataIndex: 'approved_by_name',
      width: 130,
      render: (v: string | null, r) =>
        r.approved_by_name
          ? <Space direction="vertical" size={0}><Text>{r.approved_by_name}</Text><Text type="secondary" style={{ fontSize: 11 }}>{r.approved_at ? dayjs(r.approved_at).format('DD/MM/YYYY') : ''}</Text></Space>
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Thao tác',
      width: 150,
      fixed: 'right',
      render: (_: unknown, r: InvoiceAdjustmentLog) => (
        <Space size={4} wrap>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/api/billing/adjustment-logs/${r.id}/print`, '_blank')}
          />
          {r.trang_thai === 'pending' && canApprove && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={approveMut.isPending}
                onClick={() => handleApprove(r)}
              >
                Duyệt
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                loading={approveMut.isPending}
                onClick={() => handleReject(r)}
              >
                Từ chối
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('billing-invoice-adjustment', columns)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Danh sách yêu cầu điều chỉnh hóa đơn</Title>
        <Space>
          {selectedIds.length > 0 && (
            <Button icon={<PrinterOutlined />} onClick={printSelected}>
              In {selectedIds.length} phiếu
            </Button>
          )}
          {settingsButton}
        </Space>
      </div>

      {/* Bộ lọc */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} sm={8} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Trạng thái"
              allowClear
              value={filter.trang_thai}
              onChange={v => setFilter(f => ({ ...f, trang_thai: v }))}
              options={[
                { label: 'Chờ duyệt',  value: 'pending' },
                { label: 'Đã duyệt',   value: 'approved' },
                { label: 'Từ chối',    value: 'rejected' },
                { label: 'Đã áp dụng',value: 'na' },
              ]}
            />
          </Col>
          <Col xs={24} sm={16} md={9}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={dates => {
                if (dates) {
                  setFilter(f => ({
                    ...f,
                    tu_ngay:  dates[0]?.format('YYYY-MM-DD'),
                    den_ngay: dates[1]?.format('YYYY-MM-DD'),
                  }))
                } else {
                  setFilter(f => { const { tu_ngay, den_ngay, ...rest } = f; return rest })
                }
              }}
            />
          </Col>
          <Col xs={24} sm={24} md={4}>
            <Button onClick={() => setFilter({ trang_thai: 'pending' })}>Reset</Button>
          </Col>
        </Row>
      </Card>

      <Card size="small">
        <Table
          rowKey="id"
          columns={displayColumns}
          dataSource={logs}
          loading={isLoading}
          size="small"
          scroll={{ x: 1300 }}
          expandable={{ expandedRowRender }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: keys => setSelectedIds(keys as number[]),
          }}
          pagination={{ pageSize: 20, showTotal: t => `${t} yêu cầu` }}
          locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        />
      </Card>
    </div>
  )
}
