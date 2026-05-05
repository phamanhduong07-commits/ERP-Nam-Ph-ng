import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Form, Input, Modal, Row, Select, Space, Switch, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { rolesApi } from '../../api/permissions'
import { usersApi, type NhanVien, type UserCreatePayload, type UserUpdatePayload } from '../../api/usersApi'

const { Title } = Typography

const PHAN_XUONG_OPTIONS = [
  { value: 'in', label: 'In' },
  { value: 'boi_va_cat', label: 'Bồi và cắt' },
  { value: 'song', label: 'Sóng' },
  { value: 'thanh_pham', label: 'Thành phẩm' },
  { value: 'kinh_doanh', label: 'Kinh doanh' },
  { value: 'ke_toan', label: 'Kế toán' },
  { value: 'quan_ly', label: 'Quản lý' },
]

type UserFormValues = {
  username: string
  ho_ten: string
  email?: string
  so_dien_thoai?: string
  password?: string
  role_id: number
  phan_xuong?: string
  trang_thai?: boolean
}

export default function UserList() {
  const qc = useQueryClient()
  const [form] = Form.useForm<UserFormValues>()
  const [passwordForm] = Form.useForm<{ password: string }>()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterPhanXuong, setFilterPhanXuong] = useState<string | undefined>(undefined)
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<NhanVien | null>(null)
  const [open, setOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<NhanVien | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['users', search, filterPhanXuong, showInactive],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        phan_xuong: filterPhanXuong,
        trang_thai: showInactive ? undefined : true,
      }).then(r => r.data),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', 'active'],
    queryFn: () => rolesApi.active().then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (editing) {
        const payload: UserUpdatePayload = {
          ho_ten: values.ho_ten,
          email: values.email || null,
          so_dien_thoai: values.so_dien_thoai || null,
          role_id: values.role_id,
          phan_xuong: values.phan_xuong || null,
          trang_thai: values.trang_thai ?? true,
        }
        return usersApi.update(editing.id, payload)
      }
      const payload: UserCreatePayload = {
        username: values.username,
        ho_ten: values.ho_ten,
        email: values.email || null,
        so_dien_thoai: values.so_dien_thoai || null,
        password: values.password || '',
        role_id: values.role_id,
        phan_xuong: values.phan_xuong || null,
      }
      return usersApi.create(payload)
    },
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản')
      setOpen(false)
      setEditing(null)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không lưu được tài khoản'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (password: string) => usersApi.resetPassword(resetTarget!.id, password),
    onSuccess: () => {
      message.success('Đã đặt lại mật khẩu')
      setResetTarget(null)
      passwordForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không đặt lại được mật khẩu'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setOpen(true)
  }

  const openEdit = (record: NhanVien) => {
    setEditing(record)
    form.setFieldsValue({
      username: record.username,
      ho_ten: record.ho_ten,
      email: record.email || undefined,
      so_dien_thoai: record.so_dien_thoai || undefined,
      role_id: record.role_id,
      phan_xuong: record.phan_xuong || undefined,
      trang_thai: record.trang_thai,
    })
    setOpen(true)
  }

  const columns: ColumnsType<NhanVien> = [
    { title: 'Họ tên', dataIndex: 'ho_ten', width: 180 },
    { title: 'Username', dataIndex: 'username', width: 130 },
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'SĐT',
      dataIndex: 'so_dien_thoai',
      width: 120,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'Vai trò',
      dataIndex: 'role_name',
      width: 160,
      render: (_: string | null, r) => <Tag color="geekblue">{r.role_name || r.role_code || '-'}</Tag>,
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'phan_xuong',
      width: 130,
      render: (v: string | null) => v ? (PHAN_XUONG_OPTIONS.find(o => o.value === v)?.label ?? v) : '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Hoạt động' : 'Ngừng'}</Tag>,
    },
    {
      title: '',
      width: 110,
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Button icon={<KeyOutlined />} size="small" onClick={() => setResetTarget(record)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Tài khoản và phân quyền</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm tên, username..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => setSearch(v)}
                allowClear
                style={{ width: 220 }}
              />
              <Select
                placeholder="Lọc phân xưởng"
                allowClear
                style={{ width: 170 }}
                value={filterPhanXuong}
                onChange={v => setFilterPhanXuong(v)}
                options={PHAN_XUONG_OPTIONS}
              />
              <Switch checked={showInactive} onChange={setShowInactive} checkedChildren="Tất cả" unCheckedChildren="Đang dùng" />
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['users'] })} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo tài khoản</Button>
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
        title={editing ? 'Sửa tài khoản' : 'Tạo tài khoản'}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={values => saveMutation.mutate(values)}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Nhập username' }]}>
                <Input disabled={!!editing} autoComplete="off" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ho_ten" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                <Input />
              </Form.Item>
            </Col>
            {!editing && (
              <Col span={12}>
                <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6, message: 'Ít nhất 6 ký tự' }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item name="role_id" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
                <Select options={roles.map(r => ({ value: r.id, label: `${r.ten_vai_tro} (${r.ma_vai_tro})` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="so_dien_thoai" label="SĐT">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phan_xuong" label="Phân xưởng">
                <Select allowClear options={PHAN_XUONG_OPTIONS} />
              </Form.Item>
            </Col>
            {editing && (
              <Col span={12}>
                <Form.Item name="trang_thai" label="Hoạt động" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>

      <Modal
        title={`Đặt lại mật khẩu: ${resetTarget?.username || ''}`}
        open={!!resetTarget}
        onCancel={() => { setResetTarget(null); passwordForm.resetFields() }}
        onOk={() => passwordForm.submit()}
        confirmLoading={resetPasswordMutation.isPending}
      >
        <Form form={passwordForm} layout="vertical" onFinish={v => resetPasswordMutation.mutate(v.password)}>
          <Form.Item name="password" label="Mật khẩu mới" rules={[{ required: true, min: 6, message: 'Ít nhất 6 ký tự' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
