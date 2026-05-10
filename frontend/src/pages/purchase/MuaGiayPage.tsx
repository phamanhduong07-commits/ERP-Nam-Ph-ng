import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Badge, Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip,
  Typography, message,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, MinusCircleOutlined,
  PlusOutlined, ShopOutlined, ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons'
import { purchaseApi } from '../../api/purchase'
import type { PurchaseOrder, POItem } from '../../api/purchase'
import { warehouseApi } from '../../api/warehouse'
import type { TonKhoGiayRow, DuTruGiayRow, KHSXCanPhoiNgoaiRow } from '../../api/warehouse'
import { suppliersApi } from '../../api/suppliers'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
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

// ── Helpers phôi sóng ────────────────────────────────────────────────────────

const LOAI_LAN_LABEL: Record<string, string> = {
  lan_thuong: 'Lằn thường',
  lan_toc_do_cao: 'Lằn TC cao',
  lan_cat: 'Lằn cắt',
}

function cauTrucGiaySummary(r: KHSXCanPhoiNgoaiRow): string {
  const { so_lop, to_hop_song, mat, song_1, mat_1, song_2, mat_2, song_3, mat_3 } = r
  if (!so_lop || !mat) return '—'
  const parts: string[] = [mat]
  if (so_lop >= 3 && song_1) {
    parts.push(`${song_1}${to_hop_song?.[0] ?? 'B'}`)
    parts.push(mat_1 ?? '?')
  }
  if (so_lop >= 5 && song_2) {
    parts.push(`${song_2}${to_hop_song?.[1] ?? 'C'}`)
    parts.push(mat_2 ?? '?')
  }
  if (so_lop >= 7 && song_3) {
    parts.push(`${song_3}${to_hop_song?.[2] ?? 'D'}`)
    parts.push(mat_3 ?? '?')
  }
  return parts.join('/')
}

function qcclSummary(r: KHSXCanPhoiNgoaiRow): string {
  const parts = [
    r.c_tham,
    r.can_man,
    r.loai_lan ? (LOAI_LAN_LABEL[r.loai_lan] ?? r.loai_lan) : null,
  ].filter(Boolean)
  return parts.join(' ') || '—'
}

// ── Tab 1: Đơn mua giấy ──────────────────────────────────────────────────────

function TabDonMuaGiay() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filterLoaiGiay, setFilterLoaiGiay] = useState<'cuon' | 'phoi' | 'all'>('cuon')
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [openChonNL, setOpenChonNL] = useState(false)
  const [chonNLSelected, setChonNLSelected] = useState<number[]>([])
  const [chonNLNhom, setChonNLNhom] = useState<number | undefined>()
  const [chonNLSearch, setChonNLSearch] = useState('')
  const [form] = Form.useForm()
  const currentSupplierId = Form.useWatch('supplier_id', form)

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
  const { data: paperByNSX = [] } = useQuery({
    queryKey: ['paper-materials-by-nsx', currentSupplierId],
    queryFn: () =>
      paperMaterialsFullApi.list({ ma_nsx_id: currentSupplierId, page_size: 5000 }).then(r => r.data.items),
    enabled: !!currentSupplierId,
    staleTime: 120_000,
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 2000 }).then(r => r.data),
    staleTime: 300_000,
    enabled: !currentSupplierId,
  })
  const paperMats = currentSupplierId ? paperByNSX : (paperPage?.items ?? [])

  const materialGroups = Array.from(
    new Map(paperByNSX.filter(m => m.ma_nhom_id && m.ten_nhom).map(m => [m.ma_nhom_id, { id: m.ma_nhom_id, ten_nhom: m.ten_nhom }])).values()
  )

  const filteredChonNL = () => {
    return paperMats.filter(m => {
      if (chonNLNhom && m.ma_nhom_id !== chonNLNhom) return false
      if (chonNLSearch) {
        const s = chonNLSearch.toLowerCase()
        if (!m.ten?.toLowerCase().includes(s) && !m.ma_chinh?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }

  const applyChonNL = () => {
    const selected = paperMats.filter(m => chonNLSelected.includes(m.id))
    const currentItems = form.getFieldValue('items') || []
    const newRows = selected.map(m => ({
      paper_material_id: m.id,
      ten_hang: m.ten,
      dvt: m.dvt || 'Kg',
      don_gia: m.gia_mua ? Number(m.gia_mua) : 0,
      kho_mm: m.kho ? Number(m.kho) : null,
      so_cuon: null,
      ky_hieu_cuon: null,
    }))
    form.setFieldValue('items', [...currentItems, ...newRows])
    setOpenChonNL(false)
    setChonNLSelected([])
    setChonNLSearch('')
    setChonNLNhom(undefined)
  }

  const loaiPoParam = filterLoaiGiay === 'cuon' ? 'giay_cuon' : filterLoaiGiay === 'phoi' ? 'giay_tam' : undefined

  const { data: poList = [], isLoading } = useQuery({
    queryKey: ['purchase-orders-giay', filterLoaiGiay, filterXuong, filterNCC, filterTrangThai],
    queryFn: () => purchaseApi.list({
      loai_po: loaiPoParam,
      phan_xuong_id: filterXuong,
      supplier_id: filterNCC,
      trang_thai: filterTrangThai,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => purchaseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-giay'] })
      message.success('Đã tạo đơn mua giấy')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo PO'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => purchaseApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-giay'] })
      message.success('Đã duyệt')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => purchaseApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders-giay'] })
      message.success('Đã xoá')
    },
  })

  const createInvoiceMut = useMutation({
    mutationFn: (id: number) => purchaseInvoiceApi.fromPO(id),
    onSuccess: () => message.success('Đã tạo hóa đơn'),
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo HĐ'),
  })

  const handlePaperSelect = (itemIdx: number, pmId: number) => {
    const pm = paperMats.find(m => m.id === pmId)
    if (!pm) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemIdx] = {
      ...updated[itemIdx],
      paper_material_id: pmId,
      ten_hang: pm.ten,
      dvt: pm.dvt || 'Kg',
      don_gia: pm.gia_mua || 0,
      kho_mm: pm.kho ? Number(pm.kho) : null,
      kho_cm: pm.kho ? `${pm.kho} cm` : '',
      dinh_luong: pm.dinh_luong ? `${pm.dinh_luong} g/m²` : '',
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        paper_material_id: it.paper_material_id || null,
        other_material_id: null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
        kho_mm: it.kho_mm || null,
        so_cuon: it.so_cuon || null,
        ky_hieu_cuon: it.ky_hieu_cuon || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng giấy'); return }
      createMut.mutate({
        supplier_id: v.supplier_id,
        ngay_po: v.ngay_po.format('YYYY-MM-DD'),
        phan_xuong_id: v.phan_xuong_id || null,
        loai_po: 'giay_cuon',
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
        { title: 'Tên giấy', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'Số lượng (kg)', dataIndex: 'so_luong', width: 120, align: 'right' as const,
          render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
        { title: 'Đơn giá (đ/kg)', dataIndex: 'don_gia', width: 130, align: 'right' as const,
          render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—' },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
          render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text> },
        { title: 'Đã nhận', dataIndex: 'so_luong_da_nhan', width: 90, align: 'right' as const,
          render: (v: number, row: POItem) => {
            const pct = (row.so_luong || 0) > 0 ? Math.round((v || 0) / row.so_luong * 100) : 0
            return <Text type={pct >= 100 ? 'success' : undefined}>{pct}%</Text>
          } },
        { title: 'Khổ', dataIndex: 'kho_mm', width: 70, align: 'center' as const,
          render: (v: number | null) => v ? `${v}cm` : '—' },
        { title: 'Số cuộn', dataIndex: 'so_cuon', width: 80, align: 'right' as const,
          render: (v: number | null) => v ?? '—' },
        { title: 'Ký hiệu', dataIndex: 'ky_hieu_cuon', width: 80,
          render: (v: string | null) => v || '—' },
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
    { title: '', width: 110,
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
          <Radio.Group value={filterLoaiGiay} onChange={e => setFilterLoaiGiay(e.target.value)} optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value="cuon">Giấy cuộn</Radio.Button>
            <Radio.Button value="phoi">Phôi sóng</Radio.Button>
            <Radio.Button value="all">Tất cả</Radio.Button>
          </Radio.Group>
        </Col>
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
            Tạo đơn mua giấy
          </Button>
        </Col>
      </Row>

      <Table dataSource={poList} columns={columns} rowKey="id" loading={isLoading}
        size="small" expandable={{ expandedRowRender }}
        pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 900 }} />

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo đơn mua giấy cuộn"
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
            <Form.Item noStyle dependencies={['supplier_id']}>
              {({ getFieldValue }) => (
                <Button icon={<ThunderboltOutlined />} size="small"
                  style={{ color: '#1677ff', borderColor: '#1677ff' }}
                  onClick={() => { setChonNLSelected([]); setChonNLSearch(''); setChonNLNhom(undefined); setOpenChonNL(true) }}>
                  Chọn nhanh NL
                </Button>
              )}
            </Form.Item>
          </div>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#f6ffed' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={14}>
                        <Form.Item name={[name, 'paper_material_id']} label="Mã giấy"
                          rules={[{ required: true, message: 'Chọn mã giấy' }]} style={{ marginBottom: 4 }}>
                          <Select size="small" showSearch placeholder="Tìm mã giấy..."
                            optionFilterProp="label"
                            options={paperMats.map(m => ({
                              value: m.id,
                              label: `${m.ma_chinh || m.ten} — Khổ ${m.kho || '?'}cm ${m.dinh_luong || '?'}g/m²`,
                            }))}
                            onChange={id => handlePaperSelect(name, id)} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Kg', 'Tấn'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá (đ/kg)" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng (kg)"
                          rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'kho_mm']} label="Khổ (cm)" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="cm" />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'so_cuon']} label="Số cuộn" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={1} precision={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[name, 'ky_hieu_cuon']} label="Ký hiệu cuộn" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="VD: 98" />
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
                  onClick={() => add({ dvt: 'Kg', don_gia: 0 })}>
                  Thêm dòng giấy
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      <Modal
        open={openChonNL}
        title="Chọn nhanh nguyên liệu giấy"
        width={780}
        onCancel={() => { setOpenChonNL(false); setChonNLSelected([]) }}
        onOk={applyChonNL}
        okText={`Thêm ${chonNLSelected.length} dòng vào đơn`}
        okButtonProps={{ disabled: chonNLSelected.length === 0 }}
      >
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col span={10}>
            <Select placeholder="Lọc theo nhóm hàng..." allowClear style={{ width: '100%' }}
              value={chonNLNhom} onChange={setChonNLNhom}
              options={materialGroups.map(g => ({ value: g.id, label: g.ten_nhom }))} />
          </Col>
          <Col span={14}>
            <Input.Search placeholder="Tìm mã / tên nguyên liệu..." value={chonNLSearch}
              onChange={e => setChonNLSearch(e.target.value)} allowClear />
          </Col>
        </Row>
        <Table size="small" pagination={{ pageSize: 10, showSizeChanger: false }}
          dataSource={filteredChonNL()} rowKey="id"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: chonNLSelected,
            onChange: keys => setChonNLSelected(keys as number[]),
          }}
          columns={[
            { title: 'Mã NL', dataIndex: 'ma_chinh', width: 100 },
            { title: 'Tên', dataIndex: 'ten', ellipsis: true },
            { title: 'Khổ', dataIndex: 'kho', width: 70, align: 'right' as const,
              render: (v: number | null) => v ? `${v}cm` : '—' },
            { title: 'ĐL (g/m²)', dataIndex: 'dinh_luong', width: 90, align: 'right' as const,
              render: (v: number | null) => v ?? '—' },
            { title: 'Ký hiệu', dataIndex: 'ma_ky_hieu', width: 80,
              render: (v: string | null) => v || '—' },
            { title: 'Giá mua (đ/kg)', dataIndex: 'gia_mua', width: 120, align: 'right' as const,
              render: (v: number | null) => v ? v.toLocaleString('vi-VN') : '—' },
          ]}
        />
      </Modal>
    </>
  )
}

// ── Tab 2: Tồn kho giấy ──────────────────────────────────────────────────────

function TabTonKhoGiay() {
  const [filterXuong, setFilterXuong] = useState<number | undefined>()

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ton-kho-giay', filterXuong],
    queryFn: () => warehouseApi.getTonKhoGiay({ phan_xuong_id: filterXuong }).then(r => r.data),
    staleTime: 60_000,
  })

  const tongKg = rows.reduce((s, r) => s + r.ton_luong, 0)
  const tongGt = rows.reduce((s, r) => s + r.gia_tri_ton, 0)

  const columns = [
    { title: 'Mã giấy', dataIndex: 'ma_chinh', width: 100,
      render: (v: string | null) => <Text code>{v || '—'}</Text> },
    { title: 'Tên', dataIndex: 'ten', ellipsis: true },
    { title: 'Khổ (cm)', dataIndex: 'kho', width: 90, align: 'right' as const,
      render: (v: number | null) => v != null ? v : '—' },
    { title: 'ĐL (g/m²)', dataIndex: 'dinh_luong', width: 90, align: 'right' as const,
      render: (v: number | null) => v != null ? v : '—' },
    { title: 'Xưởng', dataIndex: 'ten_phan_xuong', width: 130,
      render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: 'Kho', dataIndex: 'ten_kho', width: 160, ellipsis: true },
    { title: 'Tồn (kg)', dataIndex: 'ton_luong', width: 110, align: 'right' as const,
      render: (v: number, r: TonKhoGiayRow) => (
        <Text strong style={{ color: v < r.ton_toi_thieu ? '#f5222d' : undefined }}>
          {fmtVND(v)}
        </Text>
      ) },
    { title: 'Tối thiểu', dataIndex: 'ton_toi_thieu', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) : '—' },
    { title: 'Đơn giá BQ', dataIndex: 'don_gia_binh_quan', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? fmtVND(v) + 'đ' : '—' },
    { title: 'Giá trị tồn', dataIndex: 'gia_tri_ton', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtVND(v || 0)}đ</Text> },
  ]

  return (
    <>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Select placeholder="Tất cả xưởng" allowClear style={{ width: 200 }}
            value={filterXuong} onChange={setFilterXuong}
            options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))} />
        </Col>
        <Col flex="auto">
          <Space size="large">
            <Statistic title="Tổng tồn (kg)" value={tongKg} precision={0}
              formatter={v => fmtVND(Number(v))} valueStyle={{ fontSize: 16 }} />
            <Statistic title="Tổng giá trị" value={tongGt} precision={0}
              formatter={v => fmtVND(Number(v)) + 'đ'} valueStyle={{ fontSize: 16, color: '#1677ff' }} />
          </Space>
        </Col>
      </Row>
      <Table dataSource={rows} columns={columns} rowKey={(r: TonKhoGiayRow) => `${r.warehouse_id}-${r.paper_material_id}`}
        loading={isLoading} size="small"
        rowClassName={(r: TonKhoGiayRow) => r.ton_luong < r.ton_toi_thieu ? 'ant-table-row-warning' : ''}
        pagination={{ pageSize: 30, showSizeChanger: true }}
        scroll={{ x: 1100 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right"><Text strong>{fmtVND(tongKg)} kg</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={7} />
            <Table.Summary.Cell index={8} />
            <Table.Summary.Cell index={9} align="right"><Text strong>{fmtVND(tongGt)}đ</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </>
  )
}

// ── Tab 3: Dự trù nhu cầu ────────────────────────────────────────────────────

function TabDuTruNhuCau() {
  const [weeks, setWeeks] = useState(4)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['du-tru-giay', weeks],
    queryFn: () => warehouseApi.getDuTruGiay({ weeks }).then(r => r.data),
    staleTime: 120_000,
  })

  const hasData = rows.length > 0
  const periodLabels = hasData ? rows[0].periods.map(p => p.label) : []

  const baseColumns = [
    { title: 'Mã giấy', dataIndex: 'ma_chinh', width: 100, fixed: 'left' as const,
      render: (v: string | null) => <Text code>{v || '—'}</Text> },
    { title: 'Khổ', dataIndex: 'kho', width: 70, align: 'right' as const,
      render: (v: number | null) => v != null ? `${v}cm` : '—' },
    { title: 'ĐL', dataIndex: 'dinh_luong', width: 65, align: 'right' as const,
      render: (v: number | null) => v != null ? `${v}` : '—' },
    { title: 'Tồn hiện tại (kg)', dataIndex: 'ton_hien_tai', width: 130, align: 'right' as const,
      render: (v: number) => <Text strong>{fmtVND(v)}</Text> },
  ]

  const periodColumns = periodLabels.map((label, i) => ({
    title: label,
    key: `period_${i}`,
    children: [
      {
        title: 'Cần (kg)',
        key: `can_${i}`,
        width: 90,
        align: 'right' as const,
        render: (_: unknown, r: DuTruGiayRow) => {
          const p = r.periods[i]
          return <Text>{p ? fmtVND(p.can_kg) : '—'}</Text>
        },
      },
      {
        title: 'Cùng kỳ',
        key: `ck_${i}`,
        width: 80,
        align: 'right' as const,
        render: (_: unknown, r: DuTruGiayRow) => {
          const p = r.periods[i]
          if (!p || p.cung_ky_nam_truoc_kg === 0) return <Text type="secondary">—</Text>
          const up = p.tang_giam_pct != null && p.tang_giam_pct > 10
          return (
            <Tooltip title={p.tang_giam_pct != null ? `${p.tang_giam_pct > 0 ? '+' : ''}${p.tang_giam_pct}% so cùng kỳ` : ''}>
              <Text style={{ color: up ? '#f5222d' : '#52c41a' }}>
                {fmtVND(p.cung_ky_nam_truoc_kg)}
              </Text>
            </Tooltip>
          )
        },
      },
      {
        title: 'Tồn sau kỳ',
        key: `ton_${i}`,
        width: 95,
        align: 'right' as const,
        render: (_: unknown, r: DuTruGiayRow) => {
          const p = r.periods[i]
          if (!p) return '—'
          return (
            <Text strong style={{ color: p.am ? '#f5222d' : '#52c41a' }}>
              {p.am && <WarningOutlined style={{ marginRight: 2 }} />}
              {fmtVND(Math.abs(p.ton_sau_ky))}
              {p.am ? ' (thiếu)' : ''}
            </Text>
          )
        },
      },
    ],
  }))

  const actionColumn = {
    title: 'Cần mua ngay',
    key: 'can_mua',
    width: 120,
    fixed: 'right' as const,
    render: (_: unknown, r: DuTruGiayRow) => (
      r.can_mua_ngay > 0
        ? <Text strong style={{ color: '#fa8c16' }}>{fmtVND(r.can_mua_ngay)} kg</Text>
        : <Tag color="green">Đủ</Tag>
    ),
  }

  return (
    <>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Space>
            <Text>Xem trước:</Text>
            <Select value={weeks} onChange={setWeeks} style={{ width: 120 }}
              options={[
                { value: 2, label: '2 tuần' },
                { value: 4, label: '4 tuần' },
                { value: 6, label: '6 tuần' },
                { value: 8, label: '8 tuần' },
              ]} />
          </Space>
        </Col>
        <Col>
          <Badge count={rows.filter(r => r.can_mua_ngay > 0).length} color="red">
            <Text type="secondary">mã giấy cần đặt thêm</Text>
          </Badge>
        </Col>
      </Row>
      <Table dataSource={rows} columns={[...baseColumns, ...periodColumns, actionColumn]}
        rowKey="paper_material_id" loading={isLoading} size="small" bordered
        pagination={false} scroll={{ x: 400 + weeks * 270 }} />
    </>
  )
}

// ── Tab 4: Lịch sử NCC ───────────────────────────────────────────────────────

function TabLichSuNCC() {
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterMaGiay, setFilterMaGiay] = useState<string | undefined>()

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: allPOs = [], isLoading } = useQuery({
    queryKey: ['purchase-orders-giay-all'],
    queryFn: () => purchaseApi.list({ loai_po: 'giay_cuon' }).then(r => r.data),
    staleTime: 120_000,
  })

  // Flatten PO items thành history rows
  const historyRows = allPOs.flatMap(po =>
    po.items.map((it, i) => ({
      key: `${po.id}-${i}`,
      ngay_po: po.ngay_po,
      ten_ncc: po.ten_ncc,
      supplier_id: po.supplier_id,
      ten_hang: it.ten_hang,
      so_luong: it.so_luong,
      don_gia: it.don_gia,
      thanh_tien: it.thanh_tien || 0,
      trang_thai: po.trang_thai,
    }))
  ).filter(r => {
    if (filterNCC && r.supplier_id !== filterNCC) return false
    if (filterMaGiay && !r.ten_hang.toLowerCase().includes(filterMaGiay.toLowerCase())) return false
    return true
  }).sort((a, b) => b.ngay_po.localeCompare(a.ngay_po))

  const maGiayOptions = Array.from(new Set(allPOs.flatMap(po => po.items.map(it => it.ten_hang))))
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
          <Select placeholder="Tất cả mã giấy" allowClear showSearch style={{ width: 200 }}
            value={filterMaGiay} onChange={setFilterMaGiay}
            options={maGiayOptions} />
        </Col>
      </Row>
      <Table dataSource={historyRows} rowKey="key" loading={isLoading} size="small"
        pagination={{ pageSize: 30, showSizeChanger: true }}
        columns={[
          { title: 'Ngày PO', dataIndex: 'ngay_po', width: 100 },
          { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', width: 180, ellipsis: true },
          { title: 'Mã/tên giấy', dataIndex: 'ten_hang', ellipsis: true },
          { title: 'Số lượng (kg)', dataIndex: 'so_luong', width: 120, align: 'right' as const,
            render: (v: number) => fmtVND(v) },
          { title: 'Đơn giá (đ/kg)', dataIndex: 'don_gia', width: 130, align: 'right' as const,
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

// ── Tab 5: Công nợ NCC ───────────────────────────────────────────────────────

function TabCongNoNCC() {
  const { data: allPOs = [], isLoading } = useQuery({
    queryKey: ['purchase-orders-giay-all'],
    queryFn: () => purchaseApi.list({ loai_po: 'giay_cuon' }).then(r => r.data),
    staleTime: 120_000,
  })

  const debtByNCC = allPOs
    .filter(po => ['da_duyet', 'da_gui_ncc', 'dang_giao', 'hoan_thanh'].includes(po.trang_thai))
    .reduce<Record<number, { ten_ncc: string; tong_mua: number; supplier_id: number }>>((acc, po) => {
      if (!acc[po.supplier_id]) {
        acc[po.supplier_id] = { supplier_id: po.supplier_id, ten_ncc: po.ten_ncc, tong_mua: 0 }
      }
      acc[po.supplier_id].tong_mua += Number(po.tong_tien || 0)
      return acc
    }, {})

  const rows = Object.values(debtByNCC).sort((a, b) => b.tong_mua - a.tong_mua)

  return (
    <Table dataSource={rows} rowKey="supplier_id" loading={isLoading} size="small"
      pagination={false}
      columns={[
        { title: 'Nhà cung cấp', dataIndex: 'ten_ncc', ellipsis: true },
        { title: 'Tổng mua (đã duyệt)', dataIndex: 'tong_mua', align: 'right' as const,
          render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{fmtVND(v)}đ</Text> },
      ]}
      summary={() => {
        const total = rows.reduce((s, r) => s + r.tong_mua, 0)
        return (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Text strong style={{ color: '#f5222d' }}>{fmtVND(total)}đ</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )
      }}
    />
  )
}

// ── Tab 4: Phôi sóng ngoài ───────────────────────────────────────────────────

function TabPhoiSongNgoai() {
  const qc = useQueryClient()
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [openModal, setOpenModal] = useState(false)
  const [form] = Form.useForm()
  const [itemVals, setItemVals] = useState<Record<number, { so_luong: number; don_gia: number }>>({})

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['khsx-can-phoi-ngoai'],
    queryFn: () => warehouseApi.getKHSXCanPhoiNgoai().then(r => r.data),
    staleTime: 60_000,
  })
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })
  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 600_000,
  })

  const createMut = useMutation({
    mutationFn: (data: any) => purchaseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['khsx-can-phoi-ngoai'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders-giay'] })
      message.success('Đã tạo đơn mua phôi sóng')
      setOpenModal(false)
      setSelectedKeys([])
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo PO'),
  })

  const selectedRows = rows.filter(r => selectedKeys.includes(r.ppl_id))

  const soTamCan = (r: KHSXCanPhoiNgoaiRow) =>
    r.so_dao ? Math.ceil(r.so_luong_thung / r.so_dao) : r.so_luong_thung

  const handleOpenModal = () => {
    form.resetFields()
    form.setFieldsValue({ ngay_po: dayjs() })
    const init: Record<number, { so_luong: number; don_gia: number }> = {}
    selectedRows.forEach(r => {
      init[r.ppl_id] = { so_luong: Math.max(0, soTamCan(r) - r.da_dat_so_tam), don_gia: 0 }
    })
    setItemVals(init)
    setOpenModal(true)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = selectedRows.map(r => {
        const iv = itemVals[r.ppl_id] ?? { so_luong: 0, don_gia: 0 }
        const cauTruc = cauTrucGiaySummary(r)
        return {
          paper_material_id: null,
          other_material_id: null,
          ten_hang: `Phôi ${r.kho_tt ?? '?'}×${r.dai_tt ?? '?'}cm - ${cauTruc}`,
          so_luong: iv.so_luong,
          dvt: 'Tấm',
          don_gia: iv.don_gia,
          production_plan_line_id: r.ppl_id,
          phoi_spec: {
            kho_giay: r.kho_giay, kho_tt: r.kho_tt, kho1: r.kho1, so_dao: r.so_dao, dai_tt: r.dai_tt,
            so_lop: r.so_lop, to_hop_song: r.to_hop_song,
            mat: r.mat, mat_dl: r.mat_dl,
            song_1: r.song_1, song_1_dl: r.song_1_dl,
            mat_1: r.mat_1, mat_1_dl: r.mat_1_dl,
            song_2: r.song_2, song_2_dl: r.song_2_dl,
            mat_2: r.mat_2, mat_2_dl: r.mat_2_dl,
            song_3: r.song_3, song_3_dl: r.song_3_dl,
            mat_3: r.mat_3, mat_3_dl: r.mat_3_dl,
            loai_thung: r.loai_thung, dai: r.dai, rong: r.rong, cao: r.cao,
            c_tham: r.c_tham, can_man: r.can_man, loai_lan: r.loai_lan, qccl: r.qccl,
          },
        }
      })
      if (!items.length || items.some(it => !it.so_luong)) {
        message.warning('Vui lòng nhập số lượng cho tất cả dòng')
        return
      }
      createMut.mutate({
        supplier_id: v.supplier_id,
        ngay_po: v.ngay_po.format('YYYY-MM-DD'),
        phan_xuong_id: v.phan_xuong_id || null,
        loai_po: 'giay_tam',
        ngay_du_kien_nhan: v.ngay_du_kien_nhan ? v.ngay_du_kien_nhan.format('YYYY-MM-DD') : null,
        dieu_khoan_tt: v.dieu_khoan_tt || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch { /* validation inline */ }
  }

  const updateItemVal = (pplId: number, field: 'so_luong' | 'don_gia', val: number) => {
    setItemVals(prev => ({ ...prev, [pplId]: { ...(prev[pplId] ?? { so_luong: 0, don_gia: 0 }), [field]: val } }))
  }

  const columns = [
    { title: 'Số KHSX', dataIndex: 'so_ke_hoach', width: 120,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày chạy', dataIndex: 'ngay_chay', width: 95,
      render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Số LSX', dataIndex: 'so_lsx', width: 120 },
    { title: 'Sản phẩm', dataIndex: 'ten_san_pham', ellipsis: true },
    { title: 'Khổ giấy', dataIndex: 'kho_giay', width: 80, align: 'right' as const,
      render: (v: number | null) => v != null ? `${v}` : '—' },
    { title: 'Số dao', dataIndex: 'so_dao', width: 70, align: 'right' as const,
      render: (v: number | null) => v ?? '—' },
    { title: 'Khổ TT × Cắt', width: 120, align: 'right' as const,
      render: (_: unknown, r: KHSXCanPhoiNgoaiRow) =>
        r.kho_tt && r.dai_tt ? `${r.kho_tt} × ${r.dai_tt}` : '—' },
    { title: 'Lớp', dataIndex: 'so_lop', width: 50, align: 'center' as const,
      render: (v: number | null) => v ?? '—' },
    { title: 'Tổ hợp', dataIndex: 'to_hop_song', width: 70, align: 'center' as const,
      render: (v: string | null) => v ?? '—' },
    { title: 'Cấu trúc giấy', width: 180,
      render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => <Text code style={{ fontSize: 11 }}>{cauTrucGiaySummary(r)}</Text> },
    { title: 'QCCL', width: 140,
      render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => (
        <Tooltip title={r.qccl || undefined}>
          <Text style={{ fontSize: 11 }}>{qcclSummary(r)}</Text>
        </Tooltip>
      ) },
    { title: 'SL tấm cần', width: 100, align: 'right' as const,
      render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => soTamCan(r).toLocaleString('vi-VN') },
    { title: 'Đã đặt', dataIndex: 'da_dat_so_tam', width: 80, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="success">{v.toLocaleString('vi-VN')}</Text> : <Text type="secondary">0</Text> },
    { title: 'Còn thiếu', width: 90, align: 'right' as const,
      render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => {
        const thieu = Math.max(0, soTamCan(r) - r.da_dat_so_tam)
        return thieu > 0
          ? <Text strong style={{ color: '#f5222d' }}>{thieu.toLocaleString('vi-VN')}</Text>
          : <Tag color="green">Đủ</Tag>
      } },
  ]

  return (
    <>
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col flex="auto">
          <Text type="secondary">
            KHSX có line đánh dấu "Mua phôi ngoài" — chọn để tạo đơn đặt hàng NCC
          </Text>
        </Col>
        <Col>
          <Button type="primary" disabled={!selectedKeys.length} icon={<PlusOutlined />}
            onClick={handleOpenModal}>
            Tạo đơn mua phôi ({selectedKeys.length} KHSX)
          </Button>
        </Col>
      </Row>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="ppl_id"
        loading={isLoading}
        size="small"
        rowClassName={(r: KHSXCanPhoiNgoaiRow) =>
          Math.max(0, soTamCan(r) - r.da_dat_so_tam) > 0 ? 'ant-table-row-warning' : ''}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedKeys,
          onChange: keys => setSelectedKeys(keys as number[]),
        }}
        pagination={{ pageSize: 30, showSizeChanger: true }}
        scroll={{ x: 1400 }}
      />

      <Modal
        open={openModal}
        onCancel={() => setOpenModal(false)}
        title={`Tạo đơn mua phôi sóng (${selectedRows.length} KHSX line)`}
        width={1000}
        okText="Tạo đơn"
        onOk={handleSubmit}
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                <Select placeholder="Chọn NCC..." showSearch optionFilterProp="label"
                  options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phan_xuong_id" label="Xưởng nhận" rules={[{ required: true, message: 'Chọn xưởng' }]}>
                <Select placeholder="Chọn xưởng..." showSearch optionFilterProp="label"
                  options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ngay_po" label="Ngày PO" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="dieu_khoan_tt" label="Điều khoản TT">
                <Select placeholder="Chọn..." allowClear options={DIEU_KHOAN_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú đơn..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Table
          dataSource={selectedRows}
          rowKey="ppl_id"
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Khổ TT × Cắt (cm)', width: 140,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) =>
                r.kho_tt && r.dai_tt ? <Text strong>{r.kho_tt} × {r.dai_tt}</Text> : '—' },
            { title: 'Cấu trúc giấy', width: 200,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) =>
                <Text code style={{ fontSize: 11 }}>{cauTrucGiaySummary(r)}</Text> },
            { title: 'QCCL', width: 160,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => (
                <Tooltip title={r.qccl || undefined}>
                  <Text style={{ fontSize: 11 }}>{qcclSummary(r)}</Text>
                </Tooltip>
              ) },
            { title: 'Số lượng (tấm)', width: 140,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => (
                <InputNumber
                  size="small" min={1} style={{ width: '100%' }}
                  value={itemVals[r.ppl_id]?.so_luong ?? 0}
                  onChange={val => updateItemVal(r.ppl_id, 'so_luong', Number(val) || 0)}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              ) },
            { title: 'Đơn giá (đ/tấm)', width: 150,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => (
                <InputNumber
                  size="small" min={0} style={{ width: '100%' }}
                  value={itemVals[r.ppl_id]?.don_gia ?? 0}
                  onChange={val => updateItemVal(r.ppl_id, 'don_gia', Number(val) || 0)}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              ) },
            { title: 'Thành tiền', width: 130, align: 'right' as const,
              render: (_: unknown, r: KHSXCanPhoiNgoaiRow) => {
                const iv = itemVals[r.ppl_id] ?? { so_luong: 0, don_gia: 0 }
                return <Text strong>{fmtVND(iv.so_luong * iv.don_gia)}đ</Text>
              } },
          ]}
          summary={() => {
            const total = selectedRows.reduce((s, r) => {
              const iv = itemVals[r.ppl_id] ?? { so_luong: 0, don_gia: 0 }
              return s + iv.so_luong * iv.don_gia
            }, 0)
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#f5222d' }}>{fmtVND(total)}đ</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )
          }}
        />
      </Modal>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MuaGiayPage() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <ShopOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <Title level={4} style={{ margin: 0 }}>Mua Giấy</Title>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Tabs
          defaultActiveKey="don-mua"
          items={[
            { key: 'don-mua', label: 'Đơn mua giấy', children: <TabDonMuaGiay /> },
            { key: 'ton-kho', label: 'Tồn kho giấy', children: <TabTonKhoGiay /> },
            { key: 'du-tru', label: 'Dự trù nhu cầu', children: <TabDuTruNhuCau /> },
            { key: 'phoi-song-ngoai', label: 'Phôi sóng ngoài', children: <TabPhoiSongNgoai /> },
            { key: 'lich-su-ncc', label: 'Lịch sử NCC', children: <TabLichSuNCC /> },
            { key: 'cong-no-ncc', label: 'Công nợ NCC', children: <TabCongNoNCC /> },
          ]}
        />
      </Card>
    </div>
  )
}
