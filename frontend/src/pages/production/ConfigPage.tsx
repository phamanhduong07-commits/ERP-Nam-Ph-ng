import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, Empty, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined, SaveOutlined,
} from '@ant-design/icons'
import { cd2Api, MayIn, PrinterUser } from '../../api/cd2'

const { Title, Text } = Typography

// ── Tab 1: Công suất máy in ────────────────────────────────────────────────────

function CapacityTab() {
  const qc = useQueryClient()
  const [editingCapacity, setEditingCapacity] = useState<Record<number, number | null>>({})

  const { data: mayIns = [], isLoading } = useQuery({
    queryKey: ['cd2-may-in'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, capacity }: { id: number; capacity: number | null }) =>
      cd2Api.updateMayIn(id, { capacity }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['cd2-may-in'] })
      setEditingCapacity(prev => { const n = { ...prev }; delete n[vars.id]; return n })
      message.success('Đã lưu công suất')
    },
    onError: () => message.error('Lỗi lưu'),
  })

  const getVal = (m: MayIn) =>
    editingCapacity[m.id] !== undefined ? editingCapacity[m.id] : m.capacity

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        Nhập công suất (tờ/giờ hoặc đơn vị phù hợp) cho từng máy in.
      </Text>
      {isLoading ? (
        <Card loading />
      ) : mayIns.length === 0 ? (
        <Empty description="Chưa có máy in nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        mayIns.map(m => (
          <Card
            key={m.id}
            size="small"
            style={{ marginBottom: 8, borderLeft: `4px solid ${m.active ? '#1677ff' : '#d9d9d9'}` }}
          >
            <Row justify="space-between" align="middle">
              <Col flex="auto">
                <Text strong style={{ fontSize: 14 }}>{m.ten_may}</Text>
                {!m.active && <Tag style={{ marginLeft: 8 }} color="default">Tắt</Tag>}
              </Col>
              <Col>
                <Space>
                  <Text style={{ fontSize: 12, color: '#888' }}>Công suất:</Text>
                  <InputNumber
                    value={getVal(m) ?? undefined}
                    min={0}
                    style={{ width: 120 }}
                    placeholder="Chưa đặt"
                    onChange={v =>
                      setEditingCapacity(prev => ({ ...prev, [m.id]: v }))
                    }
                  />
                  {editingCapacity[m.id] !== undefined && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<SaveOutlined />}
                      loading={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: m.id, capacity: editingCapacity[m.id] ?? null })}
                    >
                      Lưu
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>
        ))
      )}
    </div>
  )
}

// ── Tab 2: Phân quyền máy in ──────────────────────────────────────────────────

function PrinterUserTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PrinterUser | null | 'new'>(null)
  const [form] = Form.useForm()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['cd2-printer-user'],
    queryFn: () => cd2Api.listPrinterUser().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Parameters<typeof cd2Api.createPrinterUser>[0]) => cd2Api.createPrinterUser(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); setEditing(null) },
    onError: () => message.error('Lỗi tạo'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Parameters<typeof cd2Api.updatePrinterUser>[1] }) =>
      cd2Api.updatePrinterUser(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); setEditing(null) },
    onError: () => message.error('Lỗi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deletePrinterUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); message.success('Đã xoá') },
    onError: () => message.error('Lỗi xoá'),
  })

  const openAdd = () => { form.resetFields(); setEditing('new') }
  const openEdit = (u: PrinterUser) => {
    form.setFieldsValue({ token_user: u.token_user, rfid_key: u.rfid_key, shift: u.shift, active: u.active })
    setEditing(u)
  }

  const handleSave = async () => {
    const v = await form.validateFields()
    if (!v.token_password && editing === 'new') { message.warning('Nhập mật khẩu'); return }
    if (editing === 'new') {
      createMut.mutate(v)
    } else if (editing) {
      const payload = { ...v }
      if (!payload.token_password) delete payload.token_password
      updateMut.mutate({ id: (editing as PrinterUser).id, d: payload })
    }
  }

  const shiftOptions = [
    { value: 1, label: 'Ca 1' },
    { value: 2, label: 'Ca 2' },
    { value: 3, label: 'Ca 3' },
  ]

  const columns = [
    { title: 'Token User', dataIndex: 'token_user', key: 'token_user', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'RFID Key', dataIndex: 'rfid_key', key: 'rfid_key',
      render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ca', dataIndex: 'shift', key: 'shift',
      render: (v: number | null) => v ? <Tag color="blue">Ca {v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'active', key: 'active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Tắt'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: PrinterUser) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>Sửa</Button>
          <Popconfirm title="Xoá?" onConfirm={() => deleteMut.mutate(r.id)} okText="Xoá" cancelText="Không">
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tài khoản vận hành máy in ({users.length})</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm tài khoản</Button>
        </Col>
      </Row>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="Chưa có tài khoản nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Thêm tài khoản' : 'Sửa tài khoản'}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        okText={editing === 'new' ? 'Thêm' : 'Lưu'}
        cancelText="Huỷ"
        okButtonProps={{ loading: createMut.isPending || updateMut.isPending }}
        width={400}
      >
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item name="token_user" label="Token User" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="Tên đăng nhập máy in" />
          </Form.Item>
          <Form.Item
            name="token_password"
            label={editing === 'new' ? 'Mật khẩu' : 'Mật khẩu mới (để trống nếu không đổi)'}
          >
            <Input.Password placeholder="Mật khẩu" />
          </Form.Item>
          <Form.Item name="rfid_key" label="RFID Key">
            <Input placeholder="Mã thẻ RFID (nếu có)" />
          </Form.Item>
          <Form.Item name="shift" label="Ca làm việc">
            <Select placeholder="Chọn ca" options={shiftOptions} allowClear />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item name="active" label="Trạng thái" valuePropName="checked">
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Tắt" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const tabItems = [
    {
      key: 'capacity',
      label: 'Công suất máy in',
      children: <CapacityTab />,
    },
    {
      key: 'printer-user',
      label: 'Phân quyền máy in',
      children: <PrinterUserTab />,
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <SettingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Cấu hình CD2</Title>
          </Space>
        </Col>
      </Row>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
