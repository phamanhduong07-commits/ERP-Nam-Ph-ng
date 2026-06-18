import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { productsApi as productsFullApi, type ProductFull, type ProductFullCreate } from '../../api/products'
import { customersApi } from '../../api/customers'
import { LOAI_THUNG_OPTIONS } from '../../api/quotes'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import EmptyState from "../../components/EmptyState"
import { usePermission } from '../../hooks/usePermission'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography

const SO_LOP_OPTIONS = [1, 3, 5, 7]

const LOAI_THUNG_GROUPED = [
  { label: 'Thùng', options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Thùng') },
  { label: 'Hộp',   options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Hộp') },
  { label: 'Khay',  options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Khay') },
]

export default function ProductList() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canViewPrice = hasPermission('production.cost_analysis')
  const canManage = hasPermission('master.products.manage')
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductFull | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterKh, setFilterKh] = useState<number | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [importVisible, setImportVisible] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['products-full', search, filterKh, page],
    queryFn: () =>
      productsFullApi.list({
        search: search || undefined,
        ma_kh_id: filterKh,
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const { data: khList = [] } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: ProductFullCreate) => productsFullApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-full'] })
      closeModal()
      message.success('Đã thêm sản phẩm')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm sản phẩm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProductFullCreate> }) =>
      productsFullApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-full'] })
      closeModal()
      message.success('Đã cập nhật sản phẩm')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      trang_thai: true,
      ghim: false,
      dan: false,
      so_lop: 3,
      so_mau: 0,
      gia_ban: 0,
      dvt: 'Cái',
    })
    setModalOpen(true)
  }

  const openEdit = (row: ProductFull) => {
    setEditing(row)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: ProductFullCreate = {
      ma_amis: vals.ma_amis,
      ma_hang: vals.ma_hang || null,
      ten_hang: vals.ten_hang,
      ma_kh_id: vals.ma_kh_id ?? null,
      dai: vals.dai ?? null,
      rong: vals.rong ?? null,
      cao: vals.cao ?? null,
      so_lop: vals.so_lop ?? 3,
      so_mau: vals.so_mau ?? 0,
      dvt: vals.dvt || 'Cái',
      gia_ban: vals.gia_ban ?? 0,
      ghim: vals.ghim ?? false,
      dan: vals.dan ?? false,
      loai_in: editing?.loai_in ?? 0,
      chap_xa: editing?.chap_xa ?? 0,
      loai_lan: editing?.loai_lan ?? null,
      loai_thung: vals.loai_thung ?? null,
      chong_tham: editing?.chong_tham ?? 0,
      boi: editing?.boi ?? 0,
      be_so_con: editing?.be_so_con ?? 0,
      can_mang: editing?.can_mang ?? 0,
      mat: editing?.mat ?? null, mat_dl: editing?.mat_dl ?? null,
      song_1: editing?.song_1 ?? null, song_1_dl: editing?.song_1_dl ?? null,
      mat_1: editing?.mat_1 ?? null, mat_1_dl: editing?.mat_1_dl ?? null,
      song_2: editing?.song_2 ?? null, song_2_dl: editing?.song_2_dl ?? null,
      mat_2: editing?.mat_2 ?? null, mat_2_dl: editing?.mat_2_dl ?? null,
      song_3: editing?.song_3 ?? null, song_3_dl: editing?.song_3_dl ?? null,
      mat_3: editing?.mat_3 ?? null, mat_3_dl: editing?.mat_3_dl ?? null,
      phan_xuong: vals.phan_xuong || null,
      loai: vals.loai || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  useHotkey('ctrl+n', openCreate, 'Thêm hàng hóa mới')
  useHotkey('ctrl+s', handleSave, 'Lưu hàng hóa', 'Trang hiện tại', modalOpen)

  const khOptions = khList.map(k => ({ value: k.id, label: `${k.ma_kh} - ${k.ten_viet_tat}` }))

  const columns: ColumnsType<ProductFull> = [
    { title: 'Mã AMIS', dataIndex: 'ma_amis', width: 110 },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 110, render: (v: string | null) => v ?? '—' },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', width: 150, render: (v: string) => v ?? '—' },
    {
      title: 'D×R×C',
      width: 120,
      render: (_: unknown, r: ProductFull) => {
        const parts = [r.dai, r.rong, r.cao].map(v => v != null ? +v : '?')
        return <span style={{ fontSize: 12 }}>{parts.join('×')}</span>
      },
    },
    {
      title: 'Lớp',
      dataIndex: 'so_lop',
      width: 60,
      align: 'center',
      render: (v: number) => <Tag color="blue">{v}L</Tag>,
    },
    { title: 'DVT', dataIndex: 'dvt', width: 60 },
    ...(canViewPrice ? [{
      title: 'Giá bán',
      dataIndex: 'gia_ban',
      width: 110,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString('vi-VN'),
    }] : []),
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_: unknown, r: ProductFull) => canManage ? (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      ) : null,
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-product', columns, { nonHideable: ['ma_amis'], data: data?.items })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Danh mục sản phẩm</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm mã AMIS, tên hàng..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => { setSearch(v); setPage(1) }}
                allowClear
                style={{ width: 220 }}
              />
              <Select
                placeholder="Lọc theo khách hàng"
                allowClear
                style={{ width: 200 }}
                value={filterKh}
                onChange={v => { setFilterKh(v); setPage(1) }}
                options={khOptions}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
              {canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Thêm sản phẩm
                </Button>
              )}
              <Button onClick={() => setImportVisible(true)}>
                Import Excel
              </Button>
              {settingsButton}
            </Space>
          </Col>
        </Row>

        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          dataSource={items}
          columns={displayColumns}
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showTotal: (t) => `Tổng ${t} sản phẩm`,
            onChange: (p) => setPage(p),
          }}
          onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={680}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Mã AMIS" name="ma_amis" rules={[{ required: true, message: 'Nhập mã AMIS' }]}>
                <Input disabled={!!editing} placeholder="VD: SP001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Mã hàng" name="ma_hang">
                <Input placeholder="Mã hàng nội bộ" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="DVT" name="dvt">
                <Input placeholder="Cái" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Tên hàng" name="ten_hang" rules={[{ required: true, message: 'Nhập tên hàng' }]}>
            <Input placeholder="Tên sản phẩm" />
          </Form.Item>

          <Form.Item label="Khách hàng" name="ma_kh_id">
            <Select
              showSearch
              allowClear
              placeholder="Chọn khách hàng"
              options={khOptions}
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Dài (cm)" name="dai">
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Rộng (cm)" name="rong">
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cao (cm)" name="cao">
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Loại thùng" name="loai_thung">
            <Select
              allowClear
              placeholder="Chọn loại thùng..."
              options={LOAI_THUNG_GROUPED}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Số lớp" name="so_lop">
                <Select
                  options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Số màu" name="so_mau">
                <InputNumber style={{ width: '100%' }} min={0} max={10} placeholder="0" />
              </Form.Item>
            </Col>
            {canViewPrice && (
              <Col span={8}>
                <Form.Item label="Giá bán (VND)" name="gia_ban">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={1000}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    placeholder="0"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Ghim" name="ghim" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Dán" name="dan" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phân xưởng" name="phan_xuong">
                <Input placeholder="Phân xưởng sản xuất" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Loại" name="loai">
                <Input placeholder="Loại sản phẩm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input placeholder="Ghi chú thêm" />
              </Form.Item>
            </Col>
          </Row>

          {editing && (
            <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <ImportExcelDialog
        title="Import danh mục sản phẩm"
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products-full'] })}
        importFn={(file, commit) => productsFullApi.import(file, commit).then(r => r.data as { total?: number; created?: number; updated?: number; skipped?: number; errors?: number | string[]; rows?: Array<{ row?: number; status?: string; message?: string }> })}
        templateUrl="/api/products/import-template"
      />
    </div>
  )
}
