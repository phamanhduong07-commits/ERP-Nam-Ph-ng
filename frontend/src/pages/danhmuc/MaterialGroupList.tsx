import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Select, Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { materialGroupsApi, type MaterialGroup, type MaterialGroupCreate } from '../../api/materialGroups'

const { Title } = Typography

export default function MaterialGroupList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialGroup | null>(null)
  const [filterGiay, setFilterGiay] = useState<string>('all')

  const laNhomGiayParam =
    filterGiay === 'giay' ? true : filterGiay === 'khac' ? false : undefined

  const { data = [], isLoading } = useQuery({
    queryKey: ['material-groups', filterGiay],
    queryFn: () =>
      materialGroupsApi.list({ la_nhom_giay: laNhomGiayParam }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: MaterialGroupCreate) => materialGroupsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-groups'] })
      closeModal()
      message.success('Đã thêm nhóm vật tư')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm nhóm vật tư'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MaterialGroupCreate> }) =>
      materialGroupsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-groups'] })
      closeModal()
      message.success('Đã cập nhật nhóm vật tư')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => materialGroupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-groups'] })
      message.success('Đã xoá nhóm vật tư')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, la_nhom_giay: false })
    setModalOpen(true)
  }

  const openEdit = (row: MaterialGroup) => {
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
    const payload: MaterialGroupCreate = {
      ma_nhom: vals.ma_nhom,
      ten_nhom: vals.ten_nhom,
      la_nhom_giay: vals.la_nhom_giay ?? false,
      bo_phan: vals.bo_phan || null,
      phan_xuong: vals.phan_xuong || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  const columns: ColumnsType<MaterialGroup> = [
    { title: 'Mã nhóm', dataIndex: 'ma_nhom', width: 110 },
    { title: 'Tên nhóm', dataIndex: 'ten_nhom', ellipsis: true },
    {
      title: 'Là nhóm giấy',
      dataIndex: 'la_nhom_giay',
      width: 120,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'blue' : 'default'}>{v ? 'Nhóm giấy' : 'Nhóm khác'}</Tag>
      ),
    },
    { title: 'Bộ phận', dataIndex: 'bo_phan', width: 130, render: (v: string | null) => v ?? '—' },
    { title: 'Phân xưởng', dataIndex: 'phan_xuong', width: 130, render: (v: string | null) => v ?? '—' },
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
      width: 90,
      render: (_: unknown, r: MaterialGroup) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá nhóm vật tư này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Nhóm vật tư</Title>
          </Col>
          <Col>
            <Space>
              <Select
                value={filterGiay}
                style={{ width: 160 }}
                onChange={v => setFilterGiay(v)}
                options={[
                  { value: 'all', label: 'Tất cả nhóm' },
                  { value: 'giay', label: 'Nhóm giấy' },
                  { value: 'khac', label: 'Nhóm khác' },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm nhóm
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa nhóm vật tư' : 'Thêm nhóm vật tư mới'}
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
              <Form.Item label="Mã nhóm" name="ma_nhom" rules={[{ required: true, message: 'Nhập mã nhóm' }]}>
                <Input disabled={!!editing} placeholder="VD: NHOM01" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="Tên nhóm" name="ten_nhom" rules={[{ required: true, message: 'Nhập tên nhóm' }]}>
                <Input placeholder="Tên nhóm vật tư" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Là nhóm giấy" name="la_nhom_giay" valuePropName="checked">
                <Switch checkedChildren="Giấy" unCheckedChildren="Khác" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Bộ phận" name="bo_phan">
                <Input placeholder="Bộ phận phụ trách" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Phân xưởng" name="phan_xuong">
                <Input placeholder="Phân xưởng" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
