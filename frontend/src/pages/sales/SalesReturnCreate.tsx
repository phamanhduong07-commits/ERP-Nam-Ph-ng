import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty, Spin,
  Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { salesOrdersApi } from '../../api/salesOrders'
import { salesReturnsApi } from '../../api/salesReturns'
import { deliveriesApi } from '../../api/deliveries'
import { TINH_TRANG_HANG_LABELS } from '../../api/salesReturns'
import type { SalesOrder } from '../../api/salesOrders'

const { Title, Text } = Typography

interface ReturnLine {
  key: string
  sales_order_item_id: number
  sales_order_item: SalesOrder['items'][0]
  so_luong_tra: number
  don_gia_tra: number
  ly_do_tra: string
  tinh_trang_hang: string
  ghi_chu: string
}

export default function SalesReturnCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [lines, setLines] = useState<ReturnLine[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: orders } = useQuery({
    queryKey: ['sales-orders-approved'],
    queryFn: () => salesOrdersApi.list({
      trang_thai: 'da_duyet',
      page_size: 1000
    }).then(r => r.data.items),
  })

  const { data: selectedOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['sales-order', selectedOrderId],
    queryFn: () => selectedOrderId ? salesOrdersApi.get(selectedOrderId).then(r => r.data) : null,
    enabled: !!selectedOrderId,
  })

  const { data: deliveryOrders } = useQuery({
    queryKey: ['delivery-orders', selectedOrderId],
    queryFn: () => {
      if (!selectedOrderId) return []
      return deliveriesApi.getBySalesOrder(selectedOrderId).then(r => r.data)
    },
    enabled: !!selectedOrderId,
  })

  const addLine = (item: SalesOrder['items'][0]) => {
    if (lines.find((l) => l.sales_order_item_id === item.id)) {
      message.warning('Sản phẩm đã có trong phiếu trả')
      return
    }
    setLines((prev) => [...prev, {
      key: String(item.id),
      sales_order_item_id: item.id,
      sales_order_item: item,
      so_luong_tra: 1,
      don_gia_tra: item.don_gia,
      ly_do_tra: '',
      tinh_trang_hang: 'tot',
      ghi_chu: '',
    }])
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const updateLine = (key: string, field: keyof ReturnLine, value: unknown) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l))
  }

  const tongTienTra = lines.reduce((s, l) => s + l.so_luong_tra * l.don_gia_tra, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm trả lại')
        return
      }

      // Validate quantities
      for (const line of lines) {
        if (line.so_luong_tra > line.sales_order_item.so_luong) {
          message.error(`Số lượng trả của ${line.sales_order_item.ten_hang} không được vượt quá ${line.sales_order_item.so_luong}`)
          return
        }
      }

      setSaving(true)
      const payload = {
        sales_order_id: selectedOrderId!,
        delivery_order_id: values.delivery_order_id || undefined,
        customer_id: selectedOrder!.customer_id,
        ngay_tra: dayjs(values.ngay_tra).format('YYYY-MM-DD'),
        ly_do_tra: values.ly_do_tra,
        ghi_chu: values.ghi_chu,
        items: lines.map((l) => ({
          sales_order_item_id: l.sales_order_item_id,
          so_luong_tra: l.so_luong_tra,
          don_gia_tra: l.don_gia_tra,
          ly_do_tra: l.ly_do_tra || undefined,
          tinh_trang_hang: l.tinh_trang_hang,
          ghi_chu: l.ghi_chu || undefined,
        })),
      }
      const res = await salesReturnsApi.create(payload)
      message.success(`Tạo phiếu trả hàng ${res.data.so_phieu_tra} thành công`)
      navigate(`/sales/returns/${res.data.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<ReturnLine> = [
    {
      title: 'Tên hàng',
      dataIndex: ['sales_order_item', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'SL đã bán',
      width: 100,
      align: 'center',
      render: (_, r) => r.sales_order_item.so_luong,
    },
    {
      title: 'SL trả',
      width: 100,
      render: (_, r) => (
        <InputNumber
          min={1}
          max={r.sales_order_item.so_luong}
          value={r.so_luong_tra}
          onChange={(v) => updateLine(r.key, 'so_luong_tra', v || 1)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Đơn giá trả',
      width: 120,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.don_gia_tra}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(r.key, 'don_gia_tra', v || 0)}
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Text strong>{new Intl.NumberFormat('vi-VN').format(r.so_luong_tra * r.don_gia_tra)}</Text>
      ),
    },
    {
      title: 'Tình trạng',
      width: 120,
      render: (_, r) => (
        <Select
          value={r.tinh_trang_hang}
          onChange={(v) => updateLine(r.key, 'tinh_trang_hang', v)}
          style={{ width: 100 }}
        >
          {Object.entries(TINH_TRANG_HANG_LABELS).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v}</Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Lý do',
      width: 150,
      render: (_, r) => (
        <Input
          placeholder="Lý do trả..."
          value={r.ly_do_tra}
          onChange={(e) => updateLine(r.key, 'ly_do_tra', e.target.value)}
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/returns')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>Tạo phiếu trả hàng</Title>
      </Space>

      <Row gutter={16}>
        {/* Thông tin phiếu trả */}
        <Col xs={24} lg={16}>
          <Card title="Thông tin phiếu trả" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="sales_order_id"
                    label="Đơn hàng"
                    rules={[{ required: true, message: 'Chọn đơn hàng' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Chọn đơn hàng đã duyệt..."
                      optionFilterProp="children"
                      onChange={(v) => setSelectedOrderId(v)}
                      loading={!orders}
                    >
                      {orders?.map((order) => (
                        <Select.Option key={order.id} value={order.id}>
                          {order.so_don} - {order.ten_khach_hang} ({dayjs(order.ngay_don).format('DD/MM/YYYY')})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="ngay_tra"
                    label="Ngày trả"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="ly_do_tra"
                    label="Lý do trả"
                    rules={[{ required: true, message: 'Nhập lý do trả hàng' }]}
                  >
                    <Input placeholder="Lý do trả hàng..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="delivery_order_id" label="Phiếu xuất kho (tùy chọn)">
                    <Select
                      showSearch
                      placeholder="Chọn phiếu xuất kho cụ thể..."
                      optionFilterProp="children"
                      allowClear
                      disabled={!selectedOrderId}
                    >
                      {deliveryOrders?.map((delivery) => (
                        <Select.Option key={delivery.id} value={delivery.id}>
                          {delivery.so_phieu} - {dayjs(delivery.ngay_xuat).format('DD/MM/YYYY')}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="ghi_chu" label="Ghi chú">
                    <Input.TextArea rows={2} placeholder="Ghi chú..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Chi tiết trả hàng */}
          <Card title={`Chi tiết trả hàng (${lines.length} dòng)`}>
            {selectedOrder && (
              <Alert
                message={`Đơn hàng: ${selectedOrder.so_don} - Khách hàng: ${selectedOrder.customer?.ten_viet_tat}`}
                type="info"
                style={{ marginBottom: 16 }}
              />
            )}

            <Table
              columns={columns}
              dataSource={lines}
              rowKey="key"
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="Chưa có sản phẩm trả. Chọn từ danh sách bên phải." /> }}
              summary={() => lines.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      <Text strong>Tổng tiền trả:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                        {new Intl.NumberFormat('vi-VN').format(tongTienTra)}đ
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={4} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null}
            />

            <Divider />
            <Row justify="end">
              <Col>
                <Space>
                  <Button onClick={() => navigate('/sales/returns')}>Huỷ</Button>
                  <Button type="primary" loading={saving} onClick={handleSubmit}>
                    Lưu phiếu trả
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Panel chọn sản phẩm từ đơn hàng */}
        <Col xs={24} lg={8}>
          <Card title="Chọn sản phẩm từ đơn hàng" style={{ position: 'sticky', top: 24 }}>
            {selectedOrderId ? (
              orderLoading ? (
                <Spin />
              ) : selectedOrder ? (
                <div>
                  <Text strong>Sản phẩm trong đơn {selectedOrder.so_don}:</Text>
                  <div style={{ maxHeight: 500, overflowY: 'auto', marginTop: 8 }}>
                    {selectedOrder.items.map((item) => (
                      <Card
                        key={item.id}
                        size="small"
                        hoverable
                        onClick={() => addLine(item)}
                        style={{ marginBottom: 6, cursor: 'pointer' }}
                      >
                        <Text strong style={{ fontSize: 12 }}>{item.ten_hang}</Text>
                        <br />
                        <Space size={4}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            SL: {item.so_luong} | Giá: {new Intl.NumberFormat('vi-VN').format(item.don_gia)}đ
                          </Text>
                        </Space>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Empty description="Không tìm thấy đơn hàng" />
              )
            ) : (
              <Empty description="Chọn đơn hàng để xem sản phẩm" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}