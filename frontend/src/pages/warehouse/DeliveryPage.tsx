import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined, CarOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateDeliveryPayload, DeliveryOrder } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { salesOrdersApi } from '../../api/salesOrders'

const { Title, Text } = Typography

const TRANG_THAI_DO: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Nhập', color: 'default' },
  da_xuat: { label: 'Đã xuất', color: 'blue' },
  da_giao: { label: 'Đã giao', color: 'green' },
  huy: { label: 'Huỷ', color: 'red' },
}

export default function DeliveryPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedSOId, setSelectedSOId] = useState<number | undefined>()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: soPaged } = useQuery({
    queryKey: ['sales-orders-active'],
    queryFn: () => salesOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const soList = (soPaged as any)?.items ?? []

  const { data: soDetail } = useQuery({
    queryKey: ['sales-order-detail', selectedSOId],
    queryFn: () => selectedSOId ? salesOrdersApi.get(selectedSOId).then(r => r.data) : null,
    enabled: !!selectedSOId,
  })

  const { data: deliveryList = [], isLoading } = useQuery({
    queryKey: ['deliveries', filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listDeliveries({
      warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateDeliveryPayload) => warehouseApi.createDelivery(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      message.success('Đã tạo phiếu giao hàng')
      setOpen(false)
      form.resetFields()
      setSelectedSOId(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteDelivery(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu giao hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleSOSelect = (soId: number) => {
    setSelectedSOId(soId)
  }

  useEffect(() => {
    if (!soDetail) return
    form.setFieldsValue({ dia_chi_giao: (soDetail as any).dia_chi_giao || '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soDetail])

  const handleFillItems = () => {
    if (!soDetail) return
    const items = (soDetail as any).items?.map((it: any) => ({
      sales_order_item_id: it.id,
      product_id: it.product_id || null,
      ten_hang: it.ten_hang,
      so_luong: it.so_luong - (it.so_luong_da_xuat || 0),
      dvt: it.dvt,
    })).filter((it: any) => it.so_luong > 0) || []
    form.setFieldsValue({ items })
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        sales_order_item_id: it.sales_order_item_id || null,
        product_id: it.product_id || null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Thùng',
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        ngay_xuat: v.ngay_xuat.format('YYYY-MM-DD'),
        sales_order_id: v.sales_order_id,
        warehouse_id: v.warehouse_id,
        dia_chi_giao: v.dia_chi_giao || null,
        nguoi_nhan: v.nguoi_nhan || null,
        xe_van_chuyen: v.xe_van_chuyen || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 110 },
    { title: 'Đơn hàng', dataIndex: 'so_don', width: 140,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Khách hàng', dataIndex: 'ten_khach', width: 160 },
    { title: 'Kho', dataIndex: 'ten_kho', width: 130 },
    { title: 'TT', dataIndex: 'trang_thai', width: 100,
      render: (v: string) => {
        const tt = TRANG_THAI_DO[v] || { label: v, color: 'default' }
        return <Tag color={tt.color}>{tt.label}</Tag>
      } },
    {
      title: '', width: 50,
      render: (_: unknown, r: DeliveryOrder) => (
        <Popconfirm title="Xoá phiếu giao hàng?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
          disabled={r.trang_thai === 'da_giao'}>
          <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai === 'da_giao'} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: DeliveryOrder) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 100, align: 'right' as const,
          render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><CarOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Phiếu giao hàng</Title>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setSelectedSOId(undefined); setOpen(true) }}>
            Tạo phiếu giao hàng
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={deliveryList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu giao hàng" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu giao</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_xuat: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sales_order_id" label="Đơn hàng" rules={[{ required: true, message: 'Chọn đơn hàng' }]}>
                <Select placeholder="Chọn đơn hàng..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={(soList as any[]).map((o: any) => ({
                    value: o.id,
                    label: `${o.so_don} — ${o.ten_khach_hang || ''}`,
                  }))}
                  onChange={v => handleSOSelect(v)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="warehouse_id" label="Kho xuất TP" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho"
                  options={warehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nguoi_nhan" label="Người nhận">
                <Input placeholder="Tên người nhận..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="xe_van_chuyen" label="Xe vận chuyển">
                <Input placeholder="Biển số xe..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dia_chi_giao" label="Địa chỉ giao">
            <Input placeholder="Địa chỉ giao hàng..." />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input placeholder="Ghi chú phiếu..." />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>
            <Space>
              Danh sách hàng giao
              {selectedSOId && (
                <Button size="small" type="link" onClick={handleFillItems}>
                  ← Lấy từ đơn hàng
                </Button>
              )}
            </Space>
          </Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]} align="middle">
                      <Col span={11}>
                        <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="Tên sản phẩm..." />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Thùng', 'Cái', 'Kg', 'Tờ'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ dvt: 'Thùng', so_luong: 1 })}>
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
