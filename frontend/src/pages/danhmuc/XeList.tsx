import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Tag, Popconfirm, message, Typography, Row, Col, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { xeApi, type Xe } from '../../api/simpleApis'
import ImportExcelButton from '../../components/ImportExcelButton'

const { Title } = Typography

export default function XeList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Xe | null>(null)

  const { data = [], isLoading } = useQuery({ queryKey: ['xe'], queryFn: () => xeApi.list().then(r => r.data) })

  const createMut = useMutation({
    mutationFn: (d: Omit<Xe, 'id'>) => xeApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['xe'] }); closeModal(); message.success('Da them xe') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi them'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Xe, 'id'>> }) => xeApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['xe'] }); closeModal(); message.success('Da cap nhat') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi cap nhat'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => xeApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['xe'] }); message.success('Da xoa') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi xoa'),
  })

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: true, dinh_muc_dau: 0 }); setModalOpen(true) }
  const openEdit = (row: Xe) => { setEditing(row); form.setFieldsValue({ ...row }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<Xe, 'id'> = {
      bien_so: vals.bien_so,
      loai_xe: vals.loai_xe || null,
      trong_tai: vals.trong_tai ?? null,
      dinh_muc_dau: vals.dinh_muc_dau ?? 0,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload)
  }

  const columns: ColumnsType<Xe> = [
    { title: 'Bien so', dataIndex: 'bien_so', width: 130 },
    { title: 'Loai xe', dataIndex: 'loai_xe', render: (v: string | null) => v ?? '-' },
    { title: 'Trong tai (tan)', dataIndex: 'trong_tai', width: 130, align: 'right', render: (v: number | null) => v ?? '-' },
    { title: 'Dinh muc dau', dataIndex: 'dinh_muc_dau', width: 130, align: 'right', render: (v: number | null) => v != null ? `${v} L/100km` : '-' },
    { title: 'Ghi chu', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '-' },
    { title: 'Trang thai', dataIndex: 'trang_thai', width: 110, align: 'center', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Dang dung' : 'Ngung'}</Tag> },
    {
      title: '', key: 'act', width: 90,
      render: (_: unknown, r: Xe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoa xe nay?" onConfirm={() => deleteMut.mutate(r.id)}>
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
          <Col><Title level={4} style={{ margin: 0 }}>Danh muc xe</Title></Col>
          <Col>
            <Space>
              <ImportExcelButton endpoint="/api/xe" templateFilename="mau_import_xe.xlsx" buttonText="Import Excel" onImported={() => queryClient.invalidateQueries({ queryKey: ['xe'] })} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Them moi</Button>
            </Space>
          </Col>
        </Row>
        <Table rowKey="id" dataSource={data} columns={columns} loading={isLoading} pagination={{ pageSize: 20 }} size="small" />
      </Card>

      <Modal title={editing ? 'Sua xe' : 'Them xe'} open={modalOpen} onCancel={closeModal} onOk={handleSave} confirmLoading={createMut.isPending || updateMut.isPending} okText="Luu" cancelText="Huy" destroyOnClose>
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Bien so" name="bien_so" rules={[{ required: true, message: 'Nhap bien so xe' }]}>
            <Input placeholder="VD: 51A-12345" disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Loai xe" name="loai_xe"><Input placeholder="VD: Tai nhe, container..." /></Form.Item>
          <Form.Item label="Trong tai (tan)" name="trong_tai"><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Dinh muc dau (L/100km)" name="dinh_muc_dau"><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Ghi chu" name="ghi_chu"><Input /></Form.Item>
          <Form.Item label="Dang dung" name="trang_thai" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
