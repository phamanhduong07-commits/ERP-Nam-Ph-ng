import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm,
  Select, Space, Switch, Table, Tag, Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  offsetAddonPricesApi,
  LOAI_ADDON_OPTIONS,
  LOAI_ADDON_LABEL,
  type OffsetAddonPrice,
  type OffsetAddonPriceCreate,
} from '../../api/offsetAddonPrices'

const { Title } = Typography

const LOAI_COLOR: Record<string, string> = {
  can_mang:  'blue',
  uv:        'gold',
  suppo:     'green',
  luoi:      'purple',
  in_offset: 'cyan',
}

const LOAI_DON_GIA_LABEL: Record<string, string> = {
  in_offset: 'Giá in/1000 tờ/màu (đ)',
}

export default function OffsetAddonPriceList() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; record?: OffsetAddonPrice }>({ open: false })
  const [form] = Form.useForm()

  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ['offset-addon-prices'],
    queryFn: () => offsetAddonPricesApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (body: OffsetAddonPriceCreate) => offsetAddonPricesApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offset-addon-prices'] }); closeModal(); message.success('Đã thêm') },
    onError: () => message.error('Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<OffsetAddonPriceCreate> }) =>
      offsetAddonPricesApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offset-addon-prices'] }); closeModal(); message.success('Đã cập nhật') },
    onError: () => message.error('Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => offsetAddonPricesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offset-addon-prices'] }); message.success('Đã xoá') },
    onError: () => message.error('Lỗi khi xoá'),
  })

  const toggleActive = (rec: OffsetAddonPrice) =>
    updateMut.mutate({ id: rec.id, body: { active: !rec.active } })

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ active: true })
    setModal({ open: true })
  }

  const openEdit = (rec: OffsetAddonPrice) => {
    form.setFieldsValue({ ...rec })
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

  const cols: ColumnsType<OffsetAddonPrice> = [
    {
      title: 'Loại addon', dataIndex: 'loai_addon', width: 140,
      render: v => <Tag color={LOAI_COLOR[v] ?? 'default'}>{LOAI_ADDON_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Tên', dataIndex: 'ten', ellipsis: true },
    {
      title: 'Đơn giá', dataIndex: 'don_gia_m2', width: 160, align: 'right',
      render: (v, rec) => `${Number(v).toLocaleString('vi-VN')} ${rec.loai_addon === 'in_offset' ? 'đ/1000 tờ/màu' : 'đ/m²'}`,
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
      title={<Title level={4} style={{ margin: 0 }}>Danh mục giá dịch vụ offset</Title>}
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
        title={modal.record ? 'Cập nhật giá dịch vụ offset' : 'Thêm giá dịch vụ offset'}
        onOk={handleOk}
        onCancel={closeModal}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="loai_addon" label="Loại addon" rules={[{ required: true }]}>
            <Select
              options={LOAI_ADDON_OPTIONS}
              placeholder="Chọn loại"
              disabled={!!modal.record}
            />
          </Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ required: true }]}>
            <Input placeholder="VD: UV định hình 1 mặt" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.loai_addon !== cur.loai_addon}
          >
            {({ getFieldValue }) => {
              const isIn = getFieldValue('loai_addon') === 'in_offset'
              return (
                <Form.Item
                  name="don_gia_m2"
                  label={isIn ? 'Giá in/1000 tờ/màu (đ)' : 'Đơn giá (đ/m²)'}
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    style={{ width: '100%' }} min={0} step={isIn ? 10000 : 500}
                    formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                    placeholder={isIn ? 'VD: 150000' : 'VD: 3500'}
                  />
                </Form.Item>
              )
            }}
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
