import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Select, Space, Typography, Tag, Popconfirm, App, Row, Col, Divider,
  Input, Form, Modal,
} from 'antd'
import { PlusOutlined, DeleteOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons'
import client from '../../api/client'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

interface NvItem { id: number; ho_ten: string; username: string; role_code: string }
interface UserPerm {
  id: number
  ma_quyen: string
  ten_quyen: string
  target_user_id: number | null
  target_user_name: string | null
  granted_by_name: string | null
  created_at: string
}

const GRANTABLE_PERMISSIONS = [
  { value: 'report.xnt_all_nv',     label: 'Xem tồn phôi/TP của NV' },
  { value: 'report.cong_no_all_nv', label: 'Xem công nợ của NV' },
]

export default function TeamPermissionsPage() {
  const qc = useQueryClient()
  const { message } = App.useApp()
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [grantPerm, setGrantPerm] = useState<string | undefined>()
  const [grantTargetId, setGrantTargetId] = useState<number | undefined>()
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pwForm] = Form.useForm()

  const { data: nvList = [] } = useQuery<NvItem[]>({
    queryKey: ['team-users'],
    queryFn: () => client.get<NvItem[]>('/users').then(r =>
      r.data.filter(u => ['SALE_ADMIN', 'TRUONG_PHONG_SALE_ADMIN'].includes(u.role_code))
    ),
  })

  // Danh sách tất cả NV để chọn target
  const { data: allNvList = [] } = useQuery<NvItem[]>({
    queryKey: ['all-users'],
    queryFn: () => client.get<NvItem[]>('/users').then(r => r.data),
  })

  const { data: userPerms = [], isLoading } = useQuery<UserPerm[]>({
    queryKey: ['user-perms', selectedUserId],
    queryFn: () =>
      client.get<UserPerm[]>(`/roles/users/${selectedUserId}/permissions`).then(r => r.data),
    enabled: !!selectedUserId,
  })

  const grantMut = useMutation({
    mutationFn: () =>
      client.post(`/roles/users/${selectedUserId}/permissions`, {
        permission_ma_quyen: grantPerm,
        target_user_id: grantTargetId,
      }),
    onSuccess: () => {
      message.success('Đã cấp quyền thành công')
      setGrantPerm(undefined)
      setGrantTargetId(undefined)
      qc.invalidateQueries({ queryKey: ['user-perms', selectedUserId] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Lỗi khi cấp quyền'),
  })

  const revokeMut = useMutation({
    mutationFn: (upId: number) =>
      client.delete(`/roles/users/${selectedUserId}/permissions/by-id/${upId}`),
    onSuccess: () => {
      message.success('Đã thu hồi quyền')
      qc.invalidateQueries({ queryKey: ['user-perms', selectedUserId] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Lỗi khi thu hồi quyền'),
  })

  const resetPwMut = useMutation({
    mutationFn: (pw: string) =>
      client.post(`/users/${selectedUserId}/reset-password`, { password: pw }),
    onSuccess: () => {
      message.success('Đã đặt lại mật khẩu thành công')
      setPwModalOpen(false)
      pwForm.resetFields()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Lỗi khi đặt lại mật khẩu'),
  })

  const selectedUser = nvList.find(u => u.id === selectedUserId)

  // Kiểm tra cặp (perm, target) đã tồn tại chưa để disable nút Cấp
  const alreadyGranted = grantPerm && grantTargetId
    ? userPerms.some(up => up.ma_quyen === grantPerm && up.target_user_id === grantTargetId)
    : false

  const cols = [
    {
      title: 'Quyền',
      dataIndex: 'ma_quyen',
      render: (v: string, r: UserPerm) => (
        <Space direction="vertical" size={0}>
          <Text>{GRANTABLE_PERMISSIONS.find(p => p.value === v)?.label ?? v}</Text>
          <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag>
        </Space>
      ),
    },
    {
      title: 'NV được phép xem',
      dataIndex: 'target_user_name',
      render: (v: string | null) =>
        v ? <Tag color="green">{v}</Tag> : <Tag color="orange">Tất cả</Tag>,
    },
    {
      title: 'Cấp bởi',
      dataIndex: 'granted_by_name',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Thao tác',
      width: 100,
      render: (_: unknown, r: UserPerm) => (
        <Popconfirm
          title="Thu hồi quyền này?"
          onConfirm={() => revokeMut.mutate(r.id)}
          okText="Thu hồi" cancelText="Huỷ"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" icon={<DeleteOutlined />}>Thu hồi</Button>
        </Popconfirm>
      ),
    },
  ]

  const { displayColumns: displayCols, settingsButton } = useColumnPrefs('hr-team-permissions', cols)

  return (
    <Card>
      <Title level={4} style={{ margin: '0 0 4px' }}>Quản lý quyền cá nhân trong team</Title>
      <Text type="secondary">Cấp thêm quyền ngoài role cho từng nhân viên (không thay đổi role mặc định)</Text>

      <Divider />

      <Row gutter={24}>
        {/* Cột trái: danh sách NV */}
        <Col xs={24} md={8}>
          <Text strong>Chọn nhân viên</Text>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {nvList.map(u => (
              <div
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedUserId === u.id ? '#e6f4ff' : '#fafafa',
                  border: `1px solid ${selectedUserId === u.id ? '#1677ff' : '#f0f0f0'}`,
                  transition: 'all 0.15s',
                }}
              >
                <Space>
                  <UserOutlined style={{ color: selectedUserId === u.id ? '#1677ff' : '#999' }} />
                  <div>
                    <div style={{ fontWeight: 500, color: selectedUserId === u.id ? '#1677ff' : 'inherit' }}>
                      {u.ho_ten}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>{u.role_code} · {u.username}</div>
                  </div>
                </Space>
              </div>
            ))}
          </div>
        </Col>

        {/* Cột phải: quyền của NV được chọn */}
        <Col xs={24} md={16}>
          {selectedUser ? (
            <>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Text strong>Quyền bổ sung của: </Text>
                  <Text style={{ color: '#1677ff' }}>{selectedUser.ho_ten}</Text>
                  <Tag>{selectedUser.role_code || '—'}</Tag>
                </Space>
                <Space>
                  {settingsButton}
                  <Button
                    icon={<KeyOutlined />}
                    onClick={() => { pwForm.resetFields(); setPwModalOpen(true) }}
                  >
                    Đặt lại mật khẩu
                  </Button>
                </Space>
              </div>

              {/* Cấp quyền — chọn loại quyền + NV cụ thể */}
              <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                <Select
                  placeholder="Chọn loại quyền"
                  style={{ width: 220 }}
                  value={grantPerm}
                  onChange={v => { setGrantPerm(v); setGrantTargetId(undefined) }}
                  options={GRANTABLE_PERMISSIONS}
                />
                <Select
                  placeholder="Chọn NV được phép xem"
                  style={{ width: 220 }}
                  value={grantTargetId}
                  onChange={setGrantTargetId}
                  disabled={!grantPerm}
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={allNvList
                    .filter(u => u.id !== selectedUserId)
                    .map(u => ({ value: u.id, label: u.ho_ten }))}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!grantPerm || !grantTargetId || alreadyGranted}
                  loading={grantMut.isPending}
                  onClick={() => grantMut.mutate()}
                >
                  Cấp quyền
                </Button>
              </Space>
              {alreadyGranted && (
                <div style={{ marginBottom: 8, color: '#faad14', fontSize: 12 }}>
                  Đã có quyền này cho NV đã chọn
                </div>
              )}

              <Table
                dataSource={userPerms}
                columns={displayCols}
                rowKey="id"
                size="small"
                loading={isLoading}
                locale={{ emptyText: 'Chưa có quyền bổ sung nào' }}
                pagination={false}
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
              Chọn nhân viên bên trái để quản lý quyền
            </div>
          )}
        </Col>
      </Row>

      <Modal
        title={`Đặt lại mật khẩu — ${selectedUser?.ho_ten ?? ''}`}
        open={pwModalOpen}
        onCancel={() => setPwModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={pwForm}
          layout="vertical"
          onFinish={(values: { password: string }) => resetPwMut.mutate(values.password)}
        >
          <Form.Item
            label="Mật khẩu mới"
            name="password"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 6, message: 'Tối thiểu 6 ký tự' },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 6 ký tự" autoFocus />
          </Form.Item>
          <Form.Item
            label="Xác nhận mật khẩu"
            name="confirm"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject('Mật khẩu không khớp')
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPwModalOpen(false)}>Huỷ</Button>
              <Button type="primary" htmlType="submit" loading={resetPwMut.isPending}>
                Đặt lại
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
