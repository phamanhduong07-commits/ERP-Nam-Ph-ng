import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Empty, Spin,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customersApi } from '../../api/customers'
import { productsApi } from '../../api/products'
import { salesOrdersApi } from '../../api/salesOrders'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { usersApi } from '../../api/usersApi'
import type { Product } from '../../api/products'

const { Title, Text } = Typography

interface OrderLine {
  key: string
  product_id: number
  product: Product
  so_luong: number
  don_gia: number
  ty_le_giam_gia: number
  so_tien_giam_gia: number
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
  const [customerOptions, setCustomerOptions] = useState<{ value: number; label: string }[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  const handleCustomerSearch = async (q: string) => {
    if (!q || q.length < 1) return
    setCustomerSearching(true)
    try {
      const res = await customersApi.list({ search: q, page_size: 30 })
      setCustomerOptions(
        res.data.items.map(c => ({
          value: c.id,
          label: `[${c.ma_kh}] ${c.ten_viet_tat}`,
        }))
      )
    } finally {
      setCustomerSearching(false)
    }
  }

  const { data: phapNhanList } = useQuery({
    queryKey: ['phap-nhan-all'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then((r) => r.data),
  })

  const { data: phanXuongRaw } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })
  const phanXuongList = Array.isArray(phanXuongRaw) ? phanXuongRaw : []

  const { data: nhanVienRaw } = useQuery({
    queryKey: ['nhan-vien-list'],
    queryFn: () => usersApi.list({ trang_thai: true }).then(r => r.data),
  })
  const nhanVienList = Array.isArray(nhanVienRaw) ? nhanVienRaw : []

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
      ty_le_giam_gia: 0,
      so_tien_giam_gia: 0,
      ngay_giao_hang: null,
      ghi_chu_san_pham: null,
      yeu_cau_in: null,
    }])
  }

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key))

  const updateLine = (key: string, field: keyof OrderLine, value: unknown) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l))
  }

  const tongTien = lines.reduce((s, l) => {
    const tienHang = l.so_luong * l.don_gia
    if (l.ty_le_giam_gia > 0) {
      return s + tienHang * (1 - l.ty_le_giam_gia / 100)
    } else if (l.so_tien_giam_gia > 0) {
      return s + Math.max(0, tienHang - l.so_tien_giam_gia)
    }
    return s + tienHang
  }, 0)

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
        phap_nhan_id: values.phap_nhan_id ?? null,
        phap_nhan_sx_id: values.phap_nhan_sx_id ?? null,
        phan_xuong_id: values.phan_xuong_id ?? null,
        nv_kinh_doanh_id: values.nv_kinh_doanh_id ?? null,
        ngay_giao_hang: values.ngay_giao_hang
          ? dayjs(values.ngay_giao_hang).format('YYYY-MM-DD')
          : undefined,
        dia_chi_giao: values.dia_chi_giao,
        ghi_chu: values.ghi_chu,
        ty_le_giam_gia: values.ty_le_giam_gia || 0,
        so_tien_giam_gia: values.so_tien_giam_gia || 0,
        items: lines.map((l) => ({
          product_id: l.product_id,
          ten_hang: l.product.ten_hang,
          so_luong: l.so_luong,
          don_gia: l.don_gia,
          ty_le_giam_gia: l.ty_le_giam_gia,
          so_tien_giam_gia: l.so_tien_giam_gia,
          dvt: l.product.dvt,
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
      title: '% Giảm',
      width: 80,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={100}
          value={r.ty_le_giam_gia}
          onChange={(v) => updateLine(r.key, 'ty_le_giam_gia', v || 0)}
          style={{ width: 60 }}
        />
      ),
    },
    {
      title: 'Giảm tiền',
      width: 100,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.so_tien_giam_gia}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={(v) => updateLine(r.key, 'so_tien_giam_gia', v || 0)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => {
        const tienHang = r.so_luong * r.don_gia
        const thanhTien = r.ty_le_giam_gia > 0
          ? tienHang * (1 - r.ty_le_giam_gia / 100)
          : r.so_tien_giam_gia > 0
          ? Math.max(0, tienHang - r.so_tien_giam_gia)
          : tienHang
        return <Text strong>{new Intl.NumberFormat('vi-VN').format(thanhTien)}</Text>
      },
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
                      filterOption={false}
                      placeholder="Gõ để tìm khách hàng..."
                      notFoundContent={customerSearching ? <Spin size="small" /> : 'Gõ tên / mã KH...'}
                      onSearch={handleCustomerSearch}
                      onChange={(v) => {
                        setSelectedCustomerId(v)
                        customersApi.get(v).then(r => {
                          if (r.data?.dia_chi_giao_hang) form.setFieldValue('dia_chi_giao', r.data.dia_chi_giao_hang)
                        })
                      }}
                      options={customerOptions}
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
                <Col span={12}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân">
                    <Select
                      showSearch allowClear placeholder="Chọn pháp nhân..."
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
                  <Form.Item name="phan_xuong_id" label="Nơi sản xuất">
                    <Select
                      allowClear placeholder="Chọn xưởng sản xuất..."
                      options={phanXuongList
                        .filter(p => p.trang_thai)
                        .map(p => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nv_kinh_doanh_id" label="NV kinh doanh">
                    <Select
                      showSearch allowClear optionFilterProp="label"
                      placeholder="Chọn nhân viên..."
                      options={nhanVienList.map(nv => ({ value: nv.id, label: nv.ho_ten }))}
                    />
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
                <Col span={12}>
                  <Form.Item name="ty_le_giam_gia" label="% Giảm giá đơn hàng">
                    <InputNumber
                      min={0}
                      max={100}
                      placeholder="0"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="so_tien_giam_gia" label="Số tiền giảm giá đơn hàng">
                    <InputNumber
                      min={0}
                      placeholder="0"
                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
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
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>Tổng tiền hàng:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text>{new Intl.NumberFormat('vi-VN').format(tongTien)}đ</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={2} />
                  </Table.Summary.Row>
                  {(form.getFieldValue('ty_le_giam_gia') > 0 || form.getFieldValue('so_tien_giam_gia') > 0) && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={8} align="right">
                        <Text strong>Giảm giá đơn hàng:</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <Text type="danger">
                          -{new Intl.NumberFormat('vi-VN').format(
                            form.getFieldValue('ty_le_giam_gia') > 0
                              ? tongTien * form.getFieldValue('ty_le_giam_gia') / 100
                              : Math.min(tongTien, form.getFieldValue('so_tien_giam_gia') || 0)
                          )}đ
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} colSpan={2} />
                    </Table.Summary.Row>
                  )}
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong style={{ fontSize: 16 }}>Tổng cộng:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                        {new Intl.NumberFormat('vi-VN').format(
                          form.getFieldValue('ty_le_giam_gia') > 0
                            ? tongTien * (1 - form.getFieldValue('ty_le_giam_gia') / 100)
                            : form.getFieldValue('so_tien_giam_gia') > 0
                            ? Math.max(0, tongTien - (form.getFieldValue('so_tien_giam_gia') || 0))
                            : tongTien
                        )}đ
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
