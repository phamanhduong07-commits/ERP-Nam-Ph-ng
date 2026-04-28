import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  ClockCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, ShiftCa, ShiftConfigItem } from '../../api/cd2'

const { Title, Text } = Typography

// ── Tab 1: Ca làm việc ────────────────────────────────────────────────────────

function ShiftCaTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ShiftCa | null | 'new'>(null)
  const [form] = Form.useForm()

  const { data: cas = [], isLoading } = useQuery({
    queryKey: ['cd2-shift-ca'],
    queryFn: () => cd2Api.listShiftCa().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: { name: string; leader?: string }) => cd2Api.createShiftCa(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-shift-ca'] }); setEditing(null) },
    onError: () => message.error('Lỗi tạo ca'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<ShiftCa> }) => cd2Api.updateShiftCa(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-shift-ca'] }); setEditing(null) },
    onError: () => message.error('Lỗi cập nhật ca'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deleteShiftCa(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-shift-ca'] }); message.success('Đã xoá') },
    onError: () => message.error('Lỗi xoá ca'),
  })

  const openAdd = () => { form.resetFields(); setEditing('new') }
  const openEdit = (c: ShiftCa) => { form.setFieldsValue({ name: c.name, leader: c.leader }); setEditing(c) }

  const handleSave = async () => {
    const v = await form.validateFields()
    if (editing === 'new') {
      createMut.mutate(v)
    } else if (editing) {
      updateMut.mutate({ id: (editing as ShiftCa).id, d: v })
    }
  }

  const columns = [
    { title: 'Tên ca', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Trưởng ca', dataIndex: 'leader', key: 'leader',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'active', key: 'active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Tắt'}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: ShiftCa) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>Sửa</Button>
          <Popconfirm title="Xoá ca này?" onConfirm={() => deleteMut.mutate(r.id)} okText="Xoá" cancelText="Không">
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col><Text type="secondary">Danh sách ca làm việc ({cas.length})</Text></Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm ca</Button>
        </Col>
      </Row>

      <Table
        dataSource={cas}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="Chưa có ca nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Thêm ca mới' : 'Sửa ca'}
        onCancel={() => setEditing(null)}
        onOk={handleSave}
        okText={editing === 'new' ? 'Thêm' : 'Lưu'}
        cancelText="Huỷ"
        okButtonProps={{ loading: createMut.isPending || updateMut.isPending }}
        width={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Tên ca" rules={[{ required: true, message: 'Nhập tên ca' }]}>
            <Input placeholder="VD: Ca 1, Ca sáng..." />
          </Form.Item>
          <Form.Item name="leader" label="Trưởng ca">
            <Input placeholder="Họ tên trưởng ca" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Tab 2: Lịch ca ────────────────────────────────────────────────────────────

function ShiftConfigTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [filterMayIn, setFilterMayIn] = useState<number | null>(null)

  const { data: cas = [] } = useQuery({
    queryKey: ['cd2-shift-ca'],
    queryFn: () => cd2Api.listShiftCa().then(r => r.data),
  })
  const { data: mayIns = [] } = useQuery({
    queryKey: ['cd2-may-in'],
    queryFn: () => cd2Api.listMayIn().then(r => r.data),
  })
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['cd2-shift-config', filterMayIn],
    queryFn: () => cd2Api.listShiftConfig({ may_in_id: filterMayIn ?? undefined, days: 60 }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Parameters<typeof cd2Api.createShiftConfig>[0]) => cd2Api.createShiftConfig(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cd2-shift-config'] })
      form.resetFields(['ngay', 'gio_lam', 'gio_bat_dau', 'gio_ket_thuc', 'nghi_1', 'nghi_2'])
      message.success('Đã thêm lịch ca')
    },
    onError: () => message.error('Lỗi thêm lịch ca'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => cd2Api.deleteShiftConfig(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cd2-shift-config'] }); message.success('Đã xoá') },
    onError: () => message.error('Lỗi xoá'),
  })

  const handleAdd = async () => {
    const v = await form.validateFields()
    createMut.mutate({
      may_in_id: v.may_in_id,
      shift_ca_id: v.shift_ca_id,
      ngay: v.ngay.format('YYYY-MM-DD'),
      gio_lam: v.gio_lam,
      gio_bat_dau: v.gio_bat_dau,
      gio_ket_thuc: v.gio_ket_thuc,
      nghi_1: v.nghi_1,
      nghi_2: v.nghi_2,
    })
  }

  const columns = [
    {
      title: 'Ngày', dataIndex: 'ngay', key: 'ngay', width: 100,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Máy in', dataIndex: 'ten_may', key: 'ten_may' },
    {
      title: 'Ca', dataIndex: 'ten_ca', key: 'ten_ca',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Giờ làm', dataIndex: 'gio_lam', key: 'gio_lam', width: 80,
      render: (v: number | null) => v != null ? `${v}h` : '—',
    },
    {
      title: 'Ca làm', key: 'time',
      render: (_: unknown, r: ShiftConfigItem) =>
        r.gio_bat_dau && r.gio_ket_thuc ? `${r.gio_bat_dau} – ${r.gio_ket_thuc}` : '—',
    },
    {
      title: 'Nghỉ (phút)', key: 'nghi',
      render: (_: unknown, r: ShiftConfigItem) => {
        const t = (r.nghi_1 ?? 0) + (r.nghi_2 ?? 0)
        return t > 0 ? `${t} phút` : '—'
      },
    },
    {
      title: '',
      key: 'del',
      width: 60,
      render: (_: unknown, r: ShiftConfigItem) => (
        <Popconfirm title="Xoá?" onConfirm={() => deleteMut.mutate(r.id)} okText="Xoá" cancelText="Không">
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      {/* Add form */}
      <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
        <Form form={form} layout="inline" initialValues={{ ngay: dayjs() }}>
          <Form.Item name="may_in_id" rules={[{ required: true, message: 'Chọn máy' }]}>
            <Select
              placeholder="Chọn máy in"
              style={{ width: 140 }}
              options={mayIns.map(m => ({ value: m.id, label: m.ten_may }))}
            />
          </Form.Item>
          <Form.Item name="shift_ca_id" rules={[{ required: true, message: 'Chọn ca' }]}>
            <Select
              placeholder="Chọn ca"
              style={{ width: 120 }}
              options={cas.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="ngay" rules={[{ required: true, message: 'Chọn ngày' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: 130 }} />
          </Form.Item>
          <Form.Item name="gio_lam">
            <InputNumber placeholder="Giờ làm" style={{ width: 90 }} min={0} max={24} step={0.5} addonAfter="h" />
          </Form.Item>
          <Form.Item name="gio_bat_dau">
            <Input placeholder="BD (07:00)" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="gio_ket_thuc">
            <Input placeholder="KT (15:30)" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="nghi_1">
            <InputNumber placeholder="Nghỉ 1" style={{ width: 80 }} min={0} addonAfter="ph" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} loading={createMut.isPending}>
              Thêm
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Filter */}
      <Row style={{ marginBottom: 10 }}>
        <Col>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>Lọc máy:</Text>
            <Select
              allowClear
              placeholder="Tất cả máy"
              style={{ width: 150 }}
              value={filterMayIn}
              onChange={setFilterMayIn}
              options={mayIns.map(m => ({ value: m.id, label: m.ten_may }))}
            />
          </Space>
        </Col>
      </Row>

      <Table
        dataSource={configs}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Chưa có lịch ca nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShiftPage() {
  const tabItems = [
    {
      key: 'ca',
      label: 'Ca làm việc',
      children: <ShiftCaTab />,
    },
    {
      key: 'lich',
      label: 'Lịch ca',
      children: <ShiftConfigTab />,
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Quản lý ca</Title>
          </Space>
        </Col>
      </Row>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
