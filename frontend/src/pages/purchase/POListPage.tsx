import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message, Divider,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, ShopOutlined, MinusCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  purchaseApi, PurchaseOrder, CreatePOPayload,
  TRANG_THAI_PO, TRANG_THAI_PO_COLOR,
} from '../../api/purchase'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { suppliersApi } from '../../api/suppliers'

const { Title, Text } = Typography

const DIEU_KHOAN_OPTIONS = ['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'TT trước'].map(v => ({ value: v, label: v }))

export default function POListPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
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

  const { data: poList = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', filterTrangThai, tuNgay, denNgay],
    queryFn: () => purchaseApi.list({ trang_thai: filterTrangThai, tu_ngay: tuNgay, den_ngay: denNgay }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePOPayload) => purchaseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã tạo đơn mua hàng')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo PO'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => purchaseApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã duyệt đơn mua hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt PO'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      message.success('Đã xoá đơn mua hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = { ...updated[itemName], mat_id: matId, ten_hang: mat.ten, dvt: mat.dvt, don_gia: mat.gia_mua || 0 }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        supplier_id: v.supplier_id,
        ngay_po: v.ngay_po.format('YYYY-MM-DD'),
        ngay_du_kien_nhan: v.ngay_du_kien_nhan ? v.ngay_du_kien_nhan.format('YYYY-MM-DD') : null,
        dieu_khoan_tt: v.dieu_khoan_tt || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số PO', dataIndex: 'so_po', width: 170,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay_po', width: 110 },
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 120,
      render: (v: string) => (
        <Tag color={TRANG_THAI_PO_COLOR[v] || 'default'}>{TRANG_THAI_PO[v] || v}</Tag>
      ) },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'Tiến độ nhận', dataIndex: 'tien_do_nhan', width: 120, align: 'right' as const,
      render: (v: number) => v != null ? `${v}%` : '—' },
    {
      title: '', width: 90,
      render: (_: unknown, r: PurchaseOrder) => (
        <Space>
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Duyệt đơn mua hàng này?" onConfirm={() => approveMut.mutate(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Xoá đơn mua này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: PurchaseOrder) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right' as const,
          render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
          render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN')}đ</Text> },
        { title: 'Đã nhận', dataIndex: 'so_luong_da_nhan', width: 100, align: 'right' as const,
          render: (v: number, row: any) => {
            const pct = row.so_luong > 0 ? Math.round((v || 0) / row.so_luong * 100) : 0
            return <Text type={pct >= 100 ? 'success' : undefined}>{(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ({pct}%)</Text>
          } },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><ShopOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Đơn mua hàng (PO)</Title>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
            Tạo đơn mua
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Tất cả trạng thái" style={{ width: '100%' }} allowClear value={filterTrangThai} onChange={setFilterTrangThai}
              options={Object.entries(TRANG_THAI_PO).map(([v, l]) => ({ value: v, label: l }))} />
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
        <Table dataSource={poList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo đơn mua hàng" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu đơn mua</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                <Select placeholder="Chọn nhà cung cấp..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_du_kien_nhan" label="Ngày DK nhận">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dieu_khoan_tt" label="Điều khoản TT">
                <Select placeholder="Chọn..." allowClear options={DIEU_KHOAN_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách hàng mua</Divider>

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
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', dvt: 'Kg', don_gia: 0 }
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
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Tên hàng tự do..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Kg', 'Tấn', 'Tờ', 'Cuộn', 'Lít', 'Thùng', 'Cái'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
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
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', don_gia: 0 })}>
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
