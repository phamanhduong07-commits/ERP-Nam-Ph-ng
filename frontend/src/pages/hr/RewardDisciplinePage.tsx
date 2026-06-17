import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Table, Tag, Button, Card, Space, Typography, Row, Col, Modal, Form, Input, InputNumber, Select, message, DatePicker
} from 'antd'
import {
  TrophyOutlined,
  WarningOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const { Option } = Select

// Trạng thái khen thưởng / kỷ luật
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  moi: { text: 'Mới', color: 'orange' },
  da_duyet: { text: 'Đã duyệt', color: 'green' },
  da_chi: { text: 'Đã chi/Đã trừ', color: 'blue' },
  tu_choi: { text: 'Từ chối', color: 'red' },
  huy: { text: 'Đã hủy', color: 'default' },
}

export default function RewardDisciplinePage() {
  const [modalVisible, setModalVisible] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [form] = Form.useForm()

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-simple'],
    queryFn: () => client.get(`/hr/employees`).then(r => r.data),
  })

  const { data: rewards = [], isLoading, refetch } = useQuery({
    queryKey: ['hr-rewards'],
    queryFn: () => client.get(`/hr/rewards`).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (values: any) => client.post(`/hr/rewards`, {
      ...values,
      thang_ap_dung: values.ky_luong.month() + 1,
      nam_ap_dung: values.ky_luong.year(),
    }),
    onSuccess: () => {
      message.success('Đã thêm bản ghi mới')
      setModalVisible(false)
      form.resetFields()
      refetch()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi thêm bản ghi')
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) =>
      client.put(`/hr/rewards/${id}/status`, null, { params: { status } }),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái')
      refetch()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi cập nhật trạng thái')
    },
  })

  // Client-side filter (vì backend chưa expose query params filter)
  const filteredRewards = (rewards as any[]).filter(r => {
    if (filterType !== 'all' && r.loai !== filterType) return false
    if (filterStatus !== 'all' && r.trang_thai !== filterStatus) return false
    return true
  })

  const columns = [
    { title: 'Ngày QĐ', dataIndex: 'ngay_quyet_dinh', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Nhân viên', dataIndex: 'employee', render: (v: any) => <Text strong>{v.ho_ten} ({v.ma_nv})</Text> },
    { title: 'Loại', dataIndex: 'loai', render: (v: string) => (
      <Tag color={v === 'khen_thuong' ? 'gold' : 'error'}>
        {v === 'khen_thuong' ? <TrophyOutlined /> : <WarningOutlined />} {v === 'khen_thuong' ? 'KHEN THƯỞNG' : 'KỶ LUẬT'}
      </Tag>
    )},
    { title: 'Hình thức', dataIndex: 'hinh_thuc' },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, render: (v: number | null) => {
      const n = Number(v ?? 0)
      return (
        <Text strong style={{ color: n > 0 ? '#d48806' : n < 0 ? '#cf1322' : '#8c8c8c' }}>
          {n > 0 ? '+' : ''}{n.toLocaleString('vi-VN')}đ
        </Text>
      )
    }},
    { title: 'Kỳ lương áp dụng', render: (_: any, r: any) => r.thang && r.nam ? `Tháng ${r.thang}/${r.nam}` : '—' },
    { title: 'Lý do', dataIndex: 'ly_do', ellipsis: true },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai',
      render: (v: string) => {
        const cfg = STATUS_LABEL[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    { title: 'Thao tác', width: 180, render: (_: any, r: any) => (
      <Space size={4}>
        {r.trang_thai === 'moi' && (
          <Button type="link" size="small" icon={<CheckCircleOutlined />}
            onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'da_duyet' })}>
            Duyệt
          </Button>
        )}
        {r.trang_thai === 'da_duyet' && (
          <Button type="link" size="small" icon={<DollarOutlined />}
            onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'da_chi' })}>
            Đã chi
          </Button>
        )}
      </Space>
    )},
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('hr-reward-discipline', columns)

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quản lý Khen thưởng & Kỷ luật</Title>
          <Text type="secondary">Ghi nhận các khoản thưởng/phạt để tự động cộng/trừ vào bảng lương tháng</Text>
        </Col>
        <Col>
          <Space>
            {settingsButton}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>Thêm quyết định mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Text>Loại:</Text>
          <Select
            size="small" value={filterType} onChange={setFilterType} style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'khen_thuong', label: '🏆 Khen thưởng' },
              { value: 'ky_luat', label: '⚠ Kỷ luật' },
            ]}
          />
          <Text>Trạng thái:</Text>
          <Select
            size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: 180 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v.text })),
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({filteredRewards.length} / {(rewards as any[]).length} bản ghi)
          </Text>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredRewards}
          columns={displayColumns}
          rowKey="id"
          loading={isLoading}
          size="small"
          bordered
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Thêm quyết định Khen thưởng / Kỷ luật"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
            <Select 
                showSearch 
                placeholder="Tìm nhân viên..."
                options={(employees || []).map((e: any) => ({ value: e.id, label: `${e.ma_nv} - ${e.ho_ten}` }))} 
                filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
                <Select>
                  <Option value="khen_thuong">Khen thưởng</Option>
                  <Option value="ky_luat">Kỷ luật</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ky_luong" label="Kỳ lương áp dụng" rules={[{ required: true }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="hinh_thuc" label="Hình thức (VD: Thưởng năng suất, Phạt đi muộn...)" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="so_tien" label="Số tiền" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do chi tiết" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
