import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm,
  Select, Space, Switch, Table, Tag, Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { temPaperPricesApi, type TemPaperPrice, type TemPaperPriceCreate } from '../../api/temPaperPrices'

const { Title } = Typography

const LOAI_OPTIONS = [
  { value: 'duplex',  label: 'Duplex (DUP)' },
  { value: 'ivory',   label: 'Ivory' },
  { value: 'couche',  label: 'Couche' },
  { value: 'kraft',   label: 'Kraft' },
]

const LOAI_LABEL: Record<string, string> = {
  duplex: 'Duplex', ivory: 'Ivory', couche: 'Couche', kraft: 'Kraft',
}

export default function TemPaperPriceList() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; record?: TemPaperPrice }>({ open: false })
  const [form] = Form.useForm()

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ['tem-paper-prices'],
    queryFn: () => temPaperPricesApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body: TemPaperPriceCreate) => temPaperPricesApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tem-paper-prices'] }); closeModal(); message.success('Đã thêm') },
    onError: () => message.error('Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<TemPaperPriceCreate> }) =>
      temPaperPricesApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tem-paper-prices'] }); closeModal(); message.success('Đã cập nhật') },
    onError: () => message.error('Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => temPaperPricesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tem-paper-prices'] }); message.success('Đã xoá') },
    onError: () => message.error('Lỗi khi xoá'),
  })

  const toggleActive = (rec: TemPaperPrice) =>
    updateMut.mutate({ id: rec.id, body: { active: !rec.active } })

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ active: true, gsm: null })
    setModal({ open: true })
  }

  const openEdit = (rec: TemPaperPrice) => {
    form.setFieldsValue({ ...rec, gsm: rec.gsm ?? null })
    setModal({ open: true, record: rec })
  }

  const closeModal = () => { setModal({ open: false }); form.resetFields() }

  const handleOk = async () => {
    const values = await form.validateFields()
    if (modal.record) {
      updateMut.mutate({ id: modal.record.id, body: values })
    } else {
      createMut.mutate(values)
    }
  }

  const cols: ColumnsType<TemPaperPrice> = [
    {
      title: 'Loại giấy', dataIndex: 'loai_giay', width: 110,
      render: v => <Tag color="purple">{LOAI_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Tên', dataIndex: 'ten', ellipsis: true },
    {
      title: 'GSM (g/m²)', dataIndex: 'gsm', width: 100, align: 'right',
      render: v => v != null ? v : <span style={{ color: '#aaa' }}>—</span>,
    },
    {
      title: 'Đơn giá (đ/kg)', dataIndex: 'don_gia_kg', width: 140, align: 'right',
      render: v => Number(v).toLocaleString('vi-VN'),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
    {
      title: 'Kích hoạt', dataIndex: 'active', width: 90, align: 'center',
      render: (v, rec) => (
        <Switch size="small" checked={v} onChange={() => toggleActive(rec)} loading={updateMut.isPending} />
      ),
    },
    {
      title: '', width: 80, align: 'center',
      render: (_, rec) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rec)} />
          <Popconfirm title="Xoá mục này?" onConfirm={() => deleteMut.mutate(rec.id)} okText="Xoá" cancelText="Huỷ">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Danh mục giá giấy tem</Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>Tải lại</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm mới</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={data}
        columns={cols}
        loading={isFetching}
        size="small"
        pagination={{ pageSize: 50 }}
      />

      <Modal
        open={modal.open}
        title={modal.record ? 'Cập nhật giá giấy tem' : 'Thêm giá giấy tem'}
        onOk={handleOk}
        onCancel={closeModal}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="loai_giay" label="Loại giấy" rules={[{ required: true }]}>
            <Select options={LOAI_OPTIONS} placeholder="Chọn loại giấy" />
          </Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}>
            <Input placeholder="VD: Duplex 300gsm C2S" />
          </Form.Item>
          <Form.Item name="gsm" label="GSM (g/m²) — để trống nếu dùng cho mọi gsm">
            <Select allowClear placeholder="Chọn GSM hoặc để trống"
              options={[200, 230, 250, 300, 350].map(g => ({ value: g, label: `${g} g/m²` }))}
            />
          </Form.Item>
          <Form.Item name="don_gia_kg" label="Đơn giá (đ/kg)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }} min={0} step={1000}
              formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
              placeholder="VD: 35000"
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="active" label="Kích hoạt" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
