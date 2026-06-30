import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Form, Select, DatePicker, Input, Button, Table, Space,
  InputNumber, Typography, Row, Col, Divider, message, Skeleton, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, CarOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi } from '../../api/salesOrders'
import { productsApi } from '../../api/products'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { customersApi } from '../../api/customers'
import type { Product } from '../../api/products'

const { Title, Text } = Typography

type LineProduct = Pick<Product, 'id' | 'ma_amis' | 'ten_hang' | 'dai' | 'rong' | 'cao' | 'so_lop' | 'dvt' | 'gia_ban'>

interface OrderLine {
  key: string
  id: number | null
  product_id: number
  product: LineProduct
  so_luong: number
  dvt: string
  don_gia: number
  ty_le_giam_gia: number
  so_tien_giam_gia: number
  ngay_giao_hang: string | null
  ghi_chu_san_pham: string | null
  yeu_cau_in: string | null
  phan_xuong_id: number | null
}

interface ExtraLine {
  key: string
  id: number | null
  ten_hang: string
  dvt: string
  don_gia: number
  ghi_chu: string
}

export default function OrderEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [lines, setLines] = useState<OrderLine[]>([])
  const [extraLines, setExtraLines] = useState<ExtraLine[]>([])
  const [saving, setSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [initialized, setInitialized] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', Number(id)],
    queryFn: () => salesOrdersApi.get(Number(id)).then(r => r.data),
    enabled: !!id,
  })

  const { data: phapNhanList } = useQuery({
    queryKey: ['phap-nhan-all'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: phanXuongRaw } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const phanXuongList = Array.isArray(phanXuongRaw) ? phanXuongRaw : []

  const { data: nhanVienRaw } = useQuery({
    queryKey: ['sale-users'],
    queryFn: () => customersApi.saleUsers().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const nhanVienList = Array.isArray(nhanVienRaw) ? nhanVienRaw : []

  const { data: products } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => productsApi.list({ search: productSearch, page_size: 50 }).then(r => r.data.items),
  })

  // Pre-fill form + lines once order loads
  useEffect(() => {
    if (!order || initialized) return
    form.setFieldsValue({
      so_po_kh: order.so_po_kh ?? '',
      phap_nhan_id: order.phap_nhan_id ?? undefined,
      phap_nhan_sx_id: order.phap_nhan_sx_id ?? undefined,
      phan_xuong_id: order.phan_xuong_id ?? undefined,
      nv_kinh_doanh_id: order.nv_kinh_doanh_id ?? undefined,
      nv_theo_doi_id: order.nv_theo_doi_id ?? undefined,
      ngay_giao_hang: order.ngay_giao_hang ? dayjs(order.ngay_giao_hang) : undefined,
      dia_chi_giao: order.dia_chi_giao ?? '',
      ghi_chu: order.ghi_chu ?? '',
      ty_le_giam_gia: Number(order.ty_le_giam_gia) || undefined,
      so_tien_giam_gia: Number(order.so_tien_giam_gia) || undefined,
    })

    const newLines: OrderLine[] = []
    const newExtra: ExtraLine[] = []

    order.items.forEach((item) => {
      if (item.product_id && item.product) {
        newLines.push({
          key: `line-${item.id}`,
          id: item.id,
          product_id: item.product_id,
          product: {
            id: item.product.id,
            ma_amis: item.product.ma_amis,
            ten_hang: item.ten_hang || item.product.ten_hang,
            dai: item.product.dai,
            rong: item.product.rong,
            cao: item.product.cao,
            so_lop: item.product.so_lop,
            dvt: item.product.dvt,
            gia_ban: item.product.gia_ban,
          },
          so_luong: Number(item.so_luong),
          dvt: item.dvt,
          don_gia: Number(item.don_gia),
          ty_le_giam_gia: Number(item.ty_le_giam_gia) || 0,
          so_tien_giam_gia: Number(item.so_tien_giam_gia) || 0,
          ngay_giao_hang: item.ngay_giao_hang ?? null,
          ghi_chu_san_pham: item.ghi_chu_san_pham ?? null,
          yeu_cau_in: item.yeu_cau_in ?? null,
          phan_xuong_id: item.phan_xuong_id ?? null,
        })
      } else {
        newExtra.push({
          key: `extra-${item.id}`,
          id: item.id,
          ten_hang: item.ten_hang || '',
          dvt: item.dvt || 'lần',
          don_gia: Number(item.don_gia),
          ghi_chu: item.ghi_chu_san_pham ?? '',
        })
      }
    })

    setLines(newLines)
    setExtraLines(newExtra)
    setInitialized(true)
  }, [order, form, initialized])

  const addLine = (product: Product) => {
    if (lines.find(l => l.product_id === product.id)) {
      message.warning('Sản phẩm đã có trong đơn hàng')
      return
    }
    setLines(prev => [...prev, {
      key: `new-${product.id}-${Date.now()}`,
      id: null,
      product_id: product.id,
      product,
      so_luong: 1,
      dvt: product.dvt,
      don_gia: Number(product.gia_ban) || 0,
      ty_le_giam_gia: 0,
      so_tien_giam_gia: 0,
      ngay_giao_hang: null,
      ghi_chu_san_pham: null,
      yeu_cau_in: null,
      phan_xuong_id: null,
    }])
  }

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))
  const updateLine = (key: string, field: keyof OrderLine, value: unknown) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))

  const addExtraLine = (preset?: Partial<ExtraLine>) => {
    setExtraLines(prev => [...prev, {
      key: `extra-new-${Date.now()}`,
      id: null,
      ten_hang: preset?.ten_hang ?? '',
      dvt: 'lần',
      don_gia: preset?.don_gia ?? 0,
      ghi_chu: '',
    }])
  }
  const removeExtraLine = (key: string) => setExtraLines(prev => prev.filter(l => l.key !== key))
  const updateExtraLine = (key: string, field: keyof ExtraLine, value: unknown) =>
    setExtraLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))

  const tongTien = lines.reduce((s, l) => {
    const base = l.so_luong * l.don_gia
    if (l.ty_le_giam_gia > 0) return s + base * (1 - l.ty_le_giam_gia / 100)
    if (l.so_tien_giam_gia > 0) return s + Math.max(0, base - l.so_tien_giam_gia)
    return s + base
  }, 0) + extraLines.reduce((s, l) => s + l.don_gia, 0)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (lines.length === 0 && extraLines.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm')
        return
      }
      setSaving(true)
      const payload = {
        so_po_kh: values.so_po_kh || undefined,
        phap_nhan_id: values.phap_nhan_id ?? null,
        phap_nhan_sx_id: values.phap_nhan_sx_id ?? null,
        phan_xuong_id: values.phan_xuong_id ?? null,
        nv_kinh_doanh_id: values.nv_kinh_doanh_id ?? null,
        nv_theo_doi_id: values.nv_theo_doi_id ?? null,
        ngay_giao_hang: values.ngay_giao_hang
          ? dayjs(values.ngay_giao_hang).format('YYYY-MM-DD')
          : null,
        dia_chi_giao: values.dia_chi_giao || undefined,
        ghi_chu: values.ghi_chu || undefined,
        ty_le_giam_gia: values.ty_le_giam_gia || 0,
        so_tien_giam_gia: values.so_tien_giam_gia || 0,
        items: [
          ...lines.map(l => ({
            id: l.id ?? undefined,
            product_id: l.product_id,
            ten_hang: l.product.ten_hang,
            so_luong: l.so_luong,
            don_gia: l.don_gia,
            ty_le_giam_gia: l.ty_le_giam_gia,
            so_tien_giam_gia: l.so_tien_giam_gia,
            dvt: l.dvt || l.product.dvt,
            ngay_giao_hang: l.ngay_giao_hang || undefined,
            ghi_chu_san_pham: l.ghi_chu_san_pham || undefined,
            yeu_cau_in: l.yeu_cau_in || undefined,
            phan_xuong_id: l.phan_xuong_id || undefined,
          })),
          ...extraLines.map(l => ({
            id: l.id ?? undefined,
            product_id: null,
            ten_hang: l.ten_hang || 'Dịch vụ',
            so_luong: 1,
            don_gia: l.don_gia,
            ty_le_giam_gia: 0,
            so_tien_giam_gia: 0,
            dvt: l.dvt || 'lần',
            ghi_chu_san_pham: l.ghi_chu || undefined,
          })),
        ],
      }
      await salesOrdersApi.update(Number(id), payload as Parameters<typeof salesOrdersApi.update>[1])
      message.success('Đã cập nhật đơn hàng')
      navigate(`/sales/orders/${id}`)
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
        ? `${Number(r.product.dai)}×${Number(r.product.rong ?? 0)}×${Number(r.product.cao ?? 0)}`
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
          onChange={v => updateLine(r.key, 'so_luong', v || 1)}
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
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={v => updateLine(r.key, 'don_gia', v || 0)}
          style={{ width: 110 }}
        />
      ),
    },
    {
      title: '% Giảm',
      width: 80,
      render: (_, r) => (
        <InputNumber
          min={0} max={100}
          value={r.ty_le_giam_gia}
          onChange={v => updateLine(r.key, 'ty_le_giam_gia', v || 0)}
          style={{ width: 60 }}
        />
      ),
    },
    {
      title: 'Giảm tiền',
      width: 110,
      render: (_, r) => (
        <InputNumber
          min={0}
          value={r.so_tien_giam_gia}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          onChange={v => updateLine(r.key, 'so_tien_giam_gia', v || 0)}
          style={{ width: 90 }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => {
        const base = r.so_luong * r.don_gia
        const tt = r.ty_le_giam_gia > 0
          ? base * (1 - r.ty_le_giam_gia / 100)
          : r.so_tien_giam_gia > 0
          ? Math.max(0, base - r.so_tien_giam_gia)
          : base
        return <Text strong>{new Intl.NumberFormat('vi-VN').format(tt)}</Text>
      },
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: (_, r) => (
        <Input
          placeholder="Ghi chú..."
          value={r.ghi_chu_san_pham || ''}
          onChange={e => updateLine(r.key, 'ghi_chu_san_pham', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Xưởng SX',
      width: 130,
      render: (_, r) => (
        <Select
          size="small"
          allowClear
          placeholder="Theo đơn"
          style={{ width: '100%' }}
          value={r.phan_xuong_id ?? undefined}
          onChange={v => updateLine(r.key, 'phan_xuong_id', v ?? null)}
          options={phanXuongList
            .filter((p: { trang_thai: boolean }) => p.trang_thai)
            .map((p: { id: number; ten_xuong: string }) => ({ value: p.id, label: p.ten_xuong }))}
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

  if (isLoading || !order) return <Skeleton active />
  if (order.trang_thai !== 'moi') {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">Chỉ có thể sửa đơn hàng ở trạng thái Mới.</Text>
      </div>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/sales/orders/${id}`)}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Sửa đơn hàng: <Text style={{ color: '#1677ff' }}>{order.so_don}</Text>
        </Title>
        <Tag color="blue">Mới</Tag>
      </Space>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          {/* Thông tin đơn hàng */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 0]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Khách hàng</Text>
                <div>
                  <Text strong>{order.customer?.ten_viet_tat}</Text>
                  {order.customer?.ten_don_vi && (
                    <Text type="secondary"> — {order.customer.ten_don_vi}</Text>
                  )}
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary" style={{ fontSize: 12 }}>Ngày đặt hàng</Text>
                <div><Text strong>{dayjs(order.ngay_don).format('DD/MM/YYYY')}</Text></div>
              </Col>
            </Row>

            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="so_po_kh" label="Số PO KH">
                    <Input placeholder="Số PO khách hàng..." allowClear />
                  </Form.Item>
                </Col>
                <Col span={12}>
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
                      options={phapNhanList?.map(p => ({
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
                        .filter((p: { trang_thai: boolean }) => p.trang_thai)
                        .map((p: { id: number; ten_xuong: string }) => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nv_kinh_doanh_id" label="NV phụ trách">
                    <Select
                      showSearch allowClear optionFilterProp="label"
                      placeholder="Chọn nhân viên..."
                      options={nhanVienList.map((nv: { id: number; ho_ten: string }) => ({ value: nv.id, label: nv.ho_ten }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="nv_theo_doi_id" label="NV theo dõi đơn hàng">
                    <Select
                      showSearch allowClear optionFilterProp="label"
                      placeholder="Chọn nhân viên..."
                      options={nhanVienList.map((nv: { id: number; ho_ten: string }) => ({ value: nv.id, label: nv.ho_ten }))}
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
                    <InputNumber min={0} max={100} placeholder="0" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="so_tien_giam_gia" label="Số tiền giảm giá">
                    <InputNumber
                      min={0} placeholder="0"
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* Chi tiết sản phẩm */}
          <Card title={`Chi tiết đơn hàng (${lines.length} dòng)`}>
            <Table
              columns={columns}
              dataSource={lines}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 1100 }}
              locale={{ emptyText: 'Chưa có sản phẩm. Chọn từ danh sách bên phải.' }}
              summary={() => lines.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>Tổng tiền hàng:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ fontSize: 15, color: '#1677ff' }}>
                        {new Intl.NumberFormat('vi-VN').format(tongTien)}đ
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={3} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null}
            />

            {/* Extra lines (phí vận chuyển, dịch vụ) */}
            {extraLines.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 13, color: '#888', margin: '12px 0 8px' }}>
                  Phí / Dịch vụ
                </Divider>
                <Table
                  dataSource={extraLines}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  showHeader={false}
                  columns={[
                    {
                      dataIndex: 'ten_hang',
                      render: (v, r) => (
                        <Input
                          value={v}
                          placeholder="Tên phí / dịch vụ (VD: Phí vận chuyển)"
                          onChange={e => updateExtraLine(r.key, 'ten_hang', e.target.value)}
                          size="small"
                        />
                      ),
                    },
                    {
                      width: 150,
                      dataIndex: 'don_gia',
                      render: (v, r) => (
                        <InputNumber
                          value={v} min={0}
                          formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          onChange={val => updateExtraLine(r.key, 'don_gia', val || 0)}
                          size="small" style={{ width: '100%' }} addonAfter="đ"
                        />
                      ),
                    },
                    {
                      width: 160,
                      dataIndex: 'ghi_chu',
                      render: (v, r) => (
                        <Input
                          value={v} placeholder="Ghi chú"
                          onChange={e => updateExtraLine(r.key, 'ghi_chu', e.target.value)}
                          size="small"
                        />
                      ),
                    },
                    {
                      width: 40,
                      render: (_, r) => (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeExtraLine(r.key)} />
                      ),
                    },
                  ] as ColumnsType<ExtraLine>}
                />
              </>
            )}

            <Space style={{ marginTop: 8 }} wrap>
              <Button size="small" icon={<CarOutlined />} onClick={() => addExtraLine({ ten_hang: 'Phí vận chuyển' })}>
                + Phí vận chuyển
              </Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addExtraLine()}>
                + Phí / dịch vụ khác
              </Button>
            </Space>

            <Divider />
            <Row justify="end">
              <Col>
                <Space>
                  <Button onClick={() => navigate(`/sales/orders/${id}`)}>Huỷ</Button>
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
          <Card title="Thêm sản phẩm" style={{ position: 'sticky', top: 24 }}>
            <Input
              placeholder="Tìm sản phẩm..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {products?.map(p => (
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
                        {Number(p.dai)}×{Number(p.rong ?? 0)}×{Number(p.cao ?? 0)}cm
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
