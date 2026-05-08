import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, DatePicker, Tag, message, Typography, Tabs, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, ToolOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import ImportExcelButton from '../../components/ImportExcelButton'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { ccdcApi, type CCDC, type NhomCCDC, type CCDCCreate, type PhieuXuatCCDC } from '../../api/ccdc'

const { Title } = Typography

const TRANG_THAI_CCDC: Record<string, { label: string; color: string }> = {
  dang_su_dung: { label: 'Đang sử dụng', color: 'green' },
  bao_hanh:     { label: 'Bảo hành',     color: 'blue' },
  mat:          { label: 'Mất',          color: 'default' },
  da_thanh_ly:  { label: 'Đã thanh lý',  color: 'red' },
}

const TRANG_THAI_PHIEU: Record<string, { label: string; color: string }> = {
  cho_duyet: { label: 'Chờ duyệt', color: 'orange' },
  da_duyet:  { label: 'Đã duyệt',  color: 'green' },
  huy:       { label: 'Đã hủy',    color: 'default' },
}

// ─── Tab: Danh mục CCDC ───────────────────────────────────────────────────────

function CCDCTab() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CCDC | null>(null)
  const [search, setSearch] = useState('')

  const { data: nhomList = [] } = useQuery({
    queryKey: ['nhom-ccdc'],
    queryFn: () => ccdcApi.listNhom().then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['ccdc', search],
    queryFn: () => ccdcApi.list({ search: search || undefined }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const createMut = useMutation({
    mutationFn: (d: CCDCCreate) => ccdcApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ccdc'] })
      closeModal()
      message.success('Đã thêm công cụ dụng cụ')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CCDCCreate> }) =>
      ccdcApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ccdc'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: 'dang_su_dung', so_luong: 1, nguyen_gia: 0 })
    setModalOpen(true)
  }

  function openEdit(rec: CCDC) {
    setEditing(rec)
    form.setFieldsValue({
      ...rec,
      ngay_mua: rec.ngay_mua ? dayjs(rec.ngay_mua) : null,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  function handleSubmit(values: any) {
    const payload = {
      ...values,
      ngay_mua: values.ngay_mua ? values.ngay_mua.format('YYYY-MM-DD') : null,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<CCDC> = [
    { title: 'Mã CCDC', dataIndex: 'ma_ccdc', width: 120, render: t => <b>{t}</b> },
    { title: 'Tên công cụ dụng cụ', dataIndex: 'ten_ccdc', ellipsis: true },
    { title: 'Nhóm', dataIndex: 'ten_nhom', width: 140 },
    { title: 'ĐVT', dataIndex: 'don_vi_tinh', width: 70 },
    {
      title: 'SL',
      dataIndex: 'so_luong',
      align: 'right',
      width: 70,
      render: v => Number(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Nguyên giá (đ)',
      dataIndex: 'nguyen_gia',
      align: 'right',
      width: 140,
      render: v => Number(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Giá trị còn lại (đ)',
      dataIndex: 'gia_tri_con_lai',
      align: 'right',
      width: 150,
      render: v => Number(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Ngày mua',
      dataIndex: 'ngay_mua',
      width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '',
    },
    { title: 'Bộ phận', dataIndex: 'bo_phan_su_dung', width: 140, ellipsis: true },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: v => {
        const s = TRANG_THAI_CCDC[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '',
      width: 60,
      render: (_, rec) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Tìm mã, tên CCDC..."
          allowClear
          style={{ width: 260 }}
          onSearch={setSearch}
        />
        <ImportExcelButton
          endpoint="/api/ccdc"
          templateFilename="mau_import_ccdc.xlsx"
          buttonText="Import CCDC"
          onImported={() => queryClient.invalidateQueries({ queryKey: ['ccdc'] })}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm CCDC</Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ x: 1100 }}
      />

      <Modal
        title={editing ? 'Sửa công cụ dụng cụ' : 'Thêm công cụ dụng cụ'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="ma_ccdc" label="Mã CCDC" rules={[{ required: true }]}>
            <Input disabled={!!editing} placeholder="VD: CCDC-001" />
          </Form.Item>
          <Form.Item name="ten_ccdc" label="Tên công cụ dụng cụ" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nhom_id" label="Nhóm CCDC">
            <Select
              allowClear
              placeholder="Chọn nhóm"
              options={(Array.isArray(nhomList) ? nhomList : []).map(n => ({ value: n.id, label: n.ten_nhom }))}
            />
          </Form.Item>
          <Space style={{ width: '100%' }} direction="vertical">
            <Space>
              <Form.Item name="don_vi_tinh" label="Đơn vị tính" style={{ marginBottom: 0 }}>
                <Input style={{ width: 100 }} placeholder="Cái, Bộ..." />
              </Form.Item>
              <Form.Item name="so_luong" label="Số lượng" style={{ marginBottom: 0 }}>
                <InputNumber min={0} style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name="ngay_mua" label="Ngày mua" style={{ marginBottom: 0 }}>
                <DatePicker format="DD/MM/YYYY" />
              </Form.Item>
            </Space>
          </Space>
          <Space style={{ width: '100%', marginTop: 12 }}>
            <Form.Item name="nguyen_gia" label="Nguyên giá (đ)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: 160 }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => v?.replace(/,/g, '') as any}
                min={0}
              />
            </Form.Item>
            <Form.Item name="gia_tri_con_lai" label="Giá trị còn lại (đ)" style={{ marginBottom: 0 }}>
              <InputNumber
                style={{ width: 160 }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => v?.replace(/,/g, '') as any}
                min={0}
              />
            </Form.Item>
            <Form.Item name="thoi_gian_phan_bo" label="Thời gian PB (tháng)" style={{ marginBottom: 0 }}>
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="bo_phan_su_dung" label="Bộ phận sử dụng" style={{ marginTop: 12 }}>
            <Input placeholder="VD: Xưởng sản xuất" />
          </Form.Item>
          <Form.Item name="trang_thai" label="Trạng thái">
            <Select
              options={Object.entries(TRANG_THAI_CCDC).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ─── Tab: Phiếu xuất CCDC ─────────────────────────────────────────────────────

function PhieuXuatTab() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)

  const { data: ccdcList = [] } = useQuery({
    queryKey: ['ccdc'],
    queryFn: () => ccdcApi.list({ trang_thai: 'dang_su_dung' }).then(r => Array.isArray(r.data) ? r.data : []),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['phieu-xuat-ccdc'],
    queryFn: () => ccdcApi.listPhieuXuat().then(r => Array.isArray(r.data) ? r.data : []),
  })

  const createMut = useMutation({
    mutationFn: (d: any) => ccdcApi.createPhieuXuat(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phieu-xuat-ccdc'] })
      setModalOpen(false)
      form.resetFields()
      message.success('Đã tạo phiếu xuất CCDC')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi tạo phiếu'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => ccdcApi.approvePhieuXuat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phieu-xuat-ccdc'] })
      message.success('Đã duyệt phiếu xuất')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => ccdcApi.cancelPhieuXuat(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phieu-xuat-ccdc'] })
      message.success('Đã hủy phiếu')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  function handleSubmit(values: any) {
    createMut.mutate({
      ...values,
      ngay_xuat: values.ngay_xuat.format('YYYY-MM-DD'),
    })
  }

  const columns: ColumnsType<PhieuXuatCCDC> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 180, render: t => <b>{t}</b> },
    {
      title: 'Ngày xuất',
      dataIndex: 'ngay_xuat',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Người nhận', dataIndex: 'nguoi_nhan', width: 150 },
    { title: 'Bộ phận', dataIndex: 'bo_phan', width: 140 },
    { title: 'Lý do', dataIndex: 'ly_do', ellipsis: true },
    {
      title: 'Số dòng',
      width: 80,
      align: 'center',
      render: (_, rec) => rec.items.length,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: v => {
        const s = TRANG_THAI_PHIEU[v] || { label: v, color: 'default' }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 140,
      render: (_, rec) => (
        <Space size="small">
          {rec.trang_thai === 'cho_duyet' && (
            <Popconfirm
              title="Duyệt phiếu xuất CCDC?"
              onConfirm={() => approveMut.mutate(rec.id)}
            >
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
            </Popconfirm>
          )}
          {rec.trang_thai === 'cho_duyet' && (
            <Popconfirm title="Hủy phiếu này?" onConfirm={() => cancelMut.mutate(rec.id)}>
              <Button size="small" danger icon={<CloseCircleOutlined />}>Hủy</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ ngay_xuat: dayjs(), items: [{}] }); setModalOpen(true) }}>
          Tạo phiếu xuất
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading}
        pagination={{ pageSize: 20 }}
        size="small"
        expandable={{
          expandedRowRender: rec => (
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={rec.items}
              columns={[
                { title: 'Tên CCDC', dataIndex: 'ten_ccdc' },
                { title: 'Số lượng', dataIndex: 'so_luong', align: 'right', width: 100 },
                { title: 'Ghi chú', dataIndex: 'ghi_chu' },
              ]}
            />
          ),
        }}
      />

      <Modal
        title="Tạo phiếu xuất CCDC"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Space>
            <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="nguoi_nhan" label="Người nhận">
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="bo_phan" label="Bộ phận">
              <Input style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Form.Item name="ly_do" label="Lý do xuất">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ marginBottom: 4 }}>
                    <Form.Item
                      {...rest}
                      name={[name, 'ccdc_id']}
                      label={name === 0 ? 'CCDC' : ''}
                      rules={[{ required: true, message: 'Chọn CCDC' }]}
                    >
                      <Select
                        style={{ width: 300 }}
                        showSearch
                        optionFilterProp="label"
                        placeholder="Chọn công cụ dụng cụ"
                        options={ccdcList.map(c => ({ value: c.id, label: `${c.ma_ccdc} — ${c.ten_ccdc}` }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'so_luong']}
                      label={name === 0 ? 'Số lượng' : ''}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={0.01} style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'ghi_chu']}
                      label={name === 0 ? 'Ghi chú' : ''}
                    >
                      <Input style={{ width: 180 }} />
                    </Form.Item>
                    <Button danger onClick={() => remove(name)}>Xóa</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Thêm dòng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  )
}

// ─── Tab: Nhóm CCDC ───────────────────────────────────────────────────────────

function NhomTab() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NhomCCDC | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['nhom-ccdc'],
    queryFn: () => ccdcApi.listNhom().then(r => Array.isArray(r.data) ? r.data : []),
  })

  const createMut = useMutation({
    mutationFn: (d: any) => ccdcApi.createNhom(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nhom-ccdc'] }); setModalOpen(false); form.resetFields(); message.success('Đã thêm nhóm') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => ccdcApi.updateNhom(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nhom-ccdc'] }); setModalOpen(false); form.resetFields(); message.success('Đã cập nhật') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true) }}>
          Thêm nhóm
        </Button>
      </Space>
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Mã nhóm', dataIndex: 'ma_nhom', width: 120 },
          { title: 'Tên nhóm', dataIndex: 'ten_nhom' },
          { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
          {
            title: '',
            width: 60,
            render: (_, rec) => (
              <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(rec); form.setFieldsValue(rec); setModalOpen(true) }} />
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Sửa nhóm CCDC' : 'Thêm nhóm CCDC'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={v => editing ? updateMut.mutate({ id: editing.id, data: v }) : createMut.mutate(v)}>
          <Form.Item name="ma_nhom" label="Mã nhóm" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="ten_nhom" label="Tên nhóm" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CCDCListPage() {
  return (
    <Card title={<Space><ToolOutlined /><Title level={4} style={{ margin: 0 }}>Công cụ dụng cụ (CCDC)</Title></Space>}>
      <Tabs
        items={[
          { key: 'ccdc', label: 'Danh mục CCDC', children: <CCDCTab /> },
          { key: 'phieu-xuat', label: 'Phiếu xuất CCDC', children: <PhieuXuatTab /> },
          { key: 'nhom', label: 'Nhóm CCDC', children: <NhomTab /> },
        ]}
      />
    </Card>
  )
}
