import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Descriptions, Form, DatePicker, InputNumber, Input,
  Modal, Row, Select, Space, Spin, Table, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import {
  purchaseInvoiceApi, paymentApi, PurchaseInvoice,
  CashPaymentShort, TRANG_THAI_PO_INVOICE, HINH_THUC_TT,
} from '../../api/accounting'

const { Title, Text } = Typography

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showPayModal, setShowPayModal] = useState(false)
  const [form] = Form.useForm()

  const { data: invoice, isLoading } = useQuery<PurchaseInvoice>({
    queryKey: ['purchase-invoice', invId],
    queryFn: () => purchaseInvoiceApi.get(invId),
    enabled: !!invId,
  })

  const payMut = useMutation({
    mutationFn: (values: any) =>
      paymentApi.create({
        supplier_id: invoice!.supplier_id,
        purchase_invoice_id: invId,
        ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
        hinh_thuc_tt: values.hinh_thuc_tt,
        so_tai_khoan: values.so_tai_khoan || undefined,
        so_tham_chieu: values.so_tham_chieu || undefined,
        dien_giai: values.dien_giai || undefined,
        so_tien: values.so_tien,
      }),
    onSuccess: () => {
      message.success('Ghi nhận thanh toán thành công')
      setShowPayModal(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['purchase-invoice', invId] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi ghi nhận'),
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!invoice) return <div style={{ padding: 24 }}>Không tìm thấy hóa đơn</div>

  const status = TRANG_THAI_PO_INVOICE[invoice.trang_thai]
  const conLai = invoice.con_lai ?? 0
  const canPay = ['nhap', 'da_tt_mot_phan', 'qua_han'].includes(invoice.trang_thai)

  const paymentCols: ColumnsType<CashPaymentShort> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    {
      title: 'Ngày phiếu',
      dataIndex: 'ngay_phieu',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
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
      width: 140,
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: v => {
        const map: Record<string, { label: string; color: string }> = {
          cho_chot: { label: 'Chờ chốt',  color: 'default' },
          da_chot:  { label: 'Đã chốt',   color: 'orange' },
          da_duyet: { label: 'Đã duyệt',  color: 'green' },
          huy:      { label: 'Đã hủy',    color: 'default' },
        }
        const s = map[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/purchase-invoices')} />
          <Title level={4} style={{ margin: 0 }}>
            {invoice.so_hoa_don ?? `Hóa đơn mua #${invoice.id}`}
          </Title>
          <Tag color={status?.color}>{status?.label ?? invoice.trang_thai}</Tag>
        </Space>
        {canPay && (
          <Button
            type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setShowPayModal(true) }}
          >
            Ghi nhận thanh toán
          </Button>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số hóa đơn">{invoice.so_hoa_don ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày lập">
            {dayjs(invoice.ngay_lap).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Mẫu số">{invoice.mau_so ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ký hiệu">{invoice.ky_hieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Hạn thanh toán">
            {invoice.han_tt ? dayjs(invoice.han_tt).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Thuế suất">{invoice.thue_suat}%</Descriptions.Item>
          <Descriptions.Item label="Nhà cung cấp" span={2}>{invoice.ten_don_vi ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{invoice.ma_so_thue ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{invoice.ghi_chu ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text type="secondary">Tiền hàng</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tong_tien_hang)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tiền thuế ({invoice.thue_suat}%)</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tien_thue)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tổng thanh toán</Text>
            <div><Text strong style={{ fontSize: 18, color: '#1677ff' }}>{fmtVND(invoice.tong_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Đã thanh toán</Text>
            <div><Text strong style={{ fontSize: 16, color: '#52c41a' }}>{fmtVND(invoice.da_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Còn lại</Text>
            <div>
              <Text strong style={{ fontSize: 16, color: conLai > 0 ? '#f5222d' : '#52c41a' }}>
                {fmtVND(conLai)}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Phiếu chi đã ghi">
        <Table
          columns={paymentCols}
          dataSource={invoice.payments ?? []}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Chưa có phiếu chi' }}
        />
      </Card>

      <Modal
        title="Ghi nhận thanh toán NCC"
        open={showPayModal}
        onCancel={() => setShowPayModal(false)}
        onOk={() => form.submit()}
        okText="Ghi nhận"
        confirmLoading={payMut.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ ngay_phieu: dayjs(), hinh_thuc_tt: 'CK', so_tien: conLai }}
          onFinish={payMut.mutate}
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
          <Form.Item name="so_tham_chieu" label="Số tham chiếu">
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
