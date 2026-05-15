import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty, Spin,
  Alert,
} from 'antd'
import { DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesReturnsApi } from '../../api/salesReturns'
import { deliveriesApi } from '../../api/deliveries'
import { salesOrdersApi } from '../../api/salesOrders'
import { TINH_TRANG_HANG_LABELS } from '../../api/salesReturns'
import type { DeliveryOrder, DeliveryOrderItem } from '../../api/deliveries'

const { Title, Text } = Typography

interface ReturnLine {
  key: string
  delivery_order: DeliveryOrder
  sales_order_item_id: number | null
  delivery_item: DeliveryOrderItem
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
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<number | null>(null)
  const [selectedSalesOrderNo, setSelectedSalesOrderNo] = useState<string | null>(null)
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [searchSO, setSearchSO] = useState('')
  const { data: salesOrders, isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['sales-orders-for-return', searchSO],
    queryFn: () => salesOrdersApi.list({
      search: searchSO || undefined,
      page_size: 50,
    }).then(r => r.data.items),
  })

  const [searchDO, setSearchDO] = useState('')
  const { data: deliveryOrders, isLoading: deliveryOrdersLoading } = useQuery({
    queryKey: ['delivery-orders-for-return-v2', selectedSalesOrderId, selectedSalesOrderNo, searchDO],
    queryFn: () => deliveriesApi.list({
      sales_order_id: selectedSalesOrderId || undefined,
      so_don: selectedSalesOrderNo || undefined,
      so_phieu: searchDO || undefined,
    }).then(r => r.data),
    enabled: !!selectedSalesOrderId,
  })

  const deliveryOrderIds = (deliveryOrders || []).map((delivery) => delivery.id).join(',')
  const { data: deliveryDetails, isLoading: deliveryLoading } = useQuery({
    queryKey: ['delivery-order-details-for-return', deliveryOrderIds],
    queryFn: () => Promise.all((deliveryOrders || []).map((delivery) => deliveriesApi.get(delivery.id).then(r => r.data))),
    enabled: !!selectedSalesOrderId && !!deliveryOrders?.length,
  })

  const deliveryList = deliveryDetails || deliveryOrders || []
  const visibleDeliveries = selectedDeliveryId
    ? deliveryList.filter((delivery) => delivery.id === selectedDeliveryId)
    : deliveryList

  const handleSelectDelivery = (deliveryId: number) => {
    setSelectedDeliveryId(deliveryId)
  }

  const handleSelectSalesOrder = (salesOrderId: number) => {
    const selectedOrder = salesOrders?.find((order) => order.id === salesOrderId)
    setSelectedSalesOrderId(salesOrderId)
    setSelectedSalesOrderNo(selectedOrder?.so_don || null)
    setSelectedDeliveryId(null)
    setSearchDO('')
    setLines([])
    form.setFieldsValue({ delivery_order_id: undefined })
  }

  const addLine = (delivery: DeliveryOrder, item: DeliveryOrderItem) => {
    if (!item.sales_order_item_id && !item.production_order_id) {
      message.warning('Dòng giao hàng này chưa gắn với đơn hàng bán hoặc lệnh sản xuất')
      return
    }
    if (lines.some((line) => line.delivery_order.id === delivery.id && line.delivery_item.id === item.id)) {
      message.warning('Dòng giao hàng này đã có trong phiếu trả')
      return
    }
    const maxTra = item.so_luong_con_lai ?? item.so_luong
    if (maxTra <= 0) {
      message.warning('Sản phẩm này đã được trả hết')
      return
    }

    setLines((prev) => [...prev, {
      key: `${delivery.id}-${item.id}`,
      delivery_order: delivery,
      sales_order_item_id: item.sales_order_item_id,
      delivery_item: item,
      so_luong_tra: maxTra,
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
      if (!selectedSalesOrderId) {
        message.error('Vui lòng chọn phiếu bán hàng')
        return
      }
      if (lines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 mã hàng / lệnh sản xuất trả lại')
        return
      }

      for (const line of lines) {
        const maxTra = line.delivery_item.so_luong_con_lai ?? line.delivery_item.so_luong
        if (line.so_luong_tra > maxTra) {
          message.error(`Số lượng trả của ${line.delivery_item.ten_hang} không được vượt quá số lượng còn lại (${maxTra})`)
          return
        }
      }

      setSaving(true)
      const linesByDelivery = lines.reduce((groups, line) => {
        const deliveryId = line.delivery_order.id
        const group = groups.get(deliveryId) || []
        group.push(line)
        groups.set(deliveryId, group)
        return groups
      }, new Map<number, ReturnLine[]>())

      const createdReturns = []
      for (const groupLines of linesByDelivery.values()) {
        const delivery = groupLines[0].delivery_order
      const payload = {
        sales_order_id: delivery.sales_order_id || selectedSalesOrderId,
        delivery_order_id: delivery.id,
        customer_id: delivery.customer_id,
        ngay_tra: dayjs(values.ngay_tra).format('YYYY-MM-DD'),
        ly_do_tra: values.ly_do_tra,
        ghi_chu: values.ghi_chu,
        items: groupLines.map((l) => ({
          delivery_order_item_id: l.delivery_item.id,
            sales_order_item_id: l.sales_order_item_id || undefined,
          so_luong_tra: l.so_luong_tra,
          don_gia_tra: l.don_gia_tra,
          ly_do_tra: l.ly_do_tra || undefined,
          tinh_trang_hang: l.tinh_trang_hang,
          ghi_chu: l.ghi_chu || undefined,
        })),
      }
        const res = await salesReturnsApi.create(payload)
        createdReturns.push(res.data)
      }
      if (createdReturns.length === 1 && createdReturns[0]?.id) {
        message.success(`Tạo phiếu trả hàng ${createdReturns[0].so_phieu_tra} thành công`)
        navigate(`/sales/returns/${createdReturns[0].id}`)
      } else {
        message.success(`Tạo ${createdReturns.length} phiếu trả hàng thành công`)
        navigate('/sales/returns')
      }
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
      dataIndex: ['delivery_item', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'LSX',
      width: 110,
      render: (_, r) => r.delivery_item.so_lenh || r.delivery_item.production_order_id || '-',
    },
    {
      title: 'Phiếu giao',
      width: 130,
      render: (_, r) => r.delivery_order.so_phieu,
    },
    {
      title: 'SL đã giao',
      width: 100,
      align: 'center',
      render: (_, r) => r.delivery_item.so_luong,
    },
    {
      title: 'SL có thể trả',
      width: 110,
      align: 'center',
      render: (_, r) => <Text type="danger" strong>{r.delivery_item.so_luong_con_lai ?? r.delivery_item.so_luong}</Text>,
    },
    {
      title: 'SL trả',
      width: 100,
      render: (_, r) => (
        <InputNumber
          min={1}
          max={r.delivery_item.so_luong_con_lai ?? r.delivery_item.so_luong}
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
        <Col xs={24} lg={16}>
          <Card title="Thông tin phiếu trả" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={10}>
                  <Form.Item
                    name="sales_order_id"
                    label="Phiếu bán hàng"
                    rules={[{ required: true, message: 'Chọn phiếu bán hàng' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Tìm theo số đơn, khách hàng..."
                      optionFilterProp="children"
                      filterOption={false}
                      onSearch={(val) => setSearchSO(val)}
                      onChange={handleSelectSalesOrder}
                      loading={salesOrdersLoading}
                      allowClear
                      onClear={() => {
                        setSelectedSalesOrderId(null)
                        setSelectedSalesOrderNo(null)
                        setSelectedDeliveryId(null)
                        setLines([])
                        form.setFieldsValue({ delivery_order_id: undefined })
                      }}
                    >
                      {salesOrders?.map((order) => (
                        <Select.Option key={order.id} value={order.id}>
                          {order.so_don} - {order.ten_khach_hang || ''} ({dayjs(order.ngay_don).format('DD/MM/YYYY')})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="delivery_order_id"
                    label="Lọc phiếu giao hàng"
                  >
                    <Select
                      showSearch
                      placeholder="Tìm theo số phiếu (ví dụ: DO-2026...)"
                      optionFilterProp="children"
                      filterOption={false}
                      onSearch={(val) => setSearchDO(val)}
                      onChange={handleSelectDelivery}
                      loading={deliveryOrdersLoading}
                      disabled={!selectedSalesOrderId}
                      allowClear
                      onClear={() => setSelectedDeliveryId(null)}
                      notFoundContent={null}
                    >
                      {deliveryOrders?.filter((delivery) => delivery.sales_order_id).map((delivery) => (
                        <Select.Option key={delivery.id} value={delivery.id}>
                          {delivery.so_phieu} - {delivery.so_don || 'Chưa có số đơn'} - {delivery.ten_khach || ''} ({dayjs(delivery.ngay_xuat).format('DD/MM/YYYY')})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item
                    name="ngay_tra"
                    label="Ngày trả"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item
                    name="ly_do_tra"
                    label="Lý do trả"
                    rules={[{ required: true, message: 'Nhập lý do trả hàng' }]}
                  >
                    <Input placeholder="Lý do trả hàng..." />
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

          <Card title={`Chi tiết trả hàng (${lines.length} dòng)`}>
            {selectedSalesOrderId && (
              <Alert
                message={`Đang chọn ${lines.length} dòng trả từ ${new Set(lines.map((line) => line.delivery_order.id)).size} phiếu giao hàng`}
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
                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                      <Text strong>Tổng tiền trả:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                        {new Intl.NumberFormat('vi-VN').format(tongTienTra)}đ
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={3} />
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

        <Col xs={24} lg={8}>
          <Card title="Chọn mã hàng / lệnh sản xuất đã giao" style={{ position: 'sticky', top: 24 }}>
            {!selectedSalesOrderId ? (
              <Empty description="Chọn phiếu bán hàng để xem các mã hàng đã giao" />
            ) : deliveryOrdersLoading || deliveryLoading ? (
              <Spin />
            ) : visibleDeliveries.length === 0 ? (
              <Empty description="Đơn bán này chưa có phiếu giao hàng" />
            ) : (
              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {visibleDeliveries.map((delivery) => (
                  <div key={delivery.id} style={{ marginBottom: 12 }}>
                    <Text strong>{delivery.so_phieu}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {delivery.so_don || ''} - {delivery.ten_khach || ''} - {dayjs(delivery.ngay_xuat).format('DD/MM/YYYY')}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      {delivery.items.map((item) => (
                        <Card
                          key={`${delivery.id}-${item.id}`}
                          size="small"
                          hoverable={!!item.sales_order_item_id || !!item.production_order_id}
                          onClick={() => addLine(delivery, item)}
                          style={{
                            marginBottom: 6,
                            cursor: item.sales_order_item_id || item.production_order_id ? 'pointer' : 'not-allowed',
                            opacity: item.sales_order_item_id || item.production_order_id ? 1 : 0.55,
                          }}
                        >
                          <Text strong style={{ fontSize: 12 }}>{item.ten_hang}</Text>
                          <br />
                          <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              LSX: {item.so_lenh || item.production_order_id || '-'} | Đã giao: {item.so_luong} {item.dvt}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Giá: {new Intl.NumberFormat('vi-VN').format(item.don_gia)}đ
                            </Text>
                            <Text type="danger" style={{ fontSize: 11, fontWeight: 'bold' }}>
                              Còn có thể trả: {item.so_luong_con_lai ?? item.so_luong} {item.dvt}
                            </Text>
                          </Space>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
