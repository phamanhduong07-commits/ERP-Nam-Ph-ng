import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip,
  Typography, message,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, MinusCircleOutlined,
  PlusOutlined, ToolOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import { purchaseApi } from '../../api/purchase'
import type { PurchaseOrder } from '../../api/purchase'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoNVLRow } from '../../api/warehouse'
import { suppliersApi } from '../../api/suppliers'
import { otherMaterialsApi } from '../../api/otherMaterials'
import type { OtherMaterialSearchResult } from '../../api/otherMaterials'
import { purchaseInvoiceApi } from '../../api/accounting'

const { Title, Text } = Typography

const fmtVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v)

const TRANG_THAI_COLOR: Record<string, string> = {
  moi: 'default', da_duyet: 'blue', da_gui_ncc: 'cyan',
  dang_giao: 'orange', hoan_thanh: 'green', huy: 'red',
}
const TRANG_THAI_LABEL: Record<string, string> = {
  moi: 'Mới', da_duyet: 'Đã duyệt', da_gui_ncc: 'Đã gửi NCC',
  dang_giao: 'Đang giao', hoan_thanh: 'Hoàn thành', huy: 'Huỷ',
}
const DIEU_KHOAN_OPTIONS = ['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'TT trước'].map(v => ({ value: v, label: v }))

// ── Tab 1: Đơn mua NVL ───────────────────────────────────────────────────────

function TabDonMuaNVL() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [form] = Form.useForm()
  const [matSearchResults, setMatSearchResults] = useState<Record<number, OtherMaterialSearchResult[]>>({})
  const [openChonNL, setOpenChonNL] = useState(false)
  const [chonNLSelected, setChonNLSelected] = useState<number[]>([])
  const [chonNLSearch, setChonNLSearch] = useState('')

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: poList = [], isLoading } = useQuery({
    queryKey: ['purchase-orders-nvl', filterXuong, filterNCC, filterTrangThai],
    queryFn: () => purchaseApi.list({
      loai_po: 'nvl_khac',
      phan_xuong_id: filterXuong,
      supplier_id: filterNCC,
      trang_thai: filterTrangThai,
    }).then(r => r.data),
  })

  const currentSupplierId = Form.useWatch('supplier_id', form)

  const { data: nvlByNCC = [] } = useQuery({
    queryKey: ['other-materials-by-ncc', currentSupplierId],
    queryFn: () =>
      otherMaterialsApi.list({ ma_ncc_id: currentSupplierId, page_size: 500 }).then(r => r.data.items),
    enabled: !!currentSupplierId,
    staleTime: 120_000,
  })

  const filteredChonNL = nvlByNCC.filter(m => {
    if (!chonNLSearch) return true
    const q = chonNLSearch.toLowerCase()
    return m.ma_chinh.toLowerCase().includes(q) || m.ten.toLowerCase().includes(q)
  })

  const applyChonNL = () => {
    const selected = nvlByNCC.filter(m => chonNLSelected.includes(m.id))
    const current = form.getFieldValue('items') || []
    const newRows = selected.map(m => ({
      other_material_id: m.id,
      ten_hang: m.ten,
      dvt: m.dvt || 'Cái',
      don_gia: Number(m.gia_mua) || 0,
      so_luong: null,
      ghi_chu: null,
    }))
    form.setFieldValue('items', [...current, ...newRows])
    setOpenChonNL(false)
    setChonNLSelected([])
    setChonNLSearch('')
  }

  const createMut = useMutation({
    mutationFn: (data: any) => purchaseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-nvl'] })
      message.success('Đã tạo đơn mua NVL')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo PO'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => purchaseApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-nvl'] })
      message.success('Đã duyệt')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-nvl'] })
      message.success('Đã xoá')
    },
  })

  const createInvoiceMut = useMutation({
    mutationFn: (id: number) => purchaseInvoiceApi.fromPO(id),
    onSuccess: () => message.success('Đã tạo hóa đơn'),
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo HĐ'),
  })

  const handleMatSearch = async (idx: number, q: string) => {
    if (!q || q.length < 1) return
    try {
      const res = await otherMaterialsApi.search({ q, limit: 20 })
      setMatSearchResults(prev => ({ ...prev, [idx]: res.data }))
    } catch { /* ignore */ }
  }

  const handleMatSelect = (itemIdx: number, matId: number) => {
    const opts = matSearchResults[itemIdx] ?? []
    const mat = opts.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemIdx] = {
      ...updated[itemIdx],
      other_material_id: matId,
      ten_hang: mat.ten,
      dvt: mat.dvt || 'Cái',
      don_gia: mat.gia_mua || 0,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: null,
        other_material_id: it.other_material_id || null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Cái',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng vật tư'); return }
      createMut.mutate({
        supplier_id: v.supplier_id,
        ngay_po: v.ngay_po.format('YYYY-MM-DD'),
        phan_xuong_id: v.phan_xuong_id || null,
        loai_po: 'nvl_khac',
        ngay_du_kien_nhan: v.ngay_du_kien_nhan ? v.ngay_du_kien_nhan.format('YYYY-MM-DD') : null,
        dieu_khoan_tt: v.dieu_khoan_tt || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation inline */ }
  }

  const expandedRowRender = (r: PurchaseOrder) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên vật tư', dataIndex: 'ten_hang', ellipsis: true },
        { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
        { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right' as const,
          render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
          render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
          render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  const columns = [
    { title: 'Số PO', dataIndex: 'so_po', width: 160,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay_po', width: 100 },
    { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 120,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Tổng tiền', dataIndex: 'tong_tien', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: (v: string) => <Tag color={TRANG_THAI_COLOR[v] || 'default'}>{TRANG_THAI_LABEL[v] || v}</Tag> },
    { title: '', width: 120,
      render: (_: unknown, r: PurchaseOrder) => (
        <Space size={4}>
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Duyệt đơn này?" onConfirm={() => approveMut.mutate(r.id)}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
            </Popconfirm>
          )}
          {r.trang_thai === 'moi' && (
            <Popconfirm title="Xoá?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
          {['da_duyet', 'hoan_thanh'].includes(r.trang_thai) && (
            <Tooltip title="Tạo hóa đơn">
              <Button size="small" type="link" loading={createInvoiceMut.isPending}
                onClick={() => createInvoiceMut.mutate(r.id)}>HĐ</Button>
            </Tooltip>
          )}
        </Space>
      ) },
  ]

  return (
    <>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col>
          <Select placeholder="Tất cả xưởng" allowClear style={{ width: 160 }}
            value={filterXuong} onChange={setFilterXuong}
            options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))} />
        </Col>
        <Col>
          <Select placeholder="Tất cả NCC" allowClear showSearch style={{ width: 200 }}
            optionFilterProp="label"
            value={filterNCC} onChange={setFilterNCC}
            options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))} />
        </Col>
        <Col>
          <Select placeholder="Trạng thái" allowClear style={{ width: 140 }}
            value={filterTrangThai} onChange={setFilterTrangThai}
            options={Object.entries(TRANG_THAI_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
        </Col>
        <Col flex="auto" style={{ textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true) }}>
            Tạo đơn mua NVL
          </Button>
        </Col>
      </Row>

      <Table dataSource={poList} columns={columns} rowKey="id" loading={isLoading}
        size="small" expandable={{ expandedRowRender }}
        pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />

      <Modal
        open={openChonNL}
        title="Chọn nhanh vật tư theo NCC"
        width={700}
        okText={`Thêm ${chonNLSelected.length > 0 ? `(${chonNLSelected.length})` : ''} vào đơn`}
        cancelText="Huỷ"
        onOk={applyChonNL}
        onCancel={() => { setOpenChonNL(false); setChonNLSelected([]); setChonNLSearch('') }}
        okButtonProps={{ disabled: chonNLSelected.length === 0 }}
      >
        <Input.Search
          placeholder="Tìm mã/tên vật tư..."
          allowClear
          style={{ marginBottom: 10 }}
          value={chonNLSearch}
          onChange={e => setChonNLSearch(e.target.value)}
          onSearch={v => setChonNLSearch(v)}
        />
        <Table
          rowKey="id"
          size="small"
          dataSource={filteredChonNL}
          pagination={{ pageSize: 10, size: 'small' }}
          rowSelection={{
            selectedRowKeys: chonNLSelected,
            onChange: keys => setChonNLSelected(keys as number[]),
          }}
          columns={[
            { title: 'Mã VT', dataIndex: 'ma_chinh', width: 110 },
            { title: 'Tên vật tư', dataIndex: 'ten', ellipsis: true },
            { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
            {
              title: 'Giá mua',
              dataIndex: 'gia_mua',
              width: 110,
              align: 'right' as const,
              render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—',
            },
          ]}
        />
      </Modal>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo đơn mua NVL khác"
        width={860}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu đơn</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_po: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                <Select placeholder="Chọn NCC..." showSearch optionFilterProp="label"
                  options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phan_xuong_id" label="Xưởng nhận" rules={[{ required: true, message: 'Chọn xưởng' }]}>
                <Select placeholder="Chọn xưởng..." showSearch optionFilterProp="label"
                  options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
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
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input placeholder="Ghi chú..." />
          </Form.Item>

          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              icon={<ThunderboltOutlined />}
              size="small"
              disabled={!currentSupplierId}
              onClick={() => { setOpenChonNL(true); setChonNLSelected([]); setChonNLSearch('') }}
            >
              Chọn nhanh NL
            </Button>
          </div>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#f0f5ff' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={14}>
                        <Form.Item name={[name, 'other_material_id']} label="Mã vật tư"
                          style={{ marginBottom: 4 }}>
                          <Select size="small" showSearch placeholder="Tìm mã/tên vật tư..."
                            optionFilterProp={currentSupplierId ? 'label' : undefined}
                            filterOption={currentSupplierId ? true : false}
                            options={currentSupplierId
                              ? nvlByNCC.map(m => ({
                                  value: m.id,
                                  label: `${m.ma_chinh} – ${m.ten}`,
                                }))
                              : (matSearchResults[name] ?? []).map(m => ({
                                  value: m.id,
                                  label: `${m.value} – ${m.ten}`,
                                }))
                            }
                            onSearch={currentSupplierId ? undefined : (q => handleMatSearch(name, q))}
                            onChange={id => handleMatSelect(name, id)} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="Cái/Kg/Lít..." />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={10}>
                        <Form.Item name={[name, 'ten_hang']} label="Tên vật tư"
                          rules={[{ required: true, message: 'Nhập tên VT' }]} style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="Tên vật tư..." />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng"
                          rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="Ghi chú dòng..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ dvt: 'Cái', don_gia: 0 })}>
                  Thêm dòng vật tư
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </>
  )
}

// ── Tab 2: Tồn kho NVL ───────────────────────────────────────────────────────

function TabTonKhoNVL() {
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [search, setSearch] = useState('')

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ton-kho-nvl', filterXuong, search],
    queryFn: () => warehouseApi.getTonKhoNVL({ phan_xuong_id: filterXuong, search: search || undefined }).then(r => r.data),
    staleTime: 60_000,
  })

  const tongGt = rows.reduce((s, r) => s + r.gia_tri_ton, 0)

  const columns = [
    { title: 'Mã VT', dataIndex: 'ma_chinh', width: 110,
      render: (v: string | null) => <Text code>{v || '—'}</Text> },
    { title: 'Tên vật tư', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 70 },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 130,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Kho', dataIndex: 'ten_kho', width: 160, ellipsis: true },
    { title: 'Tồn', dataIndex: 'ton_luong', width: 110, align: 'right' as const,
      render: (v: number, r: TonKhoNVLRow) => (
        <Text strong style={{ color: v < r.ton_toi_thieu ? '#f5222d' : undefined }}>
          {fmtVND(v)}
        </Text>
      ) },
    { title: 'Tối thiểu', dataIndex: 'ton_toi_thieu', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) : '—' },
    { title: 'Đơn giá BQ', dataIndex: 'don_gia_binh_quan', width: 120, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—' },
    { title: 'Giá trị tồn', dataIndex: 'gia_tri_ton', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text> },
  ]

  return (
    <>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Input.Search
            placeholder="Tìm mã/tên vật tư..."
            allowClear
            style={{ width: 220 }}
            onSearch={v => setSearch(v)}
          />
        </Col>
        <Col>
          <Select placeholder="Tất cả xưởng" allowClear style={{ width: 200 }}
            value={filterXuong} onChange={setFilterXuong}
            options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))} />
        </Col>
        <Col flex="auto">
          <Statistic title="Tổng giá trị tồn" value={tongGt} precision={0}
            formatter={v => fmtVND(Number(v)) + 'đ'} valueStyle={{ fontSize: 16, color: '#1677ff' }} />
        </Col>
      </Row>
      <Table dataSource={rows} columns={columns}
        rowKey={(r: TonKhoNVLRow) => `${r.warehouse_id}-${r.other_material_id}`}
        loading={isLoading} size="small"
        rowClassName={(r: TonKhoNVLRow) => r.ton_luong < r.ton_toi_thieu ? 'ant-table-row-warning' : ''}
        pagination={{ pageSize: 30, showSizeChanger: true }}
        scroll={{ x: 1000 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={8}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right"><Text strong>{fmtVND(tongGt)}đ</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </>
  )
}

// ── Tab 3: Lịch sử NCC ───────────────────────────────────────────────────────

function TabLichSuNCCNVL() {
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterMaVT, setFilterMaVT] = useState<string | undefined>()

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: allPOs = [], isLoading } = useQuery({
    queryKey: ['purchase-orders-nvl-all'],
    queryFn: () => purchaseApi.list({ loai_po: 'nvl_khac' }).then(r => r.data),
    staleTime: 120_000,
  })

  const historyRows = allPOs.flatMap(po =>
    po.items.map((it, i) => ({
      key: `${po.id}-${i}`,
      ngay_po: po.ngay_po,
      ten_ncc: po.ten_ncc,
      supplier_id: po.supplier_id,
      ten_hang: it.ten_hang,
      so_luong: it.so_luong,
      dvt: it.dvt,
      don_gia: it.don_gia,
      thanh_tien: it.thanh_tien || 0,
      trang_thai: po.trang_thai,
    }))
  ).filter(r => {
    if (filterNCC && r.supplier_id !== filterNCC) return false
    if (filterMaVT && !r.ten_hang.toLowerCase().includes(filterMaVT.toLowerCase())) return false
    return true
  }).sort((a, b) => b.ngay_po.localeCompare(a.ngay_po))

  const maVTOptions = Array.from(new Set(allPOs.flatMap(po => po.items.map(it => it.ten_hang))))
    .filter(Boolean).map(v => ({ value: v, label: v }))

  return (
    <>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col>
          <Select placeholder="Tất cả NCC" allowClear showSearch style={{ width: 220 }}
            optionFilterProp="label" value={filterNCC} onChange={setFilterNCC}
            options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))} />
        </Col>
        <Col>
          <Select placeholder="Tất cả vật tư" allowClear showSearch style={{ width: 220 }}
            value={filterMaVT} onChange={setFilterMaVT}
            options={maVTOptions} />
        </Col>
      </Row>
      <Table dataSource={historyRows} rowKey="key" loading={isLoading} size="small"
        pagination={{ pageSize: 30, showSizeChanger: true }}
        columns={[
          { title: 'Ngày PO', dataIndex: 'ngay_po', width: 100 },
          { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', width: 180, ellipsis: true },
          { title: 'Tên vật tư', dataIndex: 'ten_hang', ellipsis: true },
          { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
          { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right' as const,
            render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
          { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
            render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—' },
          { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
            render: (v: number) => <Text strong>{fmtVND(v)}đ</Text> },
          { title: 'Trạng thái', dataIndex: 'trang_thai', width: 100,
            render: (v: string) => <Tag color={TRANG_THAI_COLOR[v] || 'default'}>{TRANG_THAI_LABEL[v] || v}</Tag> },
        ]}
      />
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MuaNVLPage() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <ToolOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Mua NVL Khác</Title>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Tabs
          defaultActiveKey="don-mua"
          items={[
            { key: 'don-mua', label: 'Đơn mua NVL', children: <TabDonMuaNVL /> },
            { key: 'ton-kho', label: 'Tồn kho NVL', children: <TabTonKhoNVL /> },
            { key: 'lich-su-ncc', label: 'Lịch sử NCC', children: <TabLichSuNCCNVL /> },
          ]}
        />
      </Card>
    </div>
  )
}
