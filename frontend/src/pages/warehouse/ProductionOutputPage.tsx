import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateProductionOutputPayload, ProductionOutput } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { productionOrdersApi } from '../../api/productionOrders'

const { Title, Text } = Typography

export default function ProductionOutputPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: lsxPaged } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxList = (lsxPaged as any)?.items ?? []

  const { data: outputList = [], isLoading } = useQuery({
    queryKey: ['production-outputs', filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listProductionOutputs({
      warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateProductionOutputPayload) => warehouseApi.createProductionOutput(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-outputs'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã nhập thành phẩm vào kho')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteProductionOutput(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-outputs'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu nhập TP')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      createMut.mutate({
        ngay_nhap: v.ngay_nhap.format('YYYY-MM-DD'),
        production_order_id: v.production_order_id,
        warehouse_id: v.warehouse_id,
        ten_hang: v.ten_hang || '',
        so_luong_nhap: v.so_luong_nhap,
        so_luong_loi: v.so_luong_loi || 0,
        dvt: v.dvt || 'Thùng',
        don_gia_xuat_xuong: v.don_gia_xuat_xuong || 0,
        ghi_chu: v.ghi_chu || null,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#52c41a' }}>{v}</Text> },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110 },
    { title: 'LSX', dataIndex: 'so_lenh', width: 150 },
    { title: 'Kho TP', dataIndex: 'ten_kho', width: 150 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'SL nhập', dataIndex: 'so_luong_nhap', width: 100, align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> },
    { title: 'SL lỗi', dataIndex: 'so_luong_loi', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> : '0' },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Đơn giá XX', dataIndex: 'don_gia_xuat_xuong', width: 120, align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
    {
      title: '', width: 50,
      render: (_: unknown, r: ProductionOutput) => (
        <Popconfirm title="Xoá phiếu nhập TP?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Nhập thành phẩm từ sản xuất</Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
            Tạo phiếu nhập TP
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
        <Table dataSource={outputList} columns={columns} rowKey="id" loading={isLoading} size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 950 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Nhập thành phẩm từ sản xuất" width={600}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ dvt: 'Thùng', ngay_nhap: dayjs(), so_luong_loi: 0, don_gia_xuat_xuong: 0 }}>
          <Form.Item name="production_order_id" label="Lệnh sản xuất" rules={[{ required: true, message: 'Chọn LSX' }]}>
            <Select placeholder="Chọn LSX..." showSearch
              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              options={(lsxList as any[]).map((o: any) => ({
                value: o.id,
                label: `${o.so_lenh}${o.ten_khach_hang ? ' — ' + o.ten_khach_hang : ''}`,
              }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho TP" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho TP"
                  options={warehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ten_hang" label="Tên hàng" rules={[{ required: true, message: 'Nhập tên hàng' }]}>
            <Input placeholder="Ví dụ: Thùng carton 3 lớp B ..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="so_luong_nhap" label="SL nhập (OK)" rules={[{ required: true, message: 'Nhập SL' }]}>
                <InputNumber min={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="so_luong_loi" label="SL lỗi">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dvt" label="ĐVT">
                <Select options={['Thùng', 'Cái', 'Tờ', 'Kg'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="don_gia_xuat_xuong" label="Đơn giá xuất xưởng">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  )
}
