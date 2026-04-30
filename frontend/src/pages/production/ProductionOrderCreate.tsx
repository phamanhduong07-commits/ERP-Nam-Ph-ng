import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Alert, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi } from '../../api/salesOrders'
import { productsApi } from '../../api/products'
import { productionOrdersApi } from '../../api/productionOrders'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehousesApi } from '../../api/warehouses'
import type { Product } from '../../api/products'

const { Title, Text } = Typography

interface ProdLine {
  key: string
  product_id: number | null
  sales_order_item_id: number | null
  ten_hang: string
  product: Product | null
  so_luong_ke_hoach: number
  dvt: string
  ngay_giao_hang: string | null
  ghi_chu: string | null
}

export default function ProductionOrderCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initSalesOrderId = searchParams.get('sales_order_id')
    ? Number(searchParams.get('sales_order_id'))
    : null

  const [form] = Form.useForm()
  const [lines, setLines] = useState<ProdLine[]>([])
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [salesOrderId, setSalesOrderId] = useState<number | null>(initSalesOrderId)

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-approved'],
    queryFn: () =>
      salesOrdersApi
        .list({ trang_thai: 'da_duyet', page_size: 100 })
        .then((r) => r.data.items),
  })

  const { data: phapNhanList } = useQuery({
    queryKey: ['phap-nhan-all'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then((r) => r.data),
  })

  const { data: khoList } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then((r) => r.data),
  })

  const { data: selectedSO } = useQuery({
    queryKey: ['sales-order-detail', salesOrderId],
    queryFn: () => salesOrdersApi.get(salesOrderId!).then((r) => r.data),
    enabled: !!salesOrderId,
  })

  const { data: products } = useQuery({
    queryKey: ['products-all', productSearch],
    queryFn: () =>
      productsApi.list({ search: productSearch, page_size: 50 }).then((r) => r.data.items),
  })

  const importFromSalesOrder = () => {
    if (!selectedSO) return
    const newLines: ProdLine[] = selectedSO.items.map((item, idx) => ({
      key: `so-${item.id}-${idx}`,
      product_id: item.product_id,
      sales_order_item_id: item.id,
      ten_hang: item.ten_hang,
      product: item.product as Product | null,
      so_luong_ke_hoach: Number(item.so_luong),
      dvt: item.dvt,
      ngay_giao_hang: selectedSO.ngay_giao_hang,
      ghi_chu: item.ghi_chu_san_pham,
    }))
    setLines(newLines)
    // Tự điền pháp nhân SX từ đơn hàng nếu chưa chọn
    if (selectedSO.phap_nhan_sx_id && !form.getFieldValue('phap_nhan_sx_id')) {
      form.setFieldValue('phap_nhan_sx_id', selectedSO.phap_nhan_sx_id)
    }
    message.success(`Đã import ${newLines.length} dòng từ đơn hàng ${selectedSO.so_don}`)
  }

  const addProductLine = (product: Product) => {
    if (lines.find((l) => l.product_id === product.id && !l.sales_order_item_id)) {
      message.warning('Sản phẩm đã có trong lệnh SX')
      return
    }
    setLines((prev) => [
      ...prev,
      {
        key: `p-${product.id}-${Date.now()}`,
        product_id: product.id,
        sales_order_item_id: null,
        ten_hang: product.ten_hang,
        product,
        so_luong_ke_hoach: 1,
        dvt: product.dvt,
        ngay_giao_hang: null,
        ghi_chu: null,
      },
    ])
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const updateLine = (key: string, field: keyof ProdLine, value: unknown) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)))
  }

  const totalKH = lines.reduce((s, l) => s + l.so_luong_ke_hoach, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm')
        return
      }
      setSaving(true)
      const payload = {
        ngay_lenh: dayjs(values.ngay_lenh).format('YYYY-MM-DD'),
        sales_order_id: salesOrderId || undefined,
        phap_nhan_sx_id: values.phap_nhan_sx_id ?? null,
        kho_sx_id: values.kho_sx_id ?? null,
        ngay_bat_dau_ke_hoach: values.ngay_bat_dau_ke_hoach
          ? dayjs(values.ngay_bat_dau_ke_hoach).format('YYYY-MM-DD')
          : undefined,
        ngay_hoan_thanh_ke_hoach: values.ngay_hoan_thanh_ke_hoach
          ? dayjs(values.ngay_hoan_thanh_ke_hoach).format('YYYY-MM-DD')
          : undefined,
        ghi_chu: values.ghi_chu,
        items: lines.map((l) => ({
          product_id: l.product_id || undefined,
          sales_order_item_id: l.sales_order_item_id || undefined,
          ten_hang: l.ten_hang,
          so_luong_ke_hoach: l.so_luong_ke_hoach,
          dvt: l.dvt,
          ngay_giao_hang: l.ngay_giao_hang || undefined,
          ghi_chu: l.ghi_chu || undefined,
        })),
      }
      const res = await productionOrdersApi.create(payload)
      message.success(`Tạo lệnh sản xuất ${res.data.so_lenh} thành công`)
      navigate(`/production/orders/${res.data.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg) message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnsType<ProdLine> = [
    {
      title: 'Tên hàng hóa',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          {r.product && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              [{r.product.ma_amis}]
              {r.product.dai ? ` ${r.product.dai}×${r.product.rong}×${r.product.cao}cm` : ''}
              {` • ${r.product.so_lop} lớp`}
            </Text>
          )}
          {r.sales_order_item_id && <Tag color="blue" style={{ fontSize: 10 }}>Từ đơn hàng</Tag>}
        </Space>
      ),
    },
    {
      title: 'SL kế hoạch',
      width: 130,
      render: (_, r) => (
        <InputNumber
          min={0.001}
          value={r.so_luong_ke_hoach}
          onChange={(v) => updateLine(r.key, 'so_luong_ke_hoach', v || 1)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: 'ĐVT',
      width: 90,
      render: (_, r) => (
        <Input
          value={r.dvt}
          onChange={(e) => updateLine(r.key, 'dvt', e.target.value)}
          style={{ width: 75 }}
        />
      ),
    },
    {
      title: 'Ngày giao',
      width: 130,
      render: (_, r) => (
        <DatePicker
          format="DD/MM/YYYY"
          value={r.ngay_giao_hang ? dayjs(r.ngay_giao_hang) : null}
          onChange={(_, s) => updateLine(r.key, 'ngay_giao_hang', s || null)}
          style={{ width: 115 }}
          size="small"
        />
      ),
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: (_, r) => (
        <Input
          placeholder="Ghi chú..."
          value={r.ghi_chu || ''}
          onChange={(e) => updateLine(r.key, 'ghi_chu', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(r.key)} />
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/orders')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>Tạo lệnh sản xuất mới</Title>
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card title="Thông tin lệnh SX" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="ngay_lenh"
                    label="Ngày lệnh"
                    initialValue={dayjs()}
                    rules={[{ required: true }]}
                  >
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="ngay_bat_dau_ke_hoach" label="Ngày bắt đầu (KH)">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="ngay_hoan_thanh_ke_hoach" label="Ngày hoàn thành (KH)">
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phap_nhan_sx_id" label="Pháp nhân sản xuất" rules={[{ required: true, message: 'Chọn pháp nhân SX' }]}>
                    <Select
                      showSearch allowClear placeholder="Chọn pháp nhân (xưởng)..."
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={phapNhanList?.map((p) => ({
                        value: p.id,
                        label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="kho_sx_id" label="Kho sản xuất" rules={[{ required: true, message: 'Chọn kho SX' }]}>
                    <Select
                      showSearch allowClear placeholder="Chọn kho sản xuất..."
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={khoList?.filter(k => k.trang_thai).map((k) => ({
                        value: k.id,
                        label: `[${k.ma_kho}] ${k.ten_kho}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item label="Từ đơn hàng (tuỳ chọn)">
                    <Space.Compact style={{ width: '100%' }}>
                      <Select
                        showSearch
                        placeholder="Chọn đơn hàng đã duyệt..."
                        style={{ flex: 1 }}
                        allowClear
                        value={salesOrderId}
                        onChange={(v) => setSalesOrderId(v || null)}
                        filterOption={(input, option) =>
                          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={salesOrders?.map((o) => ({
                          value: o.id,
                          label: `${o.so_don} — ${o.ten_khach_hang}`,
                        }))}
                      />
                      <Button
                        type="default"
                        disabled={!selectedSO}
                        onClick={importFromSalesOrder}
                        icon={<PlusOutlined />}
                      >
                        Import dòng
                      </Button>
                    </Space.Compact>
                    {selectedSO && (
                      <Alert
                        type="info"
                        message={`Đơn hàng ${selectedSO.so_don} — ${selectedSO.items.length} sản phẩm — Giao: ${selectedSO.ngay_giao_hang || '—'}`}
                        style={{ marginTop: 8 }}
                        showIcon
                      />
                    )}
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="ghi_chu" label="Ghi chú">
                    <Input.TextArea rows={2} placeholder="Ghi chú lệnh SX..." />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          <Card
            title={`Chi tiết lệnh SX (${lines.length} dòng · Tổng SL: ${new Intl.NumberFormat('vi-VN').format(totalKH)})`}
          >
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="key"
              pagination={false}
              size="small"
            />
            <Divider />
            <Row justify="end">
              <Col>
                <Space>
                  <Button onClick={() => navigate('/production/orders')}>Huỷ</Button>
                  <Button type="primary" loading={saving} onClick={handleSubmit}>
                    Lưu lệnh SX
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Thêm sản phẩm thủ công" style={{ position: 'sticky', top: 24 }}>
            <Input
              placeholder="Tìm sản phẩm..."
              prefix={<PlusOutlined />}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {products?.map((p) => (
                <Card
                  key={p.id}
                  size="small"
                  hoverable
                  onClick={() => addProductLine(p)}
                  style={{ marginBottom: 6, cursor: 'pointer' }}
                >
                  <Text strong style={{ fontSize: 12 }}>[{p.ma_amis}]</Text>
                  <br />
                  <Text style={{ fontSize: 12 }}>{p.ten_hang}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {p.dai ? `${p.dai}×${p.rong}×${p.cao}cm · ` : ''}
                    {p.so_lop} lớp · {p.dvt}
                  </Text>
                </Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
