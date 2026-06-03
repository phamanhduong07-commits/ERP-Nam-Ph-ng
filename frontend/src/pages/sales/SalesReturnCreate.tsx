import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty, Spin,
  Alert, Tag,
} from 'antd'
import { DeleteOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesReturnsApi } from '../../api/salesReturns'
import { deliveriesApi } from '../../api/deliveries'
import { salesOrdersApi } from '../../api/salesOrders'
import { customersApi } from '../../api/customers'
import { TINH_TRANG_HANG_LABELS } from '../../api/salesReturns'
import type { DeliveryOrder, DeliveryOrderItem } from '../../api/deliveries'
import type { SalesOrderListItem } from '../../api/salesOrders'
import EmptyState from "../../components/EmptyState"

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
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSOOption, setAutoSOOption] = useState<SalesOrderListItem | null>(null)
  const [pbhValue, setPbhValue] = useState<number | null>(null)

  const [searchKH, setSearchKH] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-for-return', searchKH],
    queryFn: () => customersApi.list({ search: searchKH || undefined, page_size: 50 }).then(r => r.data.items),
  })

  const [searchSO, setSearchSO] = useState('')
  const { data: salesOrders, isLoading: salesOrdersLoading } = useQuery({
    queryKey: ['sales-orders-for-return', searchSO, selectedCustomerId],
    queryFn: () => salesOrdersApi.list({
      search: searchSO || undefined,
      customer_id: selectedCustomerId || undefined,
      page_size: 50,
    }).then(r => r.data.items),
  })

  const [searchPBH, setSearchPBH] = useState('')
  const { data: pbhResults, isLoading: pbhLoading } = useQuery({
    queryKey: ['pbh-search-for-return', searchPBH],
    queryFn: () => deliveriesApi.list({ so_phieu: searchPBH }).then(r => r.data),
    enabled: searchPBH.length >= 2,
  })

  const { data: deliveryOrders, isLoading: deliveryOrdersLoading } = useQuery({
    queryKey: ['delivery-orders-for-return-v2', selectedSalesOrderId],
    queryFn: () => deliveriesApi.list({
      sales_order_id: selectedSalesOrderId || undefined,
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

  const handleSelectCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId)
    setSelectedSalesOrderId(null)
    setSelectedDeliveryId(null)
    setPbhValue(null)
    setAutoSOOption(null)
    setLines([])
    form.setFieldsValue({ sales_order_id: undefined })
  }

const handleSelectSalesOrder = (salesOrderId: number) => {
    setSelectedSalesOrderId(salesOrderId)
    setSelectedDeliveryId(null)
    setPbhValue(null)
    setAutoSOOption(null)
    setLines([])
  }

  const handleSelectPBH = (deliveryId: number) => {
    const delivery = pbhResults?.find(d => d.id === deliveryId)
    if (!delivery) return
    setPbhValue(deliveryId)
    setSelectedDeliveryId(deliveryId)
    if (delivery.sales_order_id) {
      const soId = delivery.sales_order_id
      setAutoSOOption({
        id: soId,
        so_don: delivery.so_don || '',
        ten_khach_hang: delivery.ten_khach,
        ngay_don: delivery.ngay_xuat,
        customer_id: delivery.customer_id,
        so_po_kh: null, phap_nhan_id: null, ten_phap_nhan: null,
        trang_thai: '', ngay_giao_hang: null, tong_tien: 0,
        tong_tien_sau_giam: 0, so_dong: 0, created_by_name: null, created_at: '',
      })
      setSelectedSalesOrderId(soId)
      form.setFieldsValue({ sales_order_id: soId })
      setLines([])
    }
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

  const handleAddAll = (delivery: DeliveryOrder) => {
    const items = delivery.items ?? []
    const newLines: ReturnLine[] = []
    items.forEach((item) => {
      if (!item.sales_order_item_id && !item.production_order_id) return
      const key = `${delivery.id}-${item.id}`
      if (lines.some((l) => l.key === key)) return
      const maxTra = item.so_luong_con_lai ?? item.so_luong
      if (maxTra <= 0) return
      newLines.push({
        key,
        delivery_order: delivery,
        sales_order_item_id: item.sales_order_item_id,
        delivery_item: item,
        so_luong_tra: maxTra,
        don_gia_tra: item.don_gia,
        ly_do_tra: '',
        tinh_trang_hang: 'tot',
        ghi_chu: '',
      })
    })
    if (newLines.length > 0) {
      setLines((prev) => [...prev, ...newLines])
    }
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
                <Col xs={24} md={4}>
                  <Form.Item label="Khách hàng">
                    <Select
                      showSearch
                      placeholder="Tìm khách hàng..."
                      optionFilterProp="children"
                      filterOption={false}
                      onSearch={(val) => setSearchKH(val)}
                      onChange={handleSelectCustomer}
                      loading={customersLoading}
                      allowClear
                      onClear={() => {
                        setSelectedCustomerId(null)
                        setSelectedSalesOrderId(null)
                        setSelectedDeliveryId(null)
                        setLines([])
                        form.setFieldsValue({ sales_order_id: undefined })
                      }}
                    >
                      {customers?.map((c) => (
                        <Select.Option key={c.id} value={c.id}>
                          {c.ten_viet_tat}{c.ten_don_vi ? ` — ${c.ten_don_vi}` : ''}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item label="Phiếu bán hàng">
                    <Select
                      showSearch
                      value={pbhValue || undefined}
                      placeholder="Tìm số phiếu..."
                      filterOption={false}
                      onSearch={(val) => setSearchPBH(val)}
                      onChange={handleSelectPBH}
                      loading={pbhLoading}
                      allowClear
                      onClear={() => {
                        setPbhValue(null)
                        setSelectedDeliveryId(null)
                      }}
                      notFoundContent={searchPBH.length >= 2 ? 'Không tìm thấy' : 'Nhập ít nhất 2 ký tự'}
                    >
                      {pbhResults?.map((d) => (
                        <Select.Option key={d.id} value={d.id}>
                          {d.so_phieu} — {d.ten_khach || ''} ({dayjs(d.ngay_xuat).format('DD/MM/YYYY')})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item
                    name="sales_order_id"
                    label="Đơn bán hàng"
                    rules={[{ required: true, message: 'Chọn đơn bán hàng' }]}
                  >
                    <Select
                      showSearch
                      placeholder="Tìm theo số đơn..."
                      optionFilterProp="children"
                      filterOption={false}
                      onSearch={(val) => setSearchSO(val)}
                      onChange={handleSelectSalesOrder}
                      loading={salesOrdersLoading}
                      allowClear
                      onClear={() => {
                        setSelectedSalesOrderId(null)
                        setSelectedDeliveryId(null)
                        setPbhValue(null)
                        setAutoSOOption(null)
                        setLines([])
                      }}
                    >
                      {autoSOOption && !salesOrders?.some(o => o.id === autoSOOption.id) && (
                        <Select.Option key={autoSOOption.id} value={autoSOOption.id}>
                          {autoSOOption.so_don} — {autoSOOption.ten_khach_hang || ''} ({dayjs(autoSOOption.ngay_don).format('DD/MM/YYYY')})
                        </Select.Option>
                      )}
                      {salesOrders?.map((order) => (
                        <Select.Option key={order.id} value={order.id}>
                          {order.so_don} — {order.ten_khach_hang || ''} ({dayjs(order.ngay_don).format('DD/MM/YYYY')})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item
                    name="ngay_tra"
                    label="Ngày trả"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={18}>
                  <Form.Item
                    name="ly_do_tra"
                    label="Lý do trả"
                    rules={[{ required: true, message: 'Nhập lý do' }]}
                  >
                    <Input placeholder="Lý do trả hàng..." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="ghi_chu" label="Ghi chú">
                    <Input.TextArea rows={1} placeholder="Ghi chú thêm..." />
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
          <Card
            title="Chọn mã hàng / lệnh sản xuất đã giao"
            style={{ position: 'sticky', top: 24 }}
            extra={lines.length > 0 ? (
              <Tag color="blue">{lines.length} mã đã thêm</Tag>
            ) : undefined}
          >
            {!selectedSalesOrderId ? (
              <Empty description="Chọn phiếu bán hàng để xem các mã hàng đã giao" />
            ) : deliveryOrdersLoading || deliveryLoading ? (
              <Spin />
            ) : visibleDeliveries.length === 0 ? (
              <Empty description="Đơn bán này chưa có phiếu giao hàng" />
            ) : (
              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {visibleDeliveries.map((delivery) => {
                  const addableCount = delivery.items.filter((item) =>
                    (item.sales_order_item_id || item.production_order_id) &&
                    (item.so_luong_con_lai ?? item.so_luong) > 0 &&
                    !lines.some((l) => l.key === `${delivery.id}-${item.id}`)
                  ).length

                  return (
                    <div key={delivery.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <Text strong>{delivery.so_phieu}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {delivery.so_don || ''} - {delivery.ten_khach || ''} - {dayjs(delivery.ngay_xuat).format('DD/MM/YYYY')}
                          </Text>
                        </div>
                        {addableCount > 0 && (
                          <Button size="small" type="dashed" onClick={() => handleAddAll(delivery)}>
                            Thêm tất cả ({addableCount})
                          </Button>
                        )}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {delivery.items.map((item) => {
                          const itemKey = `${delivery.id}-${item.id}`
                          const isAdded = lines.some((l) => l.key === itemKey)
                          const canAdd = !!(item.sales_order_item_id || item.production_order_id) && (item.so_luong_con_lai ?? item.so_luong) > 0

                          return (
                            <Card
                              key={itemKey}
                              size="small"
                              hoverable={!!item.sales_order_item_id || !!item.production_order_id}
                              onClick={() => {
                                if (isAdded) {
                                  removeLine(itemKey)
                                } else {
                                  addLine(delivery, item)
                                }
                              }}
                              style={{
                                marginBottom: 6,
                                cursor: (canAdd || isAdded) ? 'pointer' : 'not-allowed',
                                opacity: (canAdd || isAdded) ? 1 : 0.55,
                                border: isAdded ? '1px solid #52c41a' : undefined,
                                background: isAdded ? '#f6ffed' : undefined,
                                transition: 'all 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
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
                                </div>
                                {isAdded && (
                                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16, marginLeft: 8, flexShrink: 0 }} />
                                )}
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
