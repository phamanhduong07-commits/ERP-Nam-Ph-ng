import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, InboxOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  warehouseApi, PhieuNhapKho, LOAI_NHAP_LABELS, CreatePhieuNhapPayload,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'

const { Title, Text } = Typography

const LOAI_NHAP_OPTIONS = Object.entries(LOAI_NHAP_LABELS).map(([v, l]) => ({ value: v, label: l }))

const DON_VI_OPTIONS = ['Kg', 'Tấn', 'Tờ', 'Cuộn', 'Lít', 'Thùng', 'Cái'].map(v => ({ value: v, label: v }))

export default function ReceiptsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

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

  const { data: phieuList = [], isLoading } = useQuery({
    queryKey: ['phieu-nhap', filterXuong, filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listPhieuNhap({
      phan_xuong_id: filterXuong, warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePhieuNhapPayload) => warehouseApi.createPhieuNhap(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-nhap'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu nhập kho')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deletePhieuNhap(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-nhap'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu nhập')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá phiếu'),
  })

  const filteredWarehouses = filterXuong
    ? warehouses.filter(w => w.phan_xuong_id === filterXuong && w.trang_thai)
    : warehouses.filter(w => w.trang_thai)

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: matId,
      ten_hang: mat.ten,
      don_vi: mat.dvt,
      don_gia: mat.gia_mua || 0,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang,
        don_vi: it.don_vi || 'Kg',
        so_luong: it.so_luong,
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (items.length === 0) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        warehouse_id: v.warehouse_id,
        ngay: v.ngay.format('YYYY-MM-DD'),
        loai_nhap: v.loai_nhap,
        nha_cung_cap_id: v.nha_cung_cap_id || null,
        ghi_chu: v.ghi_chu || undefined,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160, render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    { title: 'Kho nhập', dataIndex: 'ten_kho', width: 160 },
    { title: 'Loại nhập', dataIndex: 'loai_nhap', width: 120, render: (v: string) => <Tag color="blue">{LOAI_NHAP_LABELS[v] ?? v}</Tag> },
    { title: 'Nhà CC', dataIndex: 'ten_ncc', width: 140, render: (v: string | null) => v || '—' },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 140, align: 'right' as const, render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'TT', dataIndex: 'trang_thai', width: 100, render: (v: string) => <Tag color={v === 'da_duyet' ? 'green' : 'default'}>{v === 'da_duyet' ? 'Đã duyệt' : 'Nhập'}</Tag> },
    {
      title: '', width: 50,
      render: (_: unknown, r: PhieuNhapKho) => (
        <Popconfirm title="Xoá phiếu nhập này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }} disabled={r.trang_thai !== 'nhap'}>
          <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai !== 'nhap'} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: PhieuNhapKho) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'don_vi', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const, render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><InboxOutlined style={{ fontSize: 20, color: '#1677ff' }} /><Title level={4} style={{ margin: 0 }}>Nhập kho</Title></Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
            Tạo phiếu nhập
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong}
              onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
              options={phanXuongs.map((x: any) => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={filteredWarehouses.map(w => ({ value: w.id, label: w.ten_kho }))} />
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
        <Table dataSource={phieuList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu nhập kho" width={760}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu nhập</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ loai_nhap: 'mua_hang', ngay: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho nhập" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho" options={warehouses.filter(w => w.trang_thai).map(w => ({ value: w.id, label: w.ten_kho }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay" label="Ngày nhập" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="loai_nhap" label="Loại nhập">
                <Select options={LOAI_NHAP_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Text strong>Danh sách hàng nhập</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    onClick={() => add({ loai_vat_tu: 'giay', don_vi: 'Kg', don_gia: 0 })}>
                    Thêm dòng
                  </Button>
                </Row>

                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]}>
                      {/* Hàng 1: Loại + Chọn vật tư + ĐVT + Xoá */}
                      <Col span={5}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" style={{ marginBottom: 4 }}>
                          <Select size="small"
                            onChange={() => {
                              const items = form.getFieldValue('items') || []
                              const updated = [...items]
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', don_vi: 'Kg', don_gia: 0 }
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
                      <Col span={13}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu giấy" rules={[{ required: true, message: 'Chọn NL' }]} style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn nguyên liệu giấy..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={paperMats.filter(m => m.su_dung).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'giay', id)}
                                />
                              </Form.Item>
                            )
                            if (loai === 'khac') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu khác" rules={[{ required: true, message: 'Chọn NL' }]} style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn nguyên liệu khác..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={otherMats.filter(m => m.trang_thai).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'khac', id)}
                                />
                              </Form.Item>
                            )
                            return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true, message: 'Nhập tên' }]} style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Nhập tên hàng tự do..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'don_vi']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={DON_VI_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>

                      {/* Hàng 2: Số lượng + Đơn giá + Ghi chú */}
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

                {fields.length === 0 && (
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ loai_vat_tu: 'giay', don_vi: 'Kg', don_gia: 0 })}>
                    Thêm dòng hàng
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
