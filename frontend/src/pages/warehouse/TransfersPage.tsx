import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, SwapOutlined, ArrowRightOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  warehouseApi, PhieuChuyenKho, CreatePhieuChuyenPayload, TonKho,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'

const { Title, Text } = Typography

export default function TransfersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterXuongNguon, setFilterXuongNguon] = useState<number | undefined>()
  const [filterXuongDich, setFilterXuongDich] = useState<number | undefined>()
  const [filterKhoXuat, setFilterKhoXuat] = useState<number | undefined>()
  const [filterKhoNhap, setFilterKhoNhap] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedKhoXuat, setSelectedKhoXuat] = useState<number | undefined>()
  const [selectedKhoNhap, setSelectedKhoNhap] = useState<number | undefined>()

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phieuList = [], isLoading } = useQuery({
    queryKey: ['phieu-chuyen', filterKhoXuat, filterKhoNhap, tuNgay, denNgay],
    queryFn: () => warehouseApi.listPhieuChuyen({
      warehouse_xuat_id: filterKhoXuat, warehouse_nhap_id: filterKhoNhap, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const { data: tonKhoXuat = [] } = useQuery({
    queryKey: ['ton-kho-chuyen', selectedKhoXuat],
    queryFn: () => selectedKhoXuat
      ? warehouseApi.getTonKho({ warehouse_id: selectedKhoXuat }).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedKhoXuat,
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePhieuChuyenPayload) => warehouseApi.createPhieuChuyen(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-chuyen'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu chuyển kho')
      setOpen(false)
      form.resetFields()
      setSelectedKhoXuat(undefined)
      setSelectedKhoNhap(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deletePhieuChuyen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phieu-chuyen'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu chuyển')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá phiếu'),
  })

  const activeWarehouses = warehouses.filter(w => w.trang_thai)
  const khoXuatOptions = activeWarehouses
    .filter(w => !filterXuongNguon || w.phan_xuong_id === filterXuongNguon)
    .map(w => {
      const px = phanXuongs.find((x: any) => x.id === w.phan_xuong_id)
      return { value: w.id, label: px ? `${w.ten_kho} (${px.ten_xuong})` : w.ten_kho }
    })
  const khoNhapOptions = activeWarehouses
    .filter(w => !filterXuongDich || w.phan_xuong_id === filterXuongDich)
    .map(w => {
      const px = phanXuongs.find((x: any) => x.id === w.phan_xuong_id)
      return { value: w.id, label: px ? `${w.ten_kho} (${px.ten_xuong})` : w.ten_kho }
    })

  const getPhanXuongName = (wid: number) => {
    const w = warehouses.find(x => x.id === wid)
    if (!w?.phan_xuong_id) return null
    return phanXuongs.find((x: any) => x.id === w.phan_xuong_id)?.ten_xuong ?? null
  }

  const handleTonKhoSelect = (itemName: number, tonKhoId: number) => {
    const t = tonKhoXuat.find(x => x.id === tonKhoId)
    if (!t) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      ton_kho_id: tonKhoId,
      paper_material_id: t.paper_material_id,
      other_material_id: t.other_material_id,
      ten_hang: t.ten_hang,
      don_vi: t.don_vi,
      don_gia: t.don_gia_binh_quan,
      _ton_luong: t.ton_luong,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      if (v.warehouse_xuat_id === v.warehouse_nhap_id) {
        message.error('Kho xuất và kho nhận không được trùng nhau')
        return
      }
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.paper_material_id || null,
        other_material_id: it.other_material_id || null,
        ten_hang: it.ten_hang,
        don_vi: it.don_vi || 'Kg',
        so_luong: it.so_luong,
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (items.length === 0) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        warehouse_xuat_id: v.warehouse_xuat_id,
        warehouse_nhap_id: v.warehouse_nhap_id,
        ngay: v.ngay.format('YYYY-MM-DD'),
        ghi_chu: v.ghi_chu || undefined,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160, render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    {
      title: 'Chiều chuyển', width: 300,
      render: (_: unknown, r: PhieuChuyenKho) => (
        <Space>
          <Tag color="blue">{r.ten_kho_xuat}</Tag>
          <ArrowRightOutlined style={{ color: '#722ed1' }} />
          <Tag color="purple">{r.ten_kho_nhap}</Tag>
        </Space>
      ),
    },
    { title: 'TT', dataIndex: 'trang_thai', width: 100, render: (v: string) => <Tag color={v === 'da_duyet' ? 'green' : 'default'}>{v === 'da_duyet' ? 'Đã duyệt' : 'Nhập'}</Tag> },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
    {
      title: '', width: 50,
      render: (_: unknown, r: PhieuChuyenKho) => (
        <Popconfirm title="Xoá phiếu chuyển này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }} disabled={r.trang_thai !== 'nhap'}>
          <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai !== 'nhap'} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: PhieuChuyenKho) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'don_vi', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const, render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—' },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><SwapOutlined style={{ fontSize: 20, color: '#722ed1' }} /><Title level={4} style={{ margin: 0 }}>Chuyển kho liên xưởng</Title></Space>
        </Col>
        <Col>
          <Button icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setSelectedKhoXuat(undefined); setSelectedKhoNhap(undefined); setOpen(true) }}
            style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}>
            Tạo phiếu chuyển
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Xưởng nguồn" style={{ width: '100%' }} allowClear value={filterXuongNguon}
              onChange={v => { setFilterXuongNguon(v); setFilterKhoXuat(undefined) }}
              options={(phanXuongs as any[]).map(x => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Xưởng đích" style={{ width: '100%' }} allowClear value={filterXuongDich}
              onChange={v => { setFilterXuongDich(v); setFilterKhoNhap(undefined) }}
              options={(phanXuongs as any[]).map(x => ({ value: x.id, label: x.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Kho xuất" style={{ width: '100%' }} allowClear value={filterKhoXuat} onChange={setFilterKhoXuat}
              options={khoXuatOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Kho nhận" style={{ width: '100%' }} allowClear value={filterKhoNhap} onChange={setFilterKhoNhap}
              options={khoNhapOptions} />
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

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu chuyển kho" width={760}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button loading={createMut.isPending} onClick={handleSubmit}
              style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}>
              Lưu phiếu chuyển
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay: dayjs() }}>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Phiếu chuyển kho tự động giảm tồn kho nguồn và tăng tồn kho đích trong cùng một giao dịch." />

          <Row gutter={12} align="bottom">
            <Col span={11}>
              <Form.Item name="warehouse_xuat_id" label="Kho xuất (nguồn)" rules={[{ required: true, message: 'Chọn kho xuất' }]}>
                <Select placeholder="Chọn kho xuất"
                  options={activeWarehouses.filter(w => w.id !== selectedKhoNhap).map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={v => { setSelectedKhoXuat(v); form.setFieldValue('items', []) }}
                />
              </Form.Item>
              {selectedKhoXuat && getPhanXuongName(selectedKhoXuat) && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -10, marginBottom: 8 }}>
                  {getPhanXuongName(selectedKhoXuat)}
                </Text>
              )}
            </Col>
            <Col span={2} style={{ textAlign: 'center', paddingBottom: 24 }}>
              <ArrowRightOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            </Col>
            <Col span={11}>
              <Form.Item name="warehouse_nhap_id" label="Kho nhận (đích)" rules={[{ required: true, message: 'Chọn kho nhận' }]}>
                <Select placeholder="Chọn kho nhận"
                  options={activeWarehouses.filter(w => w.id !== selectedKhoXuat).map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={v => setSelectedKhoNhap(v)}
                />
              </Form.Item>
              {selectedKhoNhap && getPhanXuongName(selectedKhoNhap) && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -10, marginBottom: 8 }}>
                  {getPhanXuongName(selectedKhoNhap)}
                </Text>
              )}
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay" label="Ngày chuyển" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          {!selectedKhoXuat && (
            <div style={{ color: '#faad14', marginBottom: 12, fontSize: 13 }}>
              ← Chọn kho xuất trước để thấy danh sách tồn kho
            </div>
          )}

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Text strong>Danh sách hàng chuyển</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    disabled={!selectedKhoXuat}
                    onClick={() => add({ don_vi: 'Kg', don_gia: 0 })}>
                    Thêm dòng
                  </Button>
                </Row>

                {fields.map(({ key, name }) => {
                  const items = form.getFieldValue('items') || []
                  const item = items[name] || {}
                  const tonHienTai: TonKho | undefined = tonKhoXuat.find(t => t.id === item.ton_kho_id)

                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                      <Row gutter={[8, 4]}>
                        <Col span={16}>
                          <Form.Item name={[name, 'ton_kho_id']} label="Chọn hàng chuyển"
                            rules={[{ required: true, message: 'Chọn mặt hàng' }]} style={{ marginBottom: 4 }}>
                            <Select size="small" showSearch placeholder="Chọn từ tồn kho xuất..."
                              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                              options={tonKhoXuat.map(t => ({
                                value: t.id,
                                label: `${t.ten_hang} — tồn: ${t.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${t.don_vi}`,
                              }))}
                              onChange={id => handleTonKhoSelect(name, id)}
                            />
                          </Form.Item>
                          {tonHienTai && (
                            <div style={{ fontSize: 12, color: '#666', marginTop: -8, marginBottom: 4 }}>
                              Tồn kho xuất: <Text strong style={{ color: '#722ed1' }}>
                                {tonHienTai.ton_luong.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} {tonHienTai.don_vi}
                              </Text>
                            </div>
                          )}
                        </Col>
                        <Col span={7}>
                          <Form.Item name={[name, 'don_vi']} label="ĐVT" style={{ marginBottom: 4 }}>
                            <Input size="small" readOnly style={{ background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                          <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                        </Col>

                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong']} label="Số lượng chuyển"
                            rules={[
                              { required: true, message: 'Nhập SL' },
                              {
                                validator: (_, val) => {
                                  if (!val || !tonHienTai) return Promise.resolve()
                                  if (val > tonHienTai.ton_luong)
                                    return Promise.reject(`Vượt tồn (${tonHienTai.ton_luong.toFixed(3)})`)
                                  return Promise.resolve()
                                },
                              },
                            ]}
                            style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'don_gia']} label="Đơn giá (BQ)" style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0} readOnly style={{ width: '100%', background: '#f5f5f5' }}
                              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                            <Input size="small" placeholder="..." />
                          </Form.Item>
                        </Col>

                        {/* Hidden fields */}
                        <Form.Item name={[name, 'paper_material_id']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'other_material_id']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'ten_hang']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, '_ton_luong']} hidden><Input /></Form.Item>
                      </Row>
                    </Card>
                  )
                })}

                {fields.length === 0 && selectedKhoXuat && tonKhoXuat.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#bbb', padding: 24 }}>Kho xuất chưa có tồn kho</div>
                )}
                {fields.length === 0 && selectedKhoXuat && tonKhoXuat.length > 0 && (
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ don_vi: 'Kg', don_gia: 0 })}>
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
