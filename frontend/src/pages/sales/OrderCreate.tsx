import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { productsApi } from '../../api/products'
import { salesOrdersApi } from '../../api/salesOrders'
import type { Product } from '../../api/products'

const { Title, Text } = Typography

interface OrderLine {
  key: string
  product_id: number
  product: Product
  so_luong: number
  don_gia: number
  ngay_giao_hang: string | null
  ghi_chu_san_pham: string | null
  yeu_cau_in: string | null
}

export default function OrderCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const { data: customers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then((r) => r.data),
  })

  const { data: products } = useQuery({
    queryKey: ['products', productSearch, selectedCustomerId],
    queryFn: () => productsApi.list({
      search: productSearch,
      ma_kh_id: selectedCustomerId || undefined,
      page_size: 50,
    }).then((r) => r.data.items),
    enabled: true,
  })

  const addLine = (product: Product) => {
    if (lines.find((l) => l.product_id === product.id)) {
      message.warning('Sản phẩm đã có trong đơn hàng')
      return
    }
    setLines((prev) => [...prev, {
      key: String(product.id),
      product_id: product.id,
      product,
      so_luong: 1,
      don_gia: Number(product.gia_ban) || 0,
      ngay_giao_hang: null,
      ghi_chu_san_pham: null,
      yeu_cau_in: null,
    }])
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const updateLine = (key: string, field: keyof OrderLine, value: unknown) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l))
  }

  const tongTien = lines.reduce((s, l) => s + l.so_luong * l.don_gia, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm')
        return
      }
      setSaving(true)
      const payload = {
        customer_id: values.customer_id,
        ngay_don: dayjs(values.ngay_don).format('YYYY-MM-DD'),
        ngay_giao_hang: values.ngay_giao_hang
          ? dayjs(values.ngay_giao_hang).format('YYYY-MM-DD')
          : undefined,
        dia_chi_giao: values.dia_chi_giao,
        ghi_chu: values.ghi_chu,
        items: lines.map((l) => ({
          product_id: l.product_id,
          so_luong: l.so_luong,
          don_gia: l.don_gia,
          ngay_giao_hang: l.ngay_giao_hang || undefined,
          ghi_chu_san_pham: l.ghi_chu_san_pham || undefined,
          yeu_cau_in: l.yeu_cau_in || undefined,
        })),
      }
      const res = await salesOrdersApi.create(payload)
      message.success(`Tạo đơn hàng ${res.data.so_don} thành công`)
      navigate(`/sales/orders/${res.data.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<OrderLine> = [
    {
      title: 'Mã SP',
      dataIndex: ['product', 'ma_amis'],
      width: 110,
      render: (v) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Tên hàng hoá',
      dataIndex: ['product', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'Kích thước',
      width: 110,
      render: (_, r) => r.product.dai
        ? `${r.product.dai}×${r.product.rong}×${r.product.cao}`
        : '—',
    },
    {
      title: 'Lớp',
      dataIndex: ['product', 'so_lop'],
      width: 50,
      align: 'center',
    },
    {
      title: 'Số lượng',
      width: 110,
      render: (_, r) => (
        <InputNumber
          min={1}
          value={r.so_luong}
          onChange={(v) => updateLine(r.key, 'so_luong', v || 1)}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: 'Đơn giá',
      width: 130,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.don_gia}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(r.key, 'don_gia', v || 0)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Text strong>{new Intl.NumberFormat('vi-VN').format(r.so_luong * r.don_gia)}</Text>
      ),
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: (_, r) => (
        <Input
          placeholder="Yêu cầu in, ghi chú..."
          value={r.ghi_chu_san_pham || ''}
          onChange={(e) => updateLine(r.key, 'ghi_chu_san_pham', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_, r) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(r.key)}
        />
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/orders')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>Tạo đơn hàng mới</Title>
      </Space>

      <Row gutter={16}>
        {/* Thông tin đơn hàng */}
        <Col xs={24} lg={16}>
          <Card title="Thông tin đơn hàng" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="customer_id"
                    label="Khách hàng"
                    rules={[{ required: true, message: 'Chọn khách hàng' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Tìm khách hàng..."
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      onChange={(v) => {
                        setSelectedCustomerId(v)
                        const kh = customers?.find((c) => c.id === v)
                        if (kh?.dia_chi_giao_hang) {
                          form.setFieldValue('dia_chi_giao', kh.dia_chi_giao_hang)
                        }
                      }}
                      options={customers?.map((c) => ({
                        value: c.id,
                        label: `[${c.ma_kh}] ${c.ten_viet_tat}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="ngay_don"
                    label="Ngày đơn"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="ngay_giao_hang" label="Ngày giao hàng">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="dia_chi_giao" label="Địa chỉ giao hàng">
                    <Input placeholder="Địa chỉ giao hàng..." />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="ghi_chu" label="Ghi chú đơn hàng">
                    <Input.TextArea rows={2} placeholder="Ghi chú..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Danh sách sản phẩm */}
          <Card title={`Chi tiết đơn hàng (${lines.length} dòng)`}>
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="key"
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="Chưa có sản phẩm. Chọn từ danh sách bên phải." /> }}
              summary={() => lines.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6} align="right">
                      <Text strong>Tổng tiền:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                        {new Intl.NumberFormat('vi-VN').format(tongTien)}đ
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null}
            />

            <Divider />
            <Row justify="end">
              <Col>
                <Space>
                  <Button onClick={() => navigate('/sales/orders')}>Huỷ</Button>
                  <Button type="primary" loading={saving} onClick={handleSubmit}>
                    Lưu đơn hàng
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Panel chọn sản phẩm */}
        <Col xs={24} lg={8}>
          <Card title="Chọn sản phẩm" style={{ position: 'sticky', top: 24 }}>
            <Input
              placeholder="Tìm sản phẩm..."
              prefix={<PlusOutlined />}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {products?.map((p) => (
                <Card
                  key={p.id}
                  size="small"
                  hoverable
                  onClick={() => addLine(p)}
                  style={{ marginBottom: 6, cursor: 'pointer' }}
                >
                  <Text strong style={{ fontSize: 12 }}>[{p.ma_amis}]</Text>
                  <br />
                  <Text style={{ fontSize: 12 }}>{p.ten_hang}</Text>
                  <br />
                  <Space size={4}>
                    {p.dai && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {p.dai}×{p.rong}×{p.cao}cm
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>{p.so_lop} lớp</Text>
                    <Text style={{ fontSize: 11, color: '#1677ff' }}>
                      {new Intl.NumberFormat('vi-VN').format(Number(p.gia_ban))}đ
                    </Text>
                  </Space>
                </Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
