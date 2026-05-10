import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, Empty, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined, SaveOutlined, CloseOutlined, QrcodeOutlined
} from '@ant-design/icons'
import QRCode from 'qrcode'
import { cd2Api, MayIn, MaySauIn, MayScan, PrinterUser, Machine } from '../../api/cd2'
import { warehouseApi, PhanXuong } from '../../api/warehouse'

const { Title, Text } = Typography

// ── Tab: Máy In ───────────────────────────────────────────────────────────────

function MayInTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrder, setEditOrder] = useState<number>(0)
  const [editPhanXuong, setEditPhanXuong] = useState<number | null>(null)

  const { data: mayIns = [], isLoading } = useQuery({
    queryKey: ['cd2-may-in'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
  })
  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-may-in'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayIn({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0, phan_xuong_id: values.phan_xuong_id ?? undefined })
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
      await cd2Api.updateMayIn(id, { ten_may: editName, sort_order: editOrder, phan_xuong_id: editPhanXuong ?? undefined })
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

  const xuongOptions = phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))

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
            style={{ width: 160 }}
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'phan_xuong_id',
      width: 160,
      render: (v: number | null, r: MayIn) =>
        editingId === r.id ? (
          <Select
            value={editPhanXuong ?? undefined}
            onChange={val => setEditPhanXuong(val ?? null)}
            options={xuongOptions}
            size="small"
            style={{ width: 140 }}
            allowClear
            placeholder="Chưa gán"
          />
        ) : (
          v
            ? <Tag color="blue">{phanXuongList.find(x => x.id === v)?.ten_xuong ?? `#${v}`}</Tag>
            : <Text type="secondary">—</Text>
        ),
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
              onClick={() => { setEditingId(r.id); setEditName(r.ten_may); setEditOrder(r.sort_order); setEditPhanXuong(r.phan_xuong_id ?? null) }}
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
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="phan_xuong_id">
          <Select placeholder="Chọn xưởng" size="small" style={{ width: 140 }} options={xuongOptions} allowClear />
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

  const { data: machines = [] } = useQuery({
    queryKey: ['cd2-machines'],
    queryFn: () => cd2Api.listMachines().then(r => r.data),
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
    form.setFieldsValue({ token_user: u.token_user, rfid_key: u.rfid_key, shift: u.shift, active: u.active, machine_id: u.machine_id ?? null })
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
      title: 'Máy được gán', dataIndex: 'machine_name',
      render: (v: string | undefined) => v ? <Tag color="geekblue">{v}</Tag> : <Text type="secondary">—</Text>,
    },
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
          <Form.Item name="machine_id" label="Máy được gán">
            <Select
              placeholder="Chọn máy..."
              allowClear
              options={machines.map(m => ({ value: m.id, label: `${m.ten_may} (${m.loai_may})` }))}
            />
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
  const [editPhanXuong, setEditPhanXuong] = useState<number | null>(null)

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['cd2-may-sau-in'],
    queryFn: () => cd2Api.listMaySauIn().then(r => r.data),
  })
  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-may-sau-in'] })

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMaySauIn({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0, phan_xuong_id: values.phan_xuong_id ?? undefined })
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
      await cd2Api.updateMaySauIn(id, { ten_may: editName, sort_order: editOrder, phan_xuong_id: editPhanXuong ?? undefined })
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

  const xuongOptions = phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))

  const columns = [
    {
      title: 'Tên máy', dataIndex: 'ten_may',
      render: (v: string, r: MaySauIn) =>
        editingId === r.id ? (
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            size="small" autoFocus style={{ width: 160 }}
            onPressEnter={() => handleSaveEdit(r.id)}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'phan_xuong_id',
      width: 160,
      render: (v: number | null, r: MaySauIn) =>
        editingId === r.id ? (
          <Select
            value={editPhanXuong ?? undefined}
            onChange={val => setEditPhanXuong(val ?? null)}
            options={xuongOptions}
            size="small"
            style={{ width: 140 }}
            allowClear
            placeholder="Chưa gán"
          />
        ) : (
          v
            ? <Tag color="blue">{phanXuongList.find(x => x.id === v)?.ten_xuong ?? `#${v}`}</Tag>
            : <Text type="secondary">—</Text>
        ),
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
              onClick={() => { setEditingId(r.id); setEditName(r.ten_may); setEditOrder(r.sort_order); setEditPhanXuong(r.phan_xuong_id ?? null) }} />
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
          <Input placeholder="Tên máy mới..." size="small" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="phan_xuong_id">
          <Select placeholder="Chọn xưởng" size="small" style={{ width: 140 }} options={xuongOptions} allowClear />
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

// ── Tab: Máy Scan ─────────────────────────────────────────────────────────────

interface ScanEditState { ten_may: string; don_gia: number | null; phan_xuong_id: number | null }

function MayScanTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editState, setEditState] = useState<ScanEditState>({ ten_may: '', don_gia: null, phan_xuong_id: null })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['cd2-may-scan'],
    queryFn: () => cd2Api.listMayScan().then(r => r.data),
  })
  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cd2-may-scan'] })
    qc.invalidateQueries({ queryKey: ['may-scan'] })
  }

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      await cd2Api.createMayScan({ ten_may: values.ten_may, sort_order: values.sort_order ?? 0, don_gia: values.don_gia ?? undefined, phan_xuong_id: values.phan_xuong_id ?? undefined })
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
      await cd2Api.updateMayScan(id, { ten_may: editState.ten_may, don_gia: editState.don_gia ?? undefined, phan_xuong_id: editState.phan_xuong_id ?? undefined })
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

  const xuongOptions = phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))

  const columns = [
    {
      title: 'Tên máy', dataIndex: 'ten_may',
      render: (v: string, r: MayScan) =>
        editingId === r.id ? (
          <Input
            value={editState.ten_may}
            onChange={e => setEditState(s => ({ ...s, ten_may: e.target.value }))}
            size="small" autoFocus style={{ width: 140 }}
          />
        ) : <Text strong>{v}</Text>,
    },
    {
      title: 'Xưởng',
      dataIndex: 'phan_xuong_id',
      width: 160,
      render: (v: number | null, r: MayScan) =>
        editingId === r.id ? (
          <Select
            value={editState.phan_xuong_id ?? undefined}
            onChange={val => setEditState(s => ({ ...s, phan_xuong_id: val ?? null }))}
            options={xuongOptions}
            size="small"
            style={{ width: 140 }}
            allowClear
            placeholder="Chưa gán"
          />
        ) : (
          v
            ? <Tag color="blue">{phanXuongList.find(x => x.id === v)?.ten_xuong ?? `#${v}`}</Tag>
            : <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Đơn giá (đ/m²)', dataIndex: 'don_gia', width: 140,
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
              onClick={() => { setEditingId(r.id); setEditState({ ten_may: r.ten_may, don_gia: r.don_gia, phan_xuong_id: r.phan_xuong_id ?? null }) }} />
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
          <Input placeholder="Tên máy scan..." size="small" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="phan_xuong_id">
          <Select placeholder="Chọn xưởng" size="small" style={{ width: 140 }} options={xuongOptions} allowClear />
        </Form.Item>
        <Form.Item name="don_gia">
          <InputNumber placeholder="Đơn giá đ/m²" size="small" style={{ width: 120 }} min={0} />
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

// ── Tab: Máy móc chung (Mobile Tracking) ──────────────────────────────────────

function MachineTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editState, setEditState] = useState<Partial<Machine>>({})
  const [qrModal, setQrModal] = useState<{ open: boolean; machine: Machine | null }>({ open: false, machine: null })
  const [qrDataUrl, setQrDataUrl] = useState('')

  const showQr = async (m: Machine) => {
    const url = `${window.location.origin}/production/cd2/mobile-tracking?machine_id=${m.id}`
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 })
    setQrDataUrl(dataUrl)
    setQrModal({ open: true, machine: m })
  }

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['cd2-machines-config'],
    queryFn: () => cd2Api.listMachines().then(r => r.data),
  })
  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cd2-machines-config'] })

  const handleAdd = async () => {
    try {
      const v = await form.validateFields()
      await cd2Api.createMachine(v)
      message.success('Đã thêm máy')
      form.resetFields()
      invalidate()
    } catch { message.error('Lỗi') }
  }

  const handleSaveEdit = async (id: number) => {
    try {
      await cd2Api.updateMachine(id, editState)
      message.success('Đã cập nhật')
      setEditingId(null)
      invalidate()
    } catch { message.error('Lỗi cập nhật máy') }
  }

  const columns = [
    { title: 'Tên máy', dataIndex: 'ten_may', render: (v: string, r: Machine) => 
        editingId === r.id ? <Input value={editState.ten_may} onChange={e => setEditState(s => ({...s, ten_may: e.target.value}))} size="small" /> : <Text strong>{v}</Text> 
    },
    { title: 'Mã máy', dataIndex: 'ma_may', render: (v: string, r: Machine) => 
        editingId === r.id ? <Input value={editState.ma_may ?? ''} onChange={e => setEditState(s => ({...s, ma_may: e.target.value}))} size="small" /> : <Tag>{v || '—'}</Tag>
    },
    { title: 'Loại', dataIndex: 'loai_may', render: (v: string, r: Machine) => 
        editingId === r.id ? (
          <Select size="small" value={v} onChange={val => setEditState(s => ({...s, loai_may: val}))} style={{width: 100}}>
            <Select.Option value="in">In</Select.Option>
            <Select.Option value="be">Bế</Select.Option>
            <Select.Option value="dan">Dán</Select.Option>
            <Select.Option value="ghim">Ghim</Select.Option>
            <Select.Option value="can_mang">Cán màng</Select.Option>
            <Select.Option value="khac">Khác</Select.Option>
          </Select>
        ) : <Tag color="blue">{v.toUpperCase()}</Tag>
    },
    { title: 'Trạng thái', dataIndex: 'active', render: (v: boolean) => <Switch size="small" checked={v} disabled /> },
    { title: '', width: 140, render: (_: any, r: Machine) => (
      <Space>
        {editingId === r.id ? <Button size="small" icon={<SaveOutlined />} onClick={() => handleSaveEdit(r.id)} /> : 
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingId(r.id); setEditState(r) }} />}
        <Button size="small" icon={<QrcodeOutlined />} onClick={() => showQr(r)} />
      </Space>
    )}
  ]

  return (
    <div>
      <Table dataSource={list} columns={columns} rowKey="id" size="small" pagination={false} loading={isLoading} style={{marginBottom: 16}} />
      <Form form={form} layout="inline">
        <Form.Item name="ten_may" rules={[{required: true}]}><Input placeholder="Tên máy" size="small" /></Form.Item>
        <Form.Item name="loai_may" initialValue="khac">
          <Select size="small" style={{width: 120}}>
            <Select.Option value="in">In</Select.Option>
            <Select.Option value="be">Bế</Select.Option>
            <Select.Option value="dan">Dán</Select.Option>
            <Select.Option value="ghim">Ghim</Select.Option>
            <Select.Option value="can_mang">Cán màng</Select.Option>
            <Select.Option value="khac">Khác</Select.Option>
          </Select>
        </Form.Item>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>Thêm máy</Button>
      </Form>

      <Modal
        title="Mã QR cho máy"
        open={qrModal.open}
        onCancel={() => setQrModal({ open: false, machine: null })}
        footer={[
          <Button key="close" onClick={() => setQrModal({ open: false, machine: null })}>Đóng</Button>,
          <Button key="print" type="primary" onClick={() => window.print()}>In mã</Button>
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Title level={4}>{qrModal.machine?.ten_may}</Title>
          <img src={qrDataUrl} alt="QR Code" style={{ border: '1px solid #eee', borderRadius: 8 }} />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Dán mã này lên máy để công nhân quét báo cáo.</Text>
          </div>
        </div>
      </Modal>
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
    { key: 'machines',     label: 'Máy móc (Mobile)', children: <MachineTab /> },
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
