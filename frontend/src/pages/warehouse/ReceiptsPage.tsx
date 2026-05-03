import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message, Divider,
} from 'antd'
import { PlusOutlined, DeleteOutlined, InboxOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateGoodsReceiptPayload, GoodsReceipt } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { purchaseApi } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'

const { Title, Text } = Typography

const LOAI_NHAP_OPTIONS = [
  { value: 'MUA_HANG', label: 'Mua hàng' },
  { value: 'TRA_SX', label: 'Trả sản xuất' },
  { value: 'DIEU_CHINH', label: 'Điều chỉnh' },
]

const KET_QUA_OPTIONS = [
  { value: 'DAT', label: 'Đạt' },
  { value: 'KHONG_DAT', label: 'Không đạt' },
  { value: 'CHO_KIEM_TRA', label: 'Chờ kiểm tra' },
]

export default function ReceiptsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedPO, setSelectedPO] = useState<number | undefined>()
  const [formPxId, setFormPxId] = useState<number | null>(null)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
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

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: poList = [] } = useQuery({
    queryKey: ['purchase-orders-da-duyet'],
    queryFn: () => purchaseApi.list({ trang_thai: 'da_duyet' }).then(r => r.data),
    staleTime: 60_000,
  })

  const { data: poDetail } = useQuery({
    queryKey: ['purchase-order-detail', selectedPO],
    queryFn: () => selectedPO ? purchaseApi.get(selectedPO).then(r => r.data) : null,
    enabled: !!selectedPO,
  })

  const { data: receiptList = [], isLoading } = useQuery({
    queryKey: ['goods-receipts', filterKho, filterNCC, tuNgay, denNgay],
    queryFn: () => warehouseApi.listGoodsReceipts({
      warehouse_id: filterKho, supplier_id: filterNCC, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateGoodsReceiptPayload) => warehouseApi.createGoodsReceipt(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders-da-duyet'] })
      message.success('Đã tạo phiếu nhập kho')
      setOpen(false)
      form.resetFields()
      setSelectedPO(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu nhập')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handlePOSelect = (poId: number) => {
    setSelectedPO(poId)
  }

  useEffect(() => {
    if (!poDetail) return
    form.setFieldsValue({
      supplier_id: poDetail.supplier_id,
      items: (poDetail.items || []).map((it: any) => ({
        loai_vat_tu: it.paper_material_id ? 'giay' : it.other_material_id ? 'khac' : 'tu_do',
        mat_id: it.paper_material_id || it.other_material_id,
        po_item_id: it.id,
        ten_hang: it.ten_hang,
        so_luong: it.so_luong,
        dvt: it.dvt,
        don_gia: it.don_gia,
        ket_qua_kiem_tra: 'DAT',
      })),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poDetail])

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: matId,
      ten_hang: mat.ten,
      dvt: mat.dvt,
      don_gia: mat.gia_mua || 0,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        po_item_id: it.po_item_id || null,
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        dinh_luong_thuc_te: it.dinh_luong_thuc_te || null,
        do_am: it.do_am || null,
        ket_qua_kiem_tra: it.ket_qua_kiem_tra || 'DAT',
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        ngay_nhap: v.ngay_nhap.format('YYYY-MM-DD'),
        po_id: v.po_id || null,
        supplier_id: v.supplier_id,
        warehouse_id: v.warehouse_id,
        loai_nhap: v.loai_nhap || 'MUA_HANG',
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation shown inline */ }
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110 },
    { title: 'Kho nhập', dataIndex: 'ten_kho', width: 150 },
    { title: 'Nhà CC', dataIndex: 'ten_ncc', width: 150 },
    { title: 'Loại nhập', dataIndex: 'loai_nhap', width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tổng tiền', dataIndex: 'tong_gia_tri', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'TT', dataIndex: 'trang_thai', width: 90,
      render: (v: string) => <Tag color={v === 'da_duyet' ? 'green' : 'default'}>{v === 'da_duyet' ? 'Đã duyệt' : 'Nhập'}</Tag> },
    {
      title: '', width: 50,
      render: (_: unknown, r: GoodsReceipt) => (
        <Popconfirm title="Xoá phiếu nhập?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
          disabled={r.trang_thai !== 'nhap'}>
          <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai !== 'nhap'} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: GoodsReceipt) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 100, align: 'right' as const,
          render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
          render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN')}đ</Text> },
        { title: 'KQ kiểm tra', dataIndex: 'ket_qua_kiem_tra', width: 130,
          render: (v: string) => (
            <Tag color={v === 'DAT' ? 'green' : v === 'KHONG_DAT' ? 'red' : 'orange'}>
              {v === 'DAT' ? 'Đạt' : v === 'KHONG_DAT' ? 'Không đạt' : 'Chờ KT'}
            </Tag>
          ) },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><InboxOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Phiếu nhập kho</Title>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setSelectedPO(undefined); setFormPxId(null); setOpen(true) }}>
            Tạo phiếu nhập
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong}
              onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
              options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouses
                .filter(w => w.trang_thai && (!filterXuong || w.phan_xuong_id === filterXuong))
                .map(w => ({ value: w.id, label: w.ten_kho }))} />
          </Col>
          <Col xs={12} sm={5}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={5}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={receiptList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 950 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu nhập kho" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu nhập</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ loai_nhap: 'MUA_HANG', ngay_nhap: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="po_id" label="Liên kết đơn mua (tuỳ chọn)">
                <Select placeholder="Chọn PO để auto-fill..." allowClear showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={poList.map(p => ({ value: p.id, label: `${p.so_po} — ${p.ten_ncc}` }))}
                  onChange={v => v ? handlePOSelect(v) : undefined}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                <Select placeholder="Chọn nhà cung cấp..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="loai_nhap" label="Loại nhập">
                <Select options={LOAI_NHAP_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Xưởng (để lọc kho)">
                <Select placeholder="Chọn xưởng..." allowClear
                  value={formPxId ?? undefined}
                  onChange={v => { setFormPxId(v ?? null); form.setFieldValue('warehouse_id', undefined) }}
                  options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho nhập" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho"
                  options={warehouses
                    .filter(w => w.trang_thai && (!formPxId || w.phan_xuong_id === formPxId))
                    .map(w => ({ value: w.id, label: `${w.ten_kho}${w.loai_kho ? ` (${w.loai_kho})` : ''}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách hàng nhập</Divider>

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
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" style={{ marginBottom: 4 }}>
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
                      <Col span={6}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'ket_qua_kiem_tra']} label="Kết quả KT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={KET_QUA_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', don_gia: 0, ket_qua_kiem_tra: 'DAT' })}>
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
