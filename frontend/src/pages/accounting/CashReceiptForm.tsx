import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import { receiptApi, CashReceiptCreate, HINH_THUC_TT } from '../../api/accounting'
import { customersApi, Customer } from '../../api/customers'
import { billingApi, SalesInvoiceListItem } from '../../api/billing'

const { Title } = Typography

export default function CashReceiptForm() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [selectedCustomer, setSelectedCustomer] = useState<number | undefined>()
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoiceListItem | undefined>()

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  // Load hóa đơn còn nợ của KH được chọn
  const { data: invoiceData } = useQuery({
    queryKey: ['billing-invoices-unpaid', selectedCustomer],
    queryFn: () =>
      billingApi.listInvoices({ customer_id: selectedCustomer, page_size: 100 }),
    enabled: !!selectedCustomer,
    select: (d) =>
      (d?.items ?? []).filter((i: SalesInvoiceListItem) =>
        ['da_phat_hanh', 'da_tt_mot_phan', 'qua_han'].includes(i.trang_thai)
      ),
  })
  const unpaidInvoices: SalesInvoiceListItem[] = invoiceData ?? []

  const createMut = useMutation({
    mutationFn: (data: CashReceiptCreate) => receiptApi.create(data),
    onSuccess: r => {
      message.success('Tạo phiếu thu thành công')
      navigate(`/accounting/receipts/${r.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo phiếu thu'),
  })

  const handleCustomerChange = (id: number) => {
    setSelectedCustomer(id)
    setSelectedInvoice(undefined)
    form.setFieldsValue({ sales_invoice_id: undefined, so_tien: undefined })
  }

  const handleInvoiceChange = (invId: number) => {
    const inv = unpaidInvoices.find(i => i.id === invId)
    setSelectedInvoice(inv)
    if (inv) {
      form.setFieldsValue({ so_tien: inv.con_lai })
    }
  }

  const onFinish = (values: any) => {
    createMut.mutate({
      customer_id: values.customer_id,
      sales_invoice_id: values.sales_invoice_id,
      ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
      hinh_thuc_tt: values.hinh_thuc_tt,
      so_tai_khoan: values.so_tai_khoan || undefined,
      so_tham_chieu: values.so_tham_chieu || undefined,
      dien_giai: values.dien_giai || undefined,
      so_tien: values.so_tien,
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/receipts')} />
        <Title level={4} style={{ margin: 0 }}>Tạo phiếu thu</Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ ngay_phieu: dayjs(), hinh_thuc_tt: 'CK' }}
        onFinish={onFinish}
      >
        <Card size="small" title="Thông tin" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
                <Select options={Object.entries(HINH_THUC_TT).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.id,
                label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_don_vi ?? ''}`,
              }))}
              onChange={handleCustomerChange}
              placeholder="Chọn khách hàng"
            />
          </Form.Item>

          {selectedCustomer && (
            <Form.Item name="sales_invoice_id" label="Hóa đơn thu tiền">
              <Select
                allowClear
                placeholder={unpaidInvoices.length === 0 ? 'Không có hóa đơn còn nợ' : 'Chọn hóa đơn (tùy chọn)'}
                onChange={handleInvoiceChange}
                options={unpaidInvoices.map(i => ({
                  value: i.id,
                  label: `${i.so_hoa_don ?? `HĐ#${i.id}`} — Còn lại: ${fmtVND(i.con_lai)}`,
                }))}
              />
            </Form.Item>
          )}

          {selectedInvoice && (
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
              <span style={{ fontSize: 13 }}>
                Tổng HĐ: <strong>{fmtVND(selectedInvoice.tong_cong)}</strong>
                {'  ·  '}Đã TT: <strong>{fmtVND(selectedInvoice.da_thanh_toan)}</strong>
                {'  ·  '}Còn lại: <strong style={{ color: '#fa8c16' }}>{fmtVND(selectedInvoice.con_lai)}</strong>
              </span>
            </div>
          )}

          <Form.Item
            name="so_tien"
            label="Số tiền thu"
            rules={[
              { required: true },
              {
                validator: (_, val) => {
                  if (selectedInvoice && val > selectedInvoice.con_lai) {
                    return Promise.reject(`Vượt quá số tiền còn lại (${fmtVND(selectedInvoice.con_lai)})`)
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
              parser={v => Number((v ?? '').replace(/\D/g, '')) as any}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="so_tai_khoan" label="Số tài khoản">
                <Input placeholder="Số TK ngân hàng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_tham_chieu" label="Số tham chiếu">
                <Input placeholder="Số chứng từ CK" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dien_giai" label="Diễn giải">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate('/accounting/receipts')}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={createMut.isPending}>
              Tạo phiếu thu
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
