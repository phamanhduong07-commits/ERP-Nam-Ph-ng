import { useMemo, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { rolesApi } from '../../api/permissions'
import { usersApi, type NhanVien, type UserCreatePayload, type UserUpdatePayload } from '../../api/usersApi'
import { cd2Api } from '../../api/cd2'
import { warehouseApi } from '../../api/warehouse'
import EmptyState from "../../components/EmptyState"
import { phapNhanApi } from '../../api/phap_nhan'
import { useAuthStore } from '../../store/auth'

const DEPARTMENT_MAP: Record<string, string[]> = {
  TRUONG_PHONG_SALE_ADMIN: ['TRUONG_PHONG_SALE_ADMIN', 'SALE_ADMIN'],
  KINH_DOANH_TO_TRUONG:    ['KINH_DOANH_TO_TRUONG',    'KINH_DOANH_NHAN_VIEN'],
  KE_TOAN_TRUONG:          ['KE_TOAN_TRUONG',           'KE_TOAN_CONG_NO', 'KETOAN_NHAN_VIEN'],
  NHAN_SU_TO_TRUONG:       ['NHAN_SU_TO_TRUONG',        'NHAN_SU_NHAN_VIEN'],
  KHO_TO_TRUONG:           ['KHO_TO_TRUONG',            'KHO_NHAN_VIEN'],
  THIET_KE_TO_TRUONG:      ['THIET_KE_TO_TRUONG',       'THIET_KE_NHAN_VIEN'],
  BGD_TO_TRUONG:           ['BGD_TO_TRUONG',            'BGD_NHAN_VIEN'],
  SAN_XUAT_GIAM_SAT:       ['SAN_XUAT_GIAM_SAT',        'SAN_XUAT_TO_TRUONG', 'SAN_XUAT_THO'],
}

const FULL_ACCESS = ['ADMIN', 'GIAM_DOC']

const { Title } = Typography


type UserFormValues = {
  username: string
  ho_ten: string
  email?: string
  so_dien_thoai?: string
  password?: string
  new_password?: string
  role_id: number
  phan_xuong_id?: number
  phap_nhan_id?: number
  trang_thai?: boolean
  machine_id?: number
}

export default function UserList() {
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const currentRole = currentUser?.role ?? ''
  const [form] = Form.useForm<UserFormValues>()
  const [passwordForm] = Form.useForm<{ password: string }>()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterPhanXuong] = useState<string | undefined>(undefined)
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

  const allowedRoles = useMemo(() => {
    if (FULL_ACCESS.includes(currentRole)) return roles
    const team = DEPARTMENT_MAP[currentRole]
    if (!team) return []
    return roles.filter(r => team.includes(r.ma_vai_tro))
  }, [roles, currentRole])

  const { data: machines = [] } = useQuery({
    queryKey: ['machines-all'],
    queryFn: () => cd2Api.listMachines().then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (editing) {
        const payload: UserUpdatePayload = {
          ho_ten: values.ho_ten,
          email: values.email || null,
          so_dien_thoai: values.so_dien_thoai || null,
          role_id: values.role_id,
          phan_xuong_id: values.phan_xuong_id || null,
          phap_nhan_id: values.phap_nhan_id || null,
          trang_thai: values.trang_thai ?? true,
          machine_id: values.machine_id || null,
        }
        await usersApi.update(editing.id, payload)
        if (values.new_password) {
          await usersApi.resetPassword(editing.id, values.new_password)
        }
        return
      }
      const payload: UserCreatePayload = {
        username: values.username,
        ho_ten: values.ho_ten,
        email: values.email || null,
        so_dien_thoai: values.so_dien_thoai || null,
        password: values.password || '',
        role_id: values.role_id,
        phan_xuong_id: values.phan_xuong_id || null,
        phap_nhan_id: values.phap_nhan_id || null,
        machine_id: values.machine_id || null,
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
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Không lưu được tài khoản'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => {
      message.success('Đã vô hiệu hóa tài khoản')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Không vô hiệu hóa được'),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (password: string) => usersApi.resetPassword(resetTarget!.id, password),
    onSuccess: () => {
      message.success('Đã đặt lại mật khẩu')
      setResetTarget(null)
      passwordForm.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Không đặt lại được mật khẩu'),
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
      phan_xuong_id: record.phan_xuong_id || undefined,
      phap_nhan_id: record.phap_nhan_id || undefined,
      trang_thai: record.trang_thai,
      machine_id: record.machine_id || undefined,
    })
    setOpen(true)
  }

  const columns: ColumnsType<NhanVien> = [
    { title: 'Họ tên', dataIndex: 'ho_ten', width: 180 },
    { title: 'Username', dataIndex: 'username', width: 130 },
    {
      title: 'Vai trò',
      dataIndex: 'role_name',
      width: 180,
      render: (_: string | null, r) => <Tag color="geekblue">{r.role_name || r.role_code || '-'}</Tag>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 160,
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
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 140,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 140,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'Máy trực',
      dataIndex: 'machine_id',
      width: 150,
      render: (v: number | null, r) => v ? <Tag color="orange">{r.ten_may || `Máy #${v}`}</Tag> : '-',
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
          {record.trang_thai && record.id !== currentUser?.id && (
            <Popconfirm
              title={`Vô hiệu hóa tài khoản "${record.username}"?`}
              onConfirm={() => deactivateMutation.mutate(record.id)}
              okText="Vô hiệu hóa"
              okButtonProps={{ danger: true }}
              cancelText="Hủy"
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
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
                options={phanXuongList.map(p => ({ value: p.ma_xuong, label: p.ten_xuong }))}
              />
              <Switch checked={showInactive} onChange={setShowInactive} checkedChildren="Tất cả" unCheckedChildren="Đang dùng" />
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ['users'] })} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo tài khoản</Button>
            </Space>
          </Col>
        </Row>

        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: false }}
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
                <Select options={allowedRoles.map(r => ({ value: r.id, label: `${r.ten_vai_tro} (${r.ma_vai_tro})` }))} />
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
              <Form.Item name="phap_nhan_id" label="Pháp nhân">
                <Select
                  allowClear
                  placeholder="-- Chọn pháp nhân --"
                  options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phan_xuong_id" label="Phân xưởng">
                <Select
                  allowClear
                  placeholder="-- Chọn xưởng --"
                  options={phanXuongList.map(p => ({ value: p.id, label: p.ten_xuong }))}
                />
              </Form.Item>
            </Col>
            {editing && (
              <>
                <Col span={12}>
                  <Form.Item name="trang_thai" label="Hoạt động" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="new_password"
                    label="Mật khẩu mới"
                    rules={[{ min: 6, message: 'Ít nhất 6 ký tự' }]}
                    extra="Để trống nếu không đổi"
                  >
                    <Input.Password autoComplete="new-password" placeholder="Để trống = giữ nguyên" />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col span={24}>
               <Form.Item name="machine_id" label="Gán máy trực cố định (Cho công nhân)">
                 <Select 
                   allowClear 
                   placeholder="-- Chọn máy --"
                   options={machines.map(m => ({ value: m.id, label: `${m.ten_may} (${m.loai_may})` }))} 
                 />
               </Form.Item>
            </Col>
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
