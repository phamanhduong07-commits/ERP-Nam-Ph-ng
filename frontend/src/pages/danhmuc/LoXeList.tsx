import { useState } from 'react'
import { useHotkey } from '../../hooks/useHotkey'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select, Tag, Popconfirm, message, Typography, Row, Col, Switch, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { loXeApi, type LoXe } from '../../api/simpleApis'
import { hrApi } from '../../api/hr'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography

export default function LoXeList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LoXe | null>(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['lo-xe'], queryFn: () => loXeApi.list().then(r => r.data) })
  const { data: employees = [] } = useQuery({ queryKey: ['hr-employees'], queryFn: () => hrApi.listEmployees().then(r => r.data) })

  const syncMut = useMutation({
    mutationFn: () => loXeApi.syncFromEmployees(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['lo-xe'] })
      message.success(`Đồng bộ xong: thêm mới ${res.data.created}, cập nhật ${res.data.updated} lơ xe`)
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi đồng bộ'),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<LoXe, 'id'>) => loXeApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lo-xe'] }); closeModal(); message.success('Đã thêm lơ xe') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<LoXe, 'id'>> }) => loXeApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lo-xe'] }); closeModal(); message.success('Đã cập nhật') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => loXeApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lo-xe'] }); message.success('Đã xoá') },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const employeeOptions = employees.map((e: unknown) => { const emp = e as { id: number; ma_nv: string; ho_ten: string }; return { value: emp.id, label: `${emp.ma_nv} - ${emp.ho_ten}` } })
  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: true, he_so_chuyen: 0.3 }); setModalOpen(true) }
  const openEdit = (row: LoXe) => { setEditing(row); form.setFieldsValue({ ...row }); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: Omit<LoXe, 'id'> = {
      ho_ten: vals.ho_ten,
      so_dien_thoai: vals.so_dien_thoai || null,
      employee_id: vals.employee_id ?? null,
      he_so_chuyen: vals.he_so_chuyen ?? 0.3,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    editing ? updateMut.mutate({ id: editing.id, data: payload }) : createMut.mutate(payload)
  }

  useHotkey('ctrl+n', openCreate, 'Thêm lơ xe mới')
  useHotkey('ctrl+s', handleSave, 'Lưu lơ xe', 'Trang hiện tại', modalOpen)

  const columns: ColumnsType<LoXe> = [
    { title: 'Họ tên', dataIndex: 'ho_ten' },
    { title: 'SĐT', dataIndex: 'so_dien_thoai', width: 130, render: (v: string | null) => v ?? '-' },
    { title: 'Nhân viên HR', dataIndex: 'employee_id', width: 200, render: (v: number | null) => employeeOptions.find(e => e.value === v)?.label || '-' },
    { title: 'Hệ số chuyến', dataIndex: 'he_so_chuyen', width: 120, align: 'right', render: (v: number) => v ?? 0.3 },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 110, align: 'center', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag> },
    {
      title: '', key: 'act', width: 90,
      render: (_: unknown, r: LoXe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoa lo xe nay?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-lo-xe', columns)

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col><Title level={4} style={{ margin: 0 }}>Danh mục lơ xe</Title></Col>
          <Col>
            <Space>
              <Tooltip title="Tạo/cập nhật lơ xe từ nhân viên có flag 'Là lơ xe' trong hồ sơ HR">
                <Button icon={<SyncOutlined />} loading={syncMut.isPending} onClick={() => syncMut.mutate()}>Đồng bộ từ nhân viên</Button>
              </Tooltip>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm mới</Button>
              {settingsButton}
            </Space>
          </Col>
        </Row>
        <Table rowKey="id" dataSource={data} columns={displayColumns} loading={isLoading} pagination={{ pageSize: 20 }} size="small" />
      </Card>

      <Modal title={editing ? 'Sửa lơ xe' : 'Thêm lơ xe'} open={modalOpen} onCancel={closeModal} onOk={handleSave} confirmLoading={createMut.isPending || updateMut.isPending} okText="Lưu" cancelText="Huỷ" destroyOnClose>
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Họ tên" name="ho_ten" rules={[{ required: true, message: 'Nhập họ tên' }]}><Input /></Form.Item>
          <Form.Item label="Số điện thoại" name="so_dien_thoai"><Input /></Form.Item>
          <Form.Item label="Gắn nhân viên HR" name="employee_id"><Select allowClear showSearch optionFilterProp="label" options={employeeOptions} placeholder="Chọn nhân viên" /></Form.Item>
          <Form.Item label="Hệ số chuyến" name="he_so_chuyen" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu"><Input /></Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
