import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, Tag, Popconfirm, message, Typography, Row, Col, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { taiXeApi, type TaiXe } from '../../api/simpleApis'
import { hrApi } from '../../api/hr'
import ImportExcelButton from '../../components/ImportExcelButton'
import EmptyState from "../../components/EmptyState"

const { Title } = Typography

export default function TaiXeList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaiXe | null>(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['tai-xe'], queryFn: () => taiXeApi.list().then(r => r.data) })
  const { data: employees = [] } = useQuery({ queryKey: ['hr-employees'], queryFn: () => hrApi.listEmployees().then(r => r.data) })

  const createMut = useMutation({
    mutationFn: (d: Omit<TaiXe, 'id'>) => taiXeApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tai-xe'] }); closeModal(); message.success('Da them tai xe') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi them'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<TaiXe, 'id'>> }) => taiXeApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tai-xe'] }); closeModal(); message.success('Da cap nhat') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi cap nhat'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => taiXeApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tai-xe'] }); message.success('Da xoa') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Loi khi xoa'),
  })

  const employeeOptions = employees.map((e: unknown) => { const emp = e as { id: number; ma_nv: string; ho_ten: string }; return { value: emp.id, label: `${emp.ma_nv} - ${emp.ho_ten}` } })
  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: true, he_so_chuyen: 1 }); setModalOpen(true) }
  const openEdit = (row: TaiXe) => { setEditing(row); form.setFieldsValue({ ...row }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<TaiXe, 'id'> = {
      ho_ten: vals.ho_ten,
      so_dien_thoai: vals.so_dien_thoai || null,
      so_bang_lai: vals.so_bang_lai || null,
      employee_id: vals.employee_id ?? null,
      he_so_chuyen: vals.he_so_chuyen ?? 1,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload)
  }

  const columns: ColumnsType<TaiXe> = [
    { title: 'Ho ten', dataIndex: 'ho_ten' },
    { title: 'SDT', dataIndex: 'so_dien_thoai', width: 130, render: (v: string | null) => v ?? '-' },
    { title: 'Bang lai', dataIndex: 'so_bang_lai', width: 140, render: (v: string | null) => v ?? '-' },
    { title: 'Nhan vien HR', dataIndex: 'employee_id', width: 180, render: (v: number | null) => employeeOptions.find(e => e.value === v)?.label || '-' },
    { title: 'He so chuyen', dataIndex: 'he_so_chuyen', width: 120, align: 'right', render: (v: number) => v ?? 1 },
    { title: 'Trang thai', dataIndex: 'trang_thai', width: 110, align: 'center', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Dang dung' : 'Ngung'}</Tag> },
    {
      title: '', key: 'act', width: 90,
      render: (_: unknown, r: TaiXe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoa tai xe nay?" onConfirm={() => deleteMut.mutate(r.id)}>
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
          <Col><Title level={4} style={{ margin: 0 }}>Danh muc tai xe</Title></Col>
          <Col>
            <Space>
              <ImportExcelButton endpoint="/api/tai-xe" templateFilename="mau_import_tai_xe.xlsx" buttonText="Import Excel" onImported={() => queryClient.invalidateQueries({ queryKey: ['tai-xe'] })} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Them moi</Button>
            </Space>
          </Col>
        </Row>
        <Table rowKey="id" dataSource={data} columns={columns} loading={isLoading} pagination={{ pageSize: 20 }} size="small" />
      </Card>

      <Modal title={editing ? 'Sua tai xe' : 'Them tai xe'} open={modalOpen} onCancel={closeModal} onOk={handleSave} confirmLoading={createMut.isPending || updateMut.isPending} okText="Luu" cancelText="Huy" destroyOnClose>
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Ho ten" name="ho_ten" rules={[{ required: true, message: 'Nhap ho ten tai xe' }]}><Input /></Form.Item>
          <Form.Item label="So dien thoai" name="so_dien_thoai"><Input /></Form.Item>
          <Form.Item label="So bang lai" name="so_bang_lai"><Input /></Form.Item>
          <Form.Item label="Gan nhan vien HR" name="employee_id"><Select allowClear showSearch optionFilterProp="label" options={employeeOptions} /></Form.Item>
          <Form.Item label="He so chuyen" name="he_so_chuyen" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Ghi chu" name="ghi_chu"><Input /></Form.Item>
          <Form.Item label="Dang dung" name="trang_thai" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
