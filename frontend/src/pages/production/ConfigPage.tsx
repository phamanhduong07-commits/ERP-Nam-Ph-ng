import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, Empty, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons'
import { cd2Api, MayIn, MaySauIn, MayScan, PrinterUser } from '../../api/cd2'

const { Title, Text } = Typography

// ── Tab: Máy In ───────────────────────────────────────────────────────────────

function MayInTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState<number>(0)

  const { data: mayIns = [], isLoading } = useQuery({
    queryKey: ['cd2-may-in'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-may-in'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayIn({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0 })
      message.success('Đã thêm máy in')
      form.resetFields()
      invalidate()
    } catch {
      message.error('Lỗi thêm máy in')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return
    try {
      await cd2Api.updateMayIn(id, { ten_may: editName, sort_order: editOrder })
      message.success('Đã cập nhật')
      setEditingId(null)
      invalidate()
    } catch {
      message.error('Lỗi cập nhật')
    }
  }

  const handleToggleActive = async (m: MayIn) => {
    try {
      await cd2Api.updateMayIn(m.id, { active: !m.active })
      invalidate()
    } catch {
      message.error('Lỗi')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await cd2Api.deleteMayIn(id)
      message.success('Đã xoá')
      invalidate()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const columns = [
    {
      title: 'Tên máy',
      dataIndex: 'ten_may',
      render: (v: string, r: MayIn) =>
        editingId === r.id ? (
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            size="small"
            autoFocus
            style={{ width: 180 }}
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Thứ tự',
      dataIndex: 'sort_order',
      width: 90,
      align: 'center' as const,
      render: (v: number, r: MayIn) =>
        editingId === r.id ? (
          <InputNumber
            value={editOrder}
            onChange={val => setEditOrder(val ?? 0)}
            size="small"
            style={{ width: 60 }}
            min={0}
          />
        ) : v,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'active',
      width: 110,
      render: (v: boolean, r: MayIn) => (
        <Switch
          size="small"
          checked={v}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          onChange={() => handleToggleActive(r)}
        />
      ),
    },
    {
      title: '',
      width: 110,
      render: (_: unknown, r: MayIn) =>
        editingId === r.id ? (
          <Space size={4}>
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleSaveEdit(r.id)} />
            <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingId(null)} />
          </Space>
        ) : (
          <Space size={4}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => { setEditingId(r.id); setEditName(r.ten_may); setEditOrder(r.sort_order) }}
            />
            <Popconfirm title="Xoá máy in này?" onConfirm={() => handleDelete(r.id)} okText="Xoá" cancelText="Không">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <div>
      <Table
        rowKey="id"
        size="small"
        dataSource={mayIns}
        columns={columns}
        loading={isLoading}
        pagination={false}
        style={{ marginBottom: 16 }}
        locale={{ emptyText: <Empty description="Chưa có máy in" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên máy' }]}>
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" size="small" style={{ width: 80 }} min={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>Thêm</Button>
        </Form.Item>
      </Form>
    </div>
  )
}

// ── Tab: Công suất máy ────────────────────────────────────────────────────────

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
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
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
            styles={{ body: { padding: '10px 16px' } }}
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
                    onChange={v => setEditingCapacity(prev => ({ ...prev, [m.id]: v }))}
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

// ── Tab: Xác thực máy in (PrinterUser) ────────────────────────────────────────

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); setEditing(null); message.success('Đã thêm') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Parameters<typeof cd2Api.updatePrinterUser>[1] }) =>
      cd2Api.updatePrinterUser(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); setEditing(null); message.success('Đã cập nhật') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deletePrinterUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-printer-user'] }); message.success('Đã xoá') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

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

  const columns = [
    { title: 'Token User', dataIndex: 'token_user', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'RFID Key', dataIndex: 'rfid_key',
      render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ca', dataIndex: 'shift', width: 80,
      render: (v: number | null) => v ? <Tag color="blue">Ca {v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'active', width: 110,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Tắt'}</Tag>,
    },
    {
      title: '', key: 'actions', width: 100,
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
        <Col><Text type="secondary">Tài khoản vận hành máy in ({users.length})</Text></Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing('new') }}>
            Thêm tài khoản
          </Button>
        </Col>
      </Row>
      <Table
        dataSource={users} columns={columns} rowKey="id" loading={isLoading}
        pagination={false} size="small"
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
          <Form.Item name="token_password" label={editing === 'new' ? 'Mật khẩu' : 'Mật khẩu mới (để trống nếu không đổi)'}>
            <Input.Password placeholder="Mật khẩu" />
          </Form.Item>
          <Form.Item name="rfid_key" label="RFID Key">
            <Input placeholder="Mã thẻ RFID (nếu có)" />
          </Form.Item>
          <Form.Item name="shift" label="Ca làm việc">
            <Select placeholder="Chọn ca" options={[
              { value: 1, label: 'Ca 1' }, { value: 2, label: 'Ca 2' }, { value: 3, label: 'Ca 3' },
            ]} allowClear />
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

// ── Tab: Máy Sau In ───────────────────────────────────────────────────────────

function MaySauInTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState<number>(0)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['cd2-may-sau-in'],
    queryFn: () => cd2Api.listMaySauIn().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-may-sau-in'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMaySauIn({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0 })
      message.success('Đã thêm máy sau in')
      form.resetFields()
      invalidate()
    } catch {
      message.error('Lỗi thêm')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return
    try {
      await cd2Api.updateMaySauIn(id, { ten_may: editName, sort_order: editOrder })
      message.success('Đã cập nhật')
      setEditingId(null)
      invalidate()
    } catch {
      message.error('Lỗi cập nhật')
    }
  }

  const handleToggleActive = async (m: MaySauIn) => {
    try {
      await cd2Api.updateMaySauIn(m.id, { active: !m.active })
      invalidate()
    } catch {
      message.error('Lỗi')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await cd2Api.deleteMaySauIn(id)
      message.success('Đã xoá')
      invalidate()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const columns = [
    {
      title: 'Tên máy', dataIndex: 'ten_may',
      render: (v: string, r: MaySauIn) =>
        editingId === r.id ? (
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            size="small" autoFocus style={{ width: 180 }}
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Thứ tự', dataIndex: 'sort_order', width: 90, align: 'center' as const,
      render: (v: number, r: MaySauIn) =>
        editingId === r.id ? (
          <InputNumber value={editOrder} onChange={val => setEditOrder(val ?? 0)} size="small" style={{ width: 60 }} min={0} />
        ) : v,
    },
    {
      title: 'Trạng thái', dataIndex: 'active', width: 110,
      render: (v: boolean, r: MaySauIn) => (
        <Switch size="small" checked={v} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={() => handleToggleActive(r)} />
      ),
    },
    {
      title: '', width: 110,
      render: (_: unknown, r: MaySauIn) =>
        editingId === r.id ? (
          <Space size={4}>
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleSaveEdit(r.id)} />
            <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingId(null)} />
          </Space>
        ) : (
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />}
              onClick={() => { setEditingId(r.id); setEditName(r.ten_may); setEditOrder(r.sort_order) }} />
            <Popconfirm title="Xoá máy sau in này?" onConfirm={() => handleDelete(r.id)} okText="Xoá" cancelText="Không">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <div>
      <Table
        rowKey="id" size="small" dataSource={list} columns={columns} loading={isLoading}
        pagination={false} style={{ marginBottom: 16 }}
        locale={{ emptyText: <Empty description="Chưa có máy sau in" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên máy' }]}>
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" size="small" style={{ width: 80 }} min={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>Thêm</Button>
        </Form.Item>
      </Form>
    </div>
  )
}

// ── Tab: Máy Scan ─────────────────────────────────────────────────────────────

interface ScanEditState { ten_may: string; don_gia: number | null }

function MayScanTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editState, setEditState] = useState<ScanEditState>({ ten_may: '', don_gia: null })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['cd2-may-scan'],
    queryFn: () => cd2Api.listMayScan().then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-may-scan'] })
    qc.invalidateQueries({ queryKey: ['may-scan'] })
  }

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayScan({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0, don_gia: values.don_gia ?? undefined })
      message.success('Đã thêm máy scan')
      form.resetFields()
      invalidate()
    } catch {
      message.error('Lỗi thêm')
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!editState.ten_may.trim()) return
    try {
      await cd2Api.updateMayScan(id, { ten_may: editState.ten_may, don_gia: editState.don_gia ?? undefined })
      message.success('Đã cập nhật')
      setEditingId(null)
      invalidate()
    } catch {
      message.error('Lỗi cập nhật')
    }
  }

  const handleToggleActive = async (m: MayScan) => {
    try {
      await cd2Api.updateMayScan(m.id, { active: !m.active })
      invalidate()
    } catch {
      message.error('Lỗi')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await cd2Api.deleteMayScan(id)
      message.success('Đã xoá')
      invalidate()
    } catch {
      message.error('Lỗi xoá')
    }
  }

  const columns = [
    {
      title: 'Tên máy', dataIndex: 'ten_may',
      render: (v: string, r: MayScan) =>
        editingId === r.id ? (
          <Input
            value={editState.ten_may}
            onChange={e => setEditState(s => ({ ...s, ten_may: e.target.value }))}
            size="small" autoFocus style={{ width: 160 }}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Đơn giá (đ/m²)', dataIndex: 'don_gia', width: 150,
      render: (v: number | null, r: MayScan) =>
        editingId === r.id ? (
          <InputNumber
            value={editState.don_gia}
            onChange={val => setEditState(s => ({ ...s, don_gia: val }))}
            size="small" style={{ width: 110 }} min={0}
          />
        ) : (v != null ? Number(v).toLocaleString('vi-VN') + 'đ' : '—'),
    },
    {
      title: 'Trạng thái', dataIndex: 'active', width: 110,
      render: (v: boolean, r: MayScan) => (
        <Switch size="small" checked={v} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={() => handleToggleActive(r)} />
      ),
    },
    {
      title: '', width: 110,
      render: (_: unknown, r: MayScan) =>
        editingId === r.id ? (
          <Space size={4}>
            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleSaveEdit(r.id)} />
            <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingId(null)} />
          </Space>
        ) : (
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />}
              onClick={() => { setEditingId(r.id); setEditState({ ten_may: r.ten_may, don_gia: r.don_gia }) }} />
            <Popconfirm title="Xoá máy scan này?" onConfirm={() => handleDelete(r.id)} okText="Xoá" cancelText="Không">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
    },
  ]

  return (
    <div>
      <Table
        rowKey="id" size="small" dataSource={list} columns={columns} loading={isLoading}
        pagination={false} style={{ marginBottom: 16 }}
        locale={{ emptyText: <Empty description="Chưa có máy scan" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{ required: true, message: 'Nhập tên máy' }]}>
          <Input placeholder="Tên máy scan..." size="small" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="don_gia">
          <InputNumber placeholder="Đơn giá đ/m²" size="small" style={{ width: 130 }} min={0} />
        </Form.Item>
        <Form.Item name="sort_order">
          <InputNumber placeholder="Thứ tự" size="small" style={{ width: 70 }} min={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>Thêm</Button>
        </Form.Item>
      </Form>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigPage() {
  const tabItems = [
    { key: 'may-in',       label: 'Máy In',          children: <MayInTab /> },
    { key: 'capacity',     label: 'Công suất máy',   children: <CapacityTab /> },
    { key: 'printer-user', label: 'Tài khoản người dùng', children: <PrinterUserTab /> },
    { key: 'may-sau-in',   label: 'Máy Sau In',      children: <MaySauInTab /> },
    { key: 'may-scan',     label: 'Máy Scan',         children: <MayScanTab /> },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <SettingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Cấu Hình Hệ Thống</Title>
          </Space>
        </Col>
      </Row>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
