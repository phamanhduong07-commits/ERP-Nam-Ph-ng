import React, { useState } from 'react'
import {
  Button, Card, DatePicker, Form, Input, InputNumber, message,
  Modal, Popconfirm, Select, Space, Table, Tag, Typography,
} from 'antd'
import { PlusOutlined, CheckOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { phieuTraHangApi } from '../../api/phieu_tra_hang'
import type { PhieuTraHang, PhieuTraHangCreate, TraHangItem, LoaiHang } from '../../api/phieu_tra_hang'
import PageLayout from '../../components/PageLayout'
import api from '../../api/client'

const { Text } = Typography

const TRANG_THAI_TAG: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default', label: 'Nháp' },
  confirmed: { color: 'green',   label: 'Đã xác nhận' },
  huy:       { color: 'red',     label: 'Đã huỷ' },
}

const LOAI_HANG_LABEL: Record<LoaiHang, string> = {
  PHOI: 'Phôi',
  THANH_PHAM: 'Thành phẩm',
}

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtD = (s: string | null | undefined) =>
  s ? dayjs(s).format('DD/MM/YYYY') : '—'

const DEFAULT_ITEM_PHOI: TraHangItem = { so_luong: 1, tinh_trang: 'tot', don_vi: 'Tấm' }
const DEFAULT_ITEM_TP: TraHangItem = { so_luong: 1, tinh_trang: 'tot', don_vi: 'Thùng' }

interface SelectOption { value: number; label: string }

export default function PhieuTraHangPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form] = Form.useForm()
  const [loaiHang, setLoaiHang] = useState<LoaiHang>('PHOI')
  const [items, setItems] = useState<TraHangItem[]>([{ ...DEFAULT_ITEM_PHOI }])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['phieu-tra-hang'],
    queryFn: () => phieuTraHangApi.list(),
  })

  const { data: customers = [] } = useQuery<SelectOption[]>({
    queryKey: ['customers-select'],
    queryFn: () =>
      api.get('/api/customers?limit=500').then(r =>
        r.data.map((c: { id: number; ten_viet_tat: string; ten_kh: string }) => ({
          value: c.id,
          label: c.ten_viet_tat || c.ten_kh,
        }))
      ),
  })

  const { data: warehousesPhoi = [] } = useQuery<SelectOption[]>({
    queryKey: ['warehouses-phoi-select'],
    queryFn: () =>
      api.get('/api/warehouses').then(r =>
        r.data
          .filter((w: { loai_kho: string }) => w.loai_kho === 'PHOI')
          .map((w: { id: number; ten_kho: string }) => ({ value: w.id, label: w.ten_kho }))
      ),
  })

  const { data: warehousesTp = [] } = useQuery<SelectOption[]>({
    queryKey: ['warehouses-tp-select'],
    queryFn: () =>
      api.get('/api/warehouses').then(r =>
        r.data
          .filter((w: { loai_kho: string }) =>
            ['TP', 'THANH_PHAM', 'thanh_pham'].includes(w.loai_kho)
          )
          .map((w: { id: number; ten_kho: string }) => ({ value: w.id, label: w.ten_kho }))
      ),
  })

  const warehouses = loaiHang === 'PHOI' ? warehousesPhoi : warehousesTp

  const customerId = Form.useWatch('customer_id', form)
  const { data: orders = [] } = useQuery<SelectOption[]>({
    queryKey: ['lsx-by-customer', customerId],
    enabled: !!customerId,
    queryFn: () =>
      api.get(`/api/production-orders?customer_id=${customerId}&limit=200`).then(r =>
        r.data.items?.map((o: { id: number; so_lenh: string }) => ({
          value: o.id,
          label: o.so_lenh,
        })) ?? []
      ),
  })

  const { data: products = [] } = useQuery<SelectOption[]>({
    queryKey: ['products-select'],
    enabled: loaiHang === 'THANH_PHAM',
    queryFn: () =>
      api.get('/api/products?limit=500').then(r =>
        (r.data?.items ?? r.data ?? []).map((p: { id: number; ten_hang: string; ma_hang: string }) => ({
          value: p.id,
          label: p.ten_hang || p.ma_hang,
        }))
      ),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['phieu-tra-hang'] })

  const createMut = useMutation({
    mutationFn: (body: PhieuTraHangCreate) => phieuTraHangApi.create(body),
    onSuccess: () => { message.success('Đã tạo phiếu'); invalidate(); setModalOpen(false) },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<PhieuTraHangCreate> }) =>
      phieuTraHangApi.update(id, body),
    onSuccess: () => { message.success('Đã cập nhật'); invalidate(); setModalOpen(false) },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const confirmMut = useMutation({
    mutationFn: (id: number) => phieuTraHangApi.confirm(id),
    onSuccess: () => { message.success('Đã xác nhận — tồn kho và hạch toán đã cập nhật'); invalidate() },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail || 'Lỗi xác nhận'),
  })

  const huyMut = useMutation({
    mutationFn: (id: number) => phieuTraHangApi.huy(id),
    onSuccess: () => { message.success('Đã huỷ phiếu'); invalidate() },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail || 'Lỗi huỷ'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => phieuTraHangApi.delete(id),
    onSuccess: () => { message.success('Đã xoá phiếu'); invalidate() },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e.response?.data?.detail || 'Lỗi xoá'),
  })

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditId(null)
    form.resetFields()
    form.setFieldValue('ngay', dayjs())
    form.setFieldValue('loai_hang', 'PHOI')
    setLoaiHang('PHOI')
    setItems([{ ...DEFAULT_ITEM_PHOI }])
    setModalOpen(true)
  }

  const openEdit = async (id: number) => {
    const p = await phieuTraHangApi.get(id)
    setEditId(id)
    const lh = p.loai_hang as LoaiHang
    setLoaiHang(lh)
    form.setFieldsValue({
      ngay: dayjs(p.ngay),
      loai_hang: p.loai_hang,
      customer_id: p.customer_id,
      production_order_id: p.production_order_id,
      warehouse_id: p.warehouse_id,
      delivery_order_id: p.delivery_order_id,
      ly_do_tra: p.ly_do_tra,
      nguoi_giao: p.nguoi_giao,
      ghi_chu: p.ghi_chu,
    })
    setItems(p.items.map(it => ({ ...it })))
    setModalOpen(true)
  }

  const handleLoaiHangChange = (val: LoaiHang) => {
    setLoaiHang(val)
    form.setFieldValue('warehouse_id', undefined)
    form.setFieldValue('production_order_id', undefined)
    setItems([val === 'PHOI' ? { ...DEFAULT_ITEM_PHOI } : { ...DEFAULT_ITEM_TP }])
  }

  const handleSubmit = async () => {
    const vals = await form.validateFields()
    const body: PhieuTraHangCreate = {
      ngay: (vals.ngay as dayjs.Dayjs).format('YYYY-MM-DD'),
      loai_hang: vals.loai_hang,
      customer_id: vals.customer_id,
      production_order_id: vals.production_order_id || null,
      warehouse_id: vals.warehouse_id,
      delivery_order_id: vals.delivery_order_id || null,
      ly_do_tra: vals.ly_do_tra || null,
      nguoi_giao: vals.nguoi_giao || null,
      ghi_chu: vals.ghi_chu || null,
      items: items.filter(it => it.so_luong > 0),
    }
    if (!body.items.length) {
      message.error('Phiếu phải có ít nhất 1 dòng hàng')
      return
    }
    if (editId) {
      updateMut.mutate({ id: editId, body })
    } else {
      createMut.mutate(body)
    }
  }

  const setItemField = (idx: number, field: keyof TraHangItem, val: unknown) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnsType<PhieuTraHang> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openEdit(row.id)}>{v}</Button>
      ),
    },
    { title: 'Ngày', dataIndex: 'ngay', width: 100, render: fmtD },
    {
      title: 'Loại',
      dataIndex: 'loai_hang',
      width: 100,
      render: (v: LoaiHang) => (
        <Tag color={v === 'PHOI' ? 'blue' : 'purple'}>{LOAI_HANG_LABEL[v] ?? v}</Tag>
      ),
    },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    { title: 'LSX', dataIndex: 'so_lenh', width: 120 },
    { title: 'Kho nhận', dataIndex: 'ten_kho', width: 140, ellipsis: true },
    {
      title: 'Tổng SL',
      dataIndex: 'tong_so_luong',
      width: 80,
      align: 'right',
      render: fmtN,
    },
    {
      title: 'Tốt',
      dataIndex: 'tong_tot',
      width: 70,
      align: 'right',
      render: (v) => <Text style={{ color: '#52c41a' }}>{fmtN(v)}</Text>,
    },
    {
      title: 'Lỗi',
      dataIndex: 'tong_loi',
      width: 70,
      align: 'right',
      render: (v) => v > 0 ? <Text type="danger">{fmtN(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => {
        const cfg = TRANG_THAI_TAG[v] || { color: 'default', label: v }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_, row) => (
        <Space>
          {row.trang_thai === 'draft' && (
            <>
              <Popconfirm
                title="Xác nhận phiếu này? Tồn kho và hạch toán sẽ được cập nhật."
                onConfirm={() => confirmMut.mutate(row.id)}
                okText="Xác nhận"
                cancelText="Huỷ"
              >
                <Button size="small" type="primary" icon={<CheckOutlined />}>
                  Xác nhận
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Huỷ phiếu này?"
                onConfirm={() => huyMut.mutate(row.id)}
                okText="Huỷ phiếu"
                cancelText="Không"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" icon={<StopOutlined />}>Huỷ</Button>
              </Popconfirm>
              <Popconfirm
                title="Xoá phiếu này?"
                onConfirm={() => deleteMut.mutate(row.id)}
                okText="Xoá"
                cancelText="Không"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {row.trang_thai === 'confirmed' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.confirmed_at ? fmtD(row.confirmed_at) : ''}
            </Text>
          )}
        </Space>
      ),
    },
  ]

  // ── Item columns — conditional on loaiHang ────────────────────────────────

  const itemColumnsPhoi: ColumnsType<TraHangItem> = [
    {
      title: 'Khổ (mm)',
      width: 90,
      render: (_, __, idx) => (
        <InputNumber
          size="small" min={0} style={{ width: '100%' }}
          value={items[idx]?.chieu_kho ?? undefined}
          onChange={v => setItemField(idx, 'chieu_kho', v)}
        />
      ),
    },
    {
      title: 'Cắt (mm)',
      width: 90,
      render: (_, __, idx) => (
        <InputNumber
          size="small" min={0} style={{ width: '100%' }}
          value={items[idx]?.chieu_cat ?? undefined}
          onChange={v => setItemField(idx, 'chieu_cat', v)}
        />
      ),
    },
    {
      title: 'Số tấm',
      width: 80,
      render: (_, __, idx) => (
        <InputNumber
          size="small" min={1} style={{ width: '100%' }}
          value={items[idx]?.so_luong}
          onChange={v => setItemField(idx, 'so_luong', v ?? 1)}
        />
      ),
    },
  ]

  const itemColumnsTp: ColumnsType<TraHangItem> = [
    {
      title: 'Sản phẩm',
      render: (_, __, idx) => (
        <Select
          size="small" style={{ width: 220 }}
          showSearch
          filterOption={(input, opt) =>
            (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={products}
          value={items[idx]?.product_id ?? undefined}
          onChange={v => setItemField(idx, 'product_id', v)}
          placeholder="Chọn sản phẩm"
        />
      ),
    },
    {
      title: 'Số lượng',
      width: 90,
      render: (_, __, idx) => (
        <InputNumber
          size="small" min={1} style={{ width: '100%' }}
          value={items[idx]?.so_luong}
          onChange={v => setItemField(idx, 'so_luong', v ?? 1)}
        />
      ),
    },
    {
      title: 'ĐVT',
      width: 80,
      render: (_, __, idx) => (
        <Input
          size="small"
          value={items[idx]?.don_vi ?? 'Thùng'}
          onChange={e => setItemField(idx, 'don_vi', e.target.value)}
        />
      ),
    },
  ]

  const itemColumnsCommon: ColumnsType<TraHangItem> = [
    {
      title: 'Tình trạng',
      width: 100,
      render: (_, __, idx) => (
        <Select
          size="small" style={{ width: '100%' }}
          value={items[idx]?.tinh_trang}
          onChange={v => setItemField(idx, 'tinh_trang', v)}
          options={[
            { value: 'tot', label: '✅ Tốt' },
            { value: 'loi', label: '❌ Lỗi' },
          ]}
        />
      ),
    },
    {
      title: 'Đơn giá',
      width: 120,
      render: (_, __, idx) => (
        <InputNumber
          size="small" min={0} style={{ width: '100%' }}
          formatter={v => v ? new Intl.NumberFormat('vi-VN').format(Number(v)) : ''}
          value={items[idx]?.don_gia ?? undefined}
          onChange={v => setItemField(idx, 'don_gia', v)}
        />
      ),
    },
    {
      title: 'Ghi chú',
      render: (_, __, idx) => (
        <Input
          size="small"
          value={items[idx]?.ghi_chu ?? ''}
          onChange={e => setItemField(idx, 'ghi_chu', e.target.value || null)}
        />
      ),
    },
    {
      title: '',
      width: 36,
      render: (_, __, idx) => (
        <Button
          size="small" danger type="text"
          onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
        >×</Button>
      ),
    },
  ]

  const itemColumns = [
    ...(loaiHang === 'PHOI' ? itemColumnsPhoi : itemColumnsTp),
    ...itemColumnsCommon,
  ]

  const defaultItem = loaiHang === 'PHOI' ? { ...DEFAULT_ITEM_PHOI } : { ...DEFAULT_ITEM_TP }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout title="Khách trả hàng">
      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Tạo phiếu
          </Button>
        }
      >
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title={editId ? 'Sửa phiếu trả hàng' : 'Tạo phiếu trả hàng'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editId ? 'Lưu' : 'Tạo'}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={960}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Form.Item label="Ngày" name="ngay" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Loại hàng" name="loai_hang" rules={[{ required: true }]} initialValue="PHOI">
              <Select
                disabled={!!editId}
                onChange={handleLoaiHangChange}
                options={[
                  { value: 'PHOI', label: 'Phôi (giấy tấm)' },
                  { value: 'THANH_PHAM', label: 'Thành phẩm' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Khách hàng" name="customer_id" rules={[{ required: true }]}>
              <Select
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={customers}
                placeholder="Chọn khách hàng"
              />
            </Form.Item>
            {loaiHang === 'PHOI' ? (
              <Form.Item label="Lệnh SX" name="production_order_id" rules={[{ required: true, message: 'Trả phôi phải chọn LSX' }]}>
                <Select
                  showSearch
                  disabled={!customerId}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={orders}
                  placeholder={customerId ? 'Chọn LSX' : 'Chọn khách trước'}
                />
              </Form.Item>
            ) : (
              <Form.Item label="Lệnh SX (tuỳ chọn)" name="production_order_id">
                <Select
                  showSearch
                  allowClear
                  disabled={!customerId}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={orders}
                  placeholder={customerId ? 'Chọn LSX (nếu có)' : 'Chọn khách trước'}
                />
              </Form.Item>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item
              label={loaiHang === 'PHOI' ? 'Kho nhận phôi tốt' : 'Kho nhận TP'}
              name="warehouse_id"
              rules={[{ required: true }]}
            >
              <Select options={warehouses} placeholder="Chọn kho" />
            </Form.Item>
            <Form.Item label="Người giao" name="nguoi_giao">
              <Input placeholder="Tên người giao hàng" />
            </Form.Item>
            <Form.Item label="Lý do trả" name="ly_do_tra">
              <Input placeholder="Lý do khách trả hàng" />
            </Form.Item>
          </div>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={2} />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            Danh sách hàng trả ({loaiHang === 'PHOI' ? 'Phôi' : 'Thành phẩm'})
          </div>
          <Table
            rowKey={(_, idx) => String(idx)}
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            size="small"
            style={{ marginBottom: 8 }}
          />
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setItems(prev => [...prev, { ...defaultItem }])}
          >
            Thêm dòng
          </Button>
        </Form>
      </Modal>
    </PageLayout>
  )
}
