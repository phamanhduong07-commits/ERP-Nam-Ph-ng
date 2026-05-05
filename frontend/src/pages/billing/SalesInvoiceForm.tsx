import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { billingApi, SalesInvoiceCreate, HINH_THUC_TT } from '../../api/billing'
import { customersApi, Customer } from '../../api/customers'

const { Title } = Typography

const VAT_OPTIONS = [
  { value: 0,  label: '0%' },
  { value: 5,  label: '5%' },
  { value: 8,  label: '8%' },
  { value: 10, label: '10%' },
]

export default function SalesInvoiceForm() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: SalesInvoiceCreate) => billingApi.createInvoice(data),
    onSuccess: inv => {
      message.success('Đã tạo hóa đơn')
      navigate(`/billing/invoices/${inv.id}`)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi tạo hóa đơn'),
  })

  const handleCustomerChange = (customerId: number) => {
    const cust = customers.find(c => c.id === customerId)
    if (cust) {
      form.setFieldsValue({
        ten_don_vi: cust.ten_don_vi ?? '',
        dia_chi: cust.dia_chi ?? '',
        ma_so_thue: cust.ma_so_thue ?? '',
      })
    }
  }

  const handleTienHangChange = () => {
    const tienHang = form.getFieldValue('tong_tien_hang') ?? 0
    const tyLeVat = form.getFieldValue('ty_le_vat') ?? 10
    const tienVat = Math.round(tienHang * tyLeVat / 100)
    form.setFieldsValue({ tien_vat_display: fmtNum(tienVat), tong_cong_display: fmtNum(tienHang + tienVat) })
  }

  const fmtNum = (v: number) => v.toLocaleString('vi-VN')

  const onFinish = (values: any) => {
    const payload: SalesInvoiceCreate = {
      customer_id: values.customer_id,
      ngay_hoa_don: values.ngay_hoa_don.format('YYYY-MM-DD'),
      han_tt: values.han_tt?.format('YYYY-MM-DD'),
      mau_so: values.mau_so || undefined,
      ky_hieu: values.ky_hieu || undefined,
      ten_don_vi: values.ten_don_vi || undefined,
      dia_chi: values.dia_chi || undefined,
      ma_so_thue: values.ma_so_thue || undefined,
      nguoi_mua_hang: values.nguoi_mua_hang || undefined,
      hinh_thuc_tt: values.hinh_thuc_tt,
      tong_tien_hang: values.tong_tien_hang,
      ty_le_vat: values.ty_le_vat,
      ghi_chu: values.ghi_chu || undefined,
    }
    createMut.mutate(payload)
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/billing/invoices')} />
        <Title level={4} style={{ margin: 0 }}>Tạo hóa đơn bán hàng</Title>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ngay_hoa_don: dayjs(),
          hinh_thuc_tt: 'CK',
          ty_le_vat: 10,
        }}
        onFinish={onFinish}
        onValuesChange={(changed) => {
          if ('tong_tien_hang' in changed || 'ty_le_vat' in changed) {
            handleTienHangChange()
          }
        }}
      >
        <Card size="small" title="Thông tin hóa đơn" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="mau_so" label="Mẫu số">
                <Input placeholder="VD: 01GTKT0/001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ky_hieu" label="Ký hiệu">
                <Input placeholder="VD: AA/24E" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_hoa_don" label="Ngày hóa đơn" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="han_tt" label="Hạn thanh toán">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
                <Select options={Object.entries(HINH_THUC_TT).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card size="small" title="Thông tin khách hàng" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
                <Select
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map((c: any) => ({
                    value: c.id,
                    label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_kh ?? c.ten_don_vi ?? ''}`,
                  }))}
                  onChange={handleCustomerChange}
                  placeholder="Chọn khách hàng"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="ten_don_vi" label="Tên đơn vị (trên HĐ)">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="dia_chi" label="Địa chỉ">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ma_so_thue" label="Mã số thuế">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nguoi_mua_hang" label="Người mua hàng">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card size="small" title="Giá trị hóa đơn" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tong_tien_hang" label="Tiền hàng (chưa VAT)" rules={[{ required: true, type: 'number', min: 0 }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
                  parser={v => Number((v ?? '').replace(/\D/g, '')) as any}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ty_le_vat" label="Thuế suất VAT" rules={[{ required: true }]}>
                <Select options={VAT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tien_vat_display" label="Tiền VAT (tự tính)">
                <Input readOnly style={{ background: '#f5f5f5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tong_cong_display" label="Tổng cộng">
                <Input readOnly style={{ background: '#f5f5f5', fontWeight: 600, color: '#1677ff' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Card>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => navigate('/billing/invoices')}>Hủy</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={createMut.isPending}>
              Tạo hóa đơn
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
