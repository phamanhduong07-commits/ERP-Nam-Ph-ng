import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Switch, Tabs, Checkbox,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { productsApi as productsFullApi, type ProductFull, type ProductFullCreate } from '../../api/products'
import { customersApi } from '../../api/customers'
import { LOAI_THUNG_OPTIONS, LOAI_BE_OPTIONS, TO_HOP_SONG_OPTIONS } from '../../api/quotes'
import ImportExcelDialog from '../../components/ImportExcelDialog'
import EmptyState from "../../components/EmptyState"
import { usePermission } from '../../hooks/usePermission'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography

const SO_LOP_OPTIONS = [1, 3, 5, 7]

const LOAI_IN_OPTIONS = [
  { value: 0, label: 'Không in' },
  { value: 1, label: 'In Flexo' },
  { value: 2, label: 'In kỹ thuật số' },
]

const LOAI_LAN_OPTIONS = [
  { value: 'bang', label: 'Bằng' },
  { value: 'am_duong', label: 'Âm dương' },
]

const CHONG_THAM_OPTIONS = [
  { value: 0, label: 'Không' },
  { value: 1, label: '1 mặt' },
  { value: 2, label: '2 mặt' },
]

const CAN_MANG_OPTIONS = [
  { value: 0, label: 'Không' },
  { value: 1, label: 'Mặt trong' },
  { value: 2, label: 'Mặt ngoài' },
]

const PAPER_LAYERS = [
  { label: 'Mặt ngoài', code: 'mat',    dl: 'mat_dl' },
  { label: 'Sóng 1',    code: 'song_1', dl: 'song_1_dl' },
  { label: 'Mặt 1',     code: 'mat_1',  dl: 'mat_1_dl' },
  { label: 'Sóng 2',    code: 'song_2', dl: 'song_2_dl' },
  { label: 'Mặt 2',     code: 'mat_2',  dl: 'mat_2_dl' },
  { label: 'Sóng 3',    code: 'song_3', dl: 'song_3_dl' },
  { label: 'Mặt trong', code: 'mat_3',  dl: 'mat_3_dl' },
] as const

const MAY_IN_OPTIONS = [
  { value: '4 màu', label: '4 màu' },
  { value: '5 màu', label: '5 màu' },
  { value: '6 màu', label: '6 màu' },
  { value: 'in dọc', label: 'In dọc' },
]

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
      loai_in: 0,
      chap_xa: false,
      chong_tham: 0,
      boi: false,
      be_so_con: 0,
      can_mang: 0,
      khong_tinh_nxt: false,
      be_hai_manh: false, ho_mo: false, co_be: false, be_lo: false, do_kho: false, do_phu: false,
      co_tem_offset: false,
      tem_sp_per_to: 1, tem_waste_to: 0, tem_so_mau: 0,
      tem_co_can_mang: false, tem_co_khuon_be: false, tem_co_uv: false,
      tem_co_suppo: false, tem_co_luoi: false, tem_hai_manh: false, tem_khac_thiet_ke: false,
    })
    setModalOpen(true)
  }

  const openEdit = (row: ProductFull) => {
    setEditing(row)
    form.setFieldsValue({
      ...row,
      chap_xa: row.chap_xa === 1,
      boi: row.boi === 1,
    })
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
      gia_mua: editing?.gia_mua ?? 0,
      gia_dinh_muc: editing?.gia_dinh_muc ?? 0,
      ghim: vals.ghim ?? false,
      dan: vals.dan ?? false,
      loai_in: vals.loai_in ?? 0,
      chap_xa: vals.chap_xa ? 1 : 0,
      loai_lan: vals.loai_lan ?? null,
      loai_thung: vals.loai_thung ?? null,
      chong_tham: vals.chong_tham ?? 0,
      boi: vals.boi ? 1 : 0,
      be_so_con: vals.be_so_con ?? 0,
      can_mang: vals.can_mang ?? 0,
      mat: vals.mat || null,           mat_dl: vals.mat_dl ?? null,
      song_1: vals.song_1 || null,     song_1_dl: vals.song_1_dl ?? null,
      mat_1: vals.mat_1 || null,       mat_1_dl: vals.mat_1_dl ?? null,
      song_2: vals.song_2 || null,     song_2_dl: vals.song_2_dl ?? null,
      mat_2: vals.mat_2 || null,       mat_2_dl: vals.mat_2_dl ?? null,
      song_3: vals.song_3 || null,     song_3_dl: vals.song_3_dl ?? null,
      mat_3: vals.mat_3 || null,       mat_3_dl: vals.mat_3_dl ?? null,
      phan_xuong: vals.phan_xuong || null,
      loai: vals.loai || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
      ton_toi_thieu: vals.ton_toi_thieu ?? null,
      ton_toi_da: vals.ton_toi_da ?? null,
      khong_tinh_nxt: vals.khong_tinh_nxt ?? false,
      to_hop_song: vals.to_hop_song ?? null,
      loai_be: vals.loai_be ?? null,
      be_hai_manh: vals.be_hai_manh ?? false,
      ho_mo: vals.ho_mo ?? null,
      ho_nap: vals.ho_nap ?? null,
      ho_day: vals.ho_day ?? null,
      co_be: vals.co_be ?? false,
      be_lo: vals.be_lo ?? false,
      do_kho: vals.do_kho ?? false,
      do_phu: vals.do_phu ?? false,
      may_in: vals.may_in ?? null,
      ban_ve_kt: vals.ban_ve_kt ?? null,
      nhom_san_pham: vals.nhom_san_pham ?? null,
      co_tem_offset: vals.co_tem_offset ?? false,
      tem_loai_giay: vals.tem_loai_giay ?? null,
      tem_gsm: vals.tem_gsm ?? null,
      tem_dai_to: vals.tem_dai_to ?? null,
      tem_rong_to: vals.tem_rong_to ?? null,
      tem_sp_per_to: vals.tem_sp_per_to ?? 1,
      tem_waste_to: vals.tem_waste_to ?? 0,
      tem_so_mau: vals.tem_so_mau ?? 0,
      tem_co_can_mang: vals.tem_co_can_mang ?? false,
      tem_co_khuon_be: vals.tem_co_khuon_be ?? false,
      tem_co_uv: vals.tem_co_uv ?? false,
      tem_co_suppo: vals.tem_co_suppo ?? false,
      tem_co_luoi: vals.tem_co_luoi ?? false,
      tem_hai_manh: vals.tem_hai_manh ?? false,
      tem_khac_thiet_ke: vals.tem_khac_thiet_ke ?? false,
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
        width={900}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Tabs size="small" items={[
            {
              key: '1',
              label: 'Cơ bản',
              children: (
                <>
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
                    <Select allowClear placeholder="Chọn loại thùng..." options={LOAI_THUNG_GROUPED} />
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Số lớp" name="so_lop">
                        <Select options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))} />
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
                    <Col span={4}>
                      <Form.Item label="Ghim" name="ghim" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item label="Dán" name="dan" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="Phân xưởng" name="phan_xuong">
                        <Input placeholder="Phân xưởng sản xuất" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Loại" name="loai">
                        <Input placeholder="Loại sản phẩm" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Nhóm sản phẩm" name="nhom_san_pham">
                        <Input placeholder="Nhóm SP" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Ghi chú" name="ghi_chu">
                        <Input placeholder="Ghi chú thêm" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Bản vẽ kỹ thuật" name="ban_ve_kt">
                    <Input placeholder="Link hoặc mã bản vẽ" />
                  </Form.Item>

                  {editing && (
                    <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
                      <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
                    </Form.Item>
                  )}
                </>
              ),
            },
            {
              key: '2',
              label: 'Gia công',
              children: (
                <>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Loại in" name="loai_in">
                        <Select options={LOAI_IN_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Loại lằn" name="loai_lan">
                        <Select allowClear placeholder="Không" options={LOAI_LAN_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Chống thấm" name="chong_tham">
                        <Select options={CHONG_THAM_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Cán màng" name="can_mang">
                        <Select options={CAN_MANG_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Bế số con" name="be_so_con">
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Chấp xả" name="chap_xa" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Bồi" name="boi" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="Loại bế" name="loai_be">
                        <Select allowClear placeholder="Không bế" options={LOAI_BE_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Máy in" name="may_in">
                        <Select allowClear placeholder="Chọn máy in" options={MAY_IN_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={4}><Form.Item label="Bế 2 mảnh" name="be_hai_manh" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Có bế" name="co_be" valuePropName="checked"><Switch /></Form.Item></Col>
                  </Row>

                  <Form.Item noStyle shouldUpdate={(p, c) => p.loai_thung !== c.loai_thung}>
                    {({ getFieldValue, setFieldsValue }) => getFieldValue('loai_thung') === 'A1' && (
                      <>
                        <Form.Item name="ho_mo" valuePropName="checked" style={{ marginBottom: 8 }}>
                          <Checkbox onChange={e => { if (!e.target.checked) setFieldsValue({ ho_nap: null, ho_day: null }) }}>
                            Hở nắp / Hở đáy
                          </Checkbox>
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate={(p, c) => p.ho_mo !== c.ho_mo || p.rong !== c.rong || p.ho_nap !== c.ho_nap || p.ho_day !== c.ho_day}>
                          {({ getFieldValue: gfv }) => gfv('ho_mo') && (
                            <Row gutter={12} style={{ marginBottom: 12 }}>
                              <Col span={6}>
                                <Form.Item label="Hở nắp (cm)" name="ho_nap">
                                  <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item label="Hở đáy (cm)" name="ho_day">
                                  <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
                                </Form.Item>
                              </Col>
                              {gfv('rong') != null && (
                                <Col span={12} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 24 }}>
                                  <Typography.Text style={{ fontSize: 11, color: '#888' }}>
                                    Cánh T: {(((gfv('rong') ?? 0) / 2) - ((gfv('ho_nap') ?? 0) / 2)).toFixed(1)} cm
                                    &nbsp;|&nbsp;
                                    Cánh D: {(((gfv('rong') ?? 0) / 2) - ((gfv('ho_day') ?? 0) / 2)).toFixed(1)} cm
                                  </Typography.Text>
                                </Col>
                              )}
                            </Row>
                          )}
                        </Form.Item>
                      </>
                    )}
                  </Form.Item>

                  <Row gutter={12}>
                    <Col span={4}><Form.Item label="Bế lỗ" name="be_lo" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Độ khô" name="do_kho" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Độ phủ" name="do_phu" valuePropName="checked"><Switch /></Form.Item></Col>
                  </Row>
                </>
              ),
            },
            {
              key: '3',
              label: 'Cấu trúc giấy',
              children: (
                <>
                  <Form.Item label="Tổ hợp sóng" name="to_hop_song" style={{ marginBottom: 12 }}>
                    <Select
                      allowClear
                      placeholder="Chọn tổ hợp sóng"
                      options={
                        (TO_HOP_SONG_OPTIONS[form.getFieldValue('so_lop') ?? 3] ?? [])
                          .map((v: string) => ({ value: v, label: v }))
                      }
                    />
                  </Form.Item>
                  <Row style={{ marginBottom: 4, color: '#999', fontSize: 11 }}>
                    <Col style={{ width: 80 }}>Lớp</Col>
                    <Col flex={1} style={{ paddingLeft: 8 }}>Mã giấy</Col>
                    <Col style={{ width: 140, paddingLeft: 8 }}>Định lượng (g/m²)</Col>
                  </Row>
                  {PAPER_LAYERS.map(layer => (
                    <Row key={layer.code} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col style={{ width: 80, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: '#555' }}>{layer.label}</span>
                      </Col>
                      <Col flex={1}>
                        <Form.Item name={layer.code} noStyle>
                          <Input placeholder="Mã giấy" />
                        </Form.Item>
                      </Col>
                      <Col style={{ width: 140 }}>
                        <Form.Item name={layer.dl} noStyle>
                          <InputNumber min={0} style={{ width: '100%' }} placeholder="0" addonAfter="g/m²" />
                        </Form.Item>
                      </Col>
                    </Row>
                  ))}
                </>
              ),
            },
            {
              key: '4',
              label: 'Kho',
              children: (
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item label="Tồn tối thiểu" name="ton_toi_thieu">
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Tồn tối đa" name="ton_toi_da">
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="—" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Không tính NXT" name="khong_tinh_nxt" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: '5',
              label: 'Tem Offset',
              children: (
                <>
                  <Form.Item label="Có tem offset" name="co_tem_offset" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Loại giấy tem" name="tem_loai_giay">
                        <Input placeholder="VD: C2S, Couche" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Định lượng tem (g/m²)" name="tem_gsm">
                        <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="0" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Dài tờ (mm)" name="tem_dai_to">
                        <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Rộng tờ (mm)" name="tem_rong_to">
                        <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="SP/tờ" name="tem_sp_per_to">
                        <InputNumber style={{ width: '100%' }} min={1} placeholder="1" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Tờ hao (waste)" name="tem_waste_to">
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Số màu" name="tem_so_mau">
                        <InputNumber style={{ width: '100%' }} min={0} max={10} placeholder="0" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12} style={{ marginTop: 8 }}>
                    <Col span={4}><Form.Item label="Cán màng" name="tem_co_can_mang" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Khuôn bế" name="tem_co_khuon_be" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="UV" name="tem_co_uv" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Suppo" name="tem_co_suppo" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Lưới" name="tem_co_luoi" valuePropName="checked"><Switch /></Form.Item></Col>
                    <Col span={4}><Form.Item label="Hai mảnh" name="tem_hai_manh" valuePropName="checked"><Switch /></Form.Item></Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={4}><Form.Item label="Khắc thiết kế" name="tem_khac_thiet_ke" valuePropName="checked"><Switch /></Form.Item></Col>
                  </Row>
                </>
              ),
            },
          ]} />
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
