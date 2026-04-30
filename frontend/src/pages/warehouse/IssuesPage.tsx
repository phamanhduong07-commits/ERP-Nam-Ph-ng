import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ExportOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateMaterialIssuePayload, MaterialIssue } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { productionOrdersApi } from '../../api/productionOrders'

const { Title, Text } = Typography

export default function IssuesPage() {
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

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []

  const { data: otherPage } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const otherMats = otherPage?.items ?? []

  const { data: lsxPaged } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxList = (lsxPaged as any)?.items ?? []

  const { data: issueList = [], isLoading } = useQuery({
    queryKey: ['material-issues', filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listMaterialIssues({
      warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateMaterialIssuePayload) => warehouseApi.createMaterialIssue(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu xuất NVL')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteMaterialIssue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu xuất')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = { ...updated[itemName], mat_id: matId, ten_hang: mat.ten, dvt: mat.dvt }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang || '',
        so_luong_ke_hoach: it.so_luong_ke_hoach || 0,
        so_luong_thuc_xuat: it.so_luong_thuc_xuat,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        ngay_xuat: v.ngay_xuat.format('YYYY-MM-DD'),
        production_order_id: v.production_order_id,
        warehouse_id: v.warehouse_id,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#fa8c16' }}>{v}</Text> },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 110 },
    { title: 'Kho xuất', dataIndex: 'ten_kho', width: 150 },
    { title: 'LSX', dataIndex: 'so_lenh', width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'TT', dataIndex: 'trang_thai', width: 100,
      render: (v: string) => (
        <Tag color={v === 'da_xuat' ? 'green' : v === 'huy' ? 'red' : 'default'}>
          {v === 'da_xuat' ? 'Đã xuất' : v === 'huy' ? 'Huỷ' : 'Nhập'}
        </Tag>
      ) },
    {
      title: '', width: 50,
      render: (_: unknown, r: MaterialIssue) => (
        <Popconfirm title="Xoá phiếu xuất này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
          disabled={r.trang_thai === 'da_xuat'}>
          <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai === 'da_xuat'} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: MaterialIssue) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'SL kế hoạch', dataIndex: 'so_luong_ke_hoach', width: 110, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—' },
        { title: 'SL thực xuất', dataIndex: 'so_luong_thuc_xuat', width: 120, align: 'right' as const,
          render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><ExportOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            <Title level={4} style={{ margin: 0 }}>Xuất NVL cho sản xuất</Title>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
            Tạo phiếu xuất
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
        <Table dataSource={issueList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 750 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu xuất NVL" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu xuất</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_xuat: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="production_order_id" label="Lệnh sản xuất" rules={[{ required: true, message: 'Chọn LSX' }]}>
                <Select placeholder="Chọn LSX..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={(lsxList as any[]).map((o: any) => ({
                    value: o.id,
                    label: `${o.so_lenh}${o.ten_khach_hang ? ' — ' + o.ten_khach_hang : ''}`,
                  }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho"
                  options={warehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách NVL xuất</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={5}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" style={{ marginBottom: 4 }}>
                          <Select size="small"
                            onChange={() => {
                              const items = form.getFieldValue('items') || []
                              const updated = [...items]
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', dvt: 'Kg' }
                              form.setFieldValue('items', updated)
                            }}
                            options={[
                              { value: 'giay', label: 'NL Giấy' },
                              { value: 'khac', label: 'NL Khác' },
                              { value: 'tu_do', label: 'Tự do' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu giấy" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL giấy..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={paperMats.filter(m => m.su_dung).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'giay', id)} />
                              </Form.Item>
                            )
                            if (loai === 'khac') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu khác" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL khác..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={otherMats.filter(m => m.trang_thai).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'khac', id)} />
                              </Form.Item>
                            )
                            return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Tên hàng..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Kg', 'Tấn', 'Tờ', 'Cuộn', 'Lít', 'Cái'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong_ke_hoach']} label="SL kế hoạch" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong_thuc_xuat']} label="SL thực xuất" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', so_luong_ke_hoach: 0 })}>
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
