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
import { paymentApi, CashPaymentCreate, HINH_THUC_TT, PurchaseInvoice } from '../../api/accounting'
import { suppliersApi, Supplier } from '../../api/suppliers'
import { purchaseInvoiceApi } from '../../api/accounting'

const { Title } = Typography

export default function CashPaymentForm() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [selectedSupplier, setSelectedSupplier] = useState<number | undefined>()
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | undefined>()

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['purchase-invoices-unpaid', selectedSupplier],
    queryFn: () =>
      purchaseInvoiceApi.list({ supplier_id: selectedSupplier, page_size: 100 }),
    enabled: !!selectedSupplier,
    select: (d: any) =>
      (d?.items ?? d ?? []).filter((i: PurchaseInvoice) =>
        ['nhap', 'da_tt_mot_phan', 'qua_han'].includes(i.trang_thai)
      ),
  })
  const unpaidInvoices: PurchaseInvoice[] = invoiceData ?? []

  const createMut = useMutation({
    mutationFn: (data: CashPaymentCreate) => paymentApi.create(data),
    onSuccess: r => {
      message.success('Tạo phiếu chi thành công')
      navigate(`/accounting/payments/${r.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo phiếu chi'),
  })

  const handleSupplierChange = (id: number) => {
    setSelectedSupplier(id)
    setSelectedInvoice(undefined)
    form.setFieldsValue({ purchase_invoice_id: undefined, so_tien: undefined })
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
      supplier_id: values.supplier_id,
      purchase_invoice_id: values.purchase_invoice_id,
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/payments')} />
        <Title level={4} style={{ margin: 0 }}>Tạo phiếu chi</Title>
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

          <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map(s => ({
                value: s.id,
                label: `${s.ma_ncc ? `[${s.ma_ncc}] ` : ''}${s.ten_don_vi ?? ''}`,
              }))}
              onChange={handleSupplierChange}
              placeholder="Chọn nhà cung cấp"
            />
          </Form.Item>

          {selectedSupplier && (
            <Form.Item name="purchase_invoice_id" label="Hóa đơn thanh toán">
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
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff1f0', borderRadius: 6, border: '1px solid #ffa39e' }}>
              <span style={{ fontSize: 13 }}>
                Tổng HĐ: <strong>{fmtVND(selectedInvoice.tong_thanh_toan)}</strong>
                {'  ·  '}Đã TT: <strong>{fmtVND(selectedInvoice.da_thanh_toan)}</strong>
                {'  ·  '}Còn lại: <strong style={{ color: '#f5222d' }}>{fmtVND(selectedInvoice.con_lai)}</strong>
              </span>
            </div>
          )}

          <Form.Item
            name="so_tien"
            label="Số tiền chi"
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
            <Button onClick={() => navigate('/accounting/payments')}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={createMut.isPending}>
              Tạo phiếu chi
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
