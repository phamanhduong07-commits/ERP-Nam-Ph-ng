import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal,
  Row, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, PlusOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import {
  billingApi, SalesInvoice, CashReceiptShort,
  TRANG_THAI_INVOICE, HINH_THUC_TT,
} from '../../api/billing'
import { receiptApi } from '../../api/accounting'

const { Title, Text } = Typography

export default function SalesInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [form] = Form.useForm()

  const { data: invoice, isLoading } = useQuery<SalesInvoice>({
    queryKey: ['billing-invoice', invoiceId],
    queryFn: () => billingApi.getInvoice(invoiceId),
    enabled: !!invoiceId,
  })

  const issueMut = useMutation({
    mutationFn: () => billingApi.issueInvoice(invoiceId),
    onSuccess: () => {
      message.success('Đã phát hành hóa đơn')
      qc.invalidateQueries({ queryKey: ['billing-invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi phát hành'),
  })

  const cancelMut = useMutation({
    mutationFn: () => billingApi.cancelInvoice(invoiceId),
    onSuccess: () => {
      message.success('Đã hủy hóa đơn')
      qc.invalidateQueries({ queryKey: ['billing-invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  const receiptMut = useMutation({
    mutationFn: (values: any) =>
      receiptApi.create({
        customer_id: invoice!.customer_id,
        sales_invoice_id: invoiceId,
        ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
        hinh_thuc_tt: values.hinh_thuc_tt,
        so_tai_khoan: values.so_tai_khoan,
        so_tham_chieu: values.so_tham_chieu,
        dien_giai: values.dien_giai,
        so_tien: values.so_tien,
      }),
    onSuccess: () => {
      message.success('Ghi nhận thanh toán thành công')
      setShowReceiptModal(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['billing-invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['billing-invoices'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi ghi nhận'),
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!invoice) return <div style={{ padding: 24 }}>Không tìm thấy hóa đơn</div>

  const status = TRANG_THAI_INVOICE[invoice.trang_thai]
  const canIssue = invoice.trang_thai === 'nhap'
  const canCancel = ['nhap', 'da_phat_hanh'].includes(invoice.trang_thai)
  const canReceipt = ['da_phat_hanh', 'da_tt_mot_phan', 'qua_han'].includes(invoice.trang_thai)
  const conLai = invoice.con_lai ?? 0

  const receiptCols: ColumnsType<CashReceiptShort> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    {
      title: 'Ngày phiếu',
      dataIndex: 'ngay_phieu',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Hình thức TT',
      dataIndex: 'hinh_thuc_tt',
      width: 120,
      render: v => HINH_THUC_TT[v] ?? v,
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      align: 'right',
      width: 140,
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const map: Record<string, { label: string; color: string }> = {
          cho_duyet: { label: 'Chờ duyệt', color: 'orange' },
          da_duyet:  { label: 'Đã duyệt',  color: 'green' },
          huy:       { label: 'Đã hủy',    color: 'default' },
        }
        const s = map[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/billing/invoices')} />
          <Title level={4} style={{ margin: 0 }}>
            {invoice.so_hoa_don ?? `Hóa đơn #${invoice.id}`}
          </Title>
          <Tag color={status?.color}>{status?.label ?? invoice.trang_thai}</Tag>
        </Space>
        <Space>
          {canReceipt && (
            <Button
              type="primary" icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setShowReceiptModal(true) }}
            >
              Ghi nhận thanh toán
            </Button>
          )}
          {canIssue && (
            <Button
              type="primary" icon={<CheckOutlined />}
              loading={issueMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Phát hành hóa đơn?',
                content: 'Hóa đơn sau khi phát hành không thể sửa.',
                onOk: () => issueMut.mutate(),
              })}
            >
              Phát hành HĐ
            </Button>
          )}
          {canCancel && (
            <Button
              danger icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy hóa đơn?',
                content: 'Thao tác này không thể hoàn tác.',
                okType: 'danger',
                onOk: () => cancelMut.mutate(),
              })}
            >
              Hủy HĐ
            </Button>
          )}
          <Button
            icon={<PrinterOutlined />}
            onClick={() => window.open(`/api/billing/invoices/${invoiceId}/print`, '_blank')}
          >
            In hóa đơn
          </Button>
        </Space>
      </div>

      {/* Thông tin hóa đơn */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số hóa đơn">{invoice.so_hoa_don ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày hóa đơn">
            {dayjs(invoice.ngay_hoa_don).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Mẫu số">{invoice.mau_so ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ký hiệu">{invoice.ky_hieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Hạn thanh toán">
            {invoice.han_tt ? dayjs(invoice.han_tt).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">
            {HINH_THUC_TT[invoice.hinh_thuc_tt] ?? invoice.hinh_thuc_tt}
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng" span={2}>
            {invoice.ten_don_vi ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Địa chỉ" span={2}>
            {invoice.dia_chi ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{invoice.ma_so_thue ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Người mua hàng">{invoice.nguoi_mua_hang ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú" span={2}>{invoice.ghi_chu ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tổng tiền */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text type="secondary">Tiền hàng</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tong_tien_hang)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">VAT ({invoice.ty_le_vat}%)</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tien_vat)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tổng cộng</Text>
            <div><Text strong style={{ fontSize: 18, color: '#1677ff' }}>{fmtVND(invoice.tong_cong)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Đã thanh toán</Text>
            <div><Text strong style={{ fontSize: 16, color: '#52c41a' }}>{fmtVND(invoice.da_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Còn lại</Text>
            <div>
              <Text strong style={{ fontSize: 16, color: conLai > 0 ? '#fa8c16' : '#52c41a' }}>
                {fmtVND(conLai)}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Lịch sử phiếu thu */}
      <Card size="small" title="Phiếu thu đã ghi">
        <Table
          columns={receiptCols}
          dataSource={invoice.receipts ?? []}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Chưa có phiếu thu' }}
        />
      </Card>

      {/* Modal ghi nhận thanh toán */}
      <Modal
        title="Ghi nhận thanh toán"
        open={showReceiptModal}
        onCancel={() => setShowReceiptModal(false)}
        onOk={() => form.submit()}
        okText="Ghi nhận"
        confirmLoading={receiptMut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ngay_phieu: dayjs(),
            hinh_thuc_tt: 'CK',
            so_tien: conLai,
          }}
          onFinish={receiptMut.mutate}
        >
          <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
            <Select options={Object.entries(HINH_THUC_TT).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="so_tien" label="Số tiền" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={conLai}
              formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
              parser={v => Number((v ?? '').replace(/\D/g, '')) as any}
            />
          </Form.Item>
          <Form.Item name="so_tham_chieu" label="Số tham chiếu (số CK)">
            <Input />
          </Form.Item>
          <Form.Item name="dien_giai" label="Diễn giải">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
