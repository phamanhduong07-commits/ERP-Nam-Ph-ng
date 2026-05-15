import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Table, Tag, Button, Card, Space, Typography, Row, Col, Modal, Form, Input, InputNumber, Select, message, DatePicker
} from 'antd'
import { 
  TrophyOutlined, 
  WarningOutlined, 
  PlusOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export default function RewardDisciplinePage() {
  const [modalVisible, setModalVisible] = useState(false)
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
      nam_ap_dung: values.ky_luong.year()
    }),
    onSuccess: () => {
      message.success('Đã thêm bản ghi mới')
      setModalVisible(false)
      form.resetFields()
      refetch()
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number, status: string }) => 
      client.put(`/hr/rewards/${id}/status`, null, { params: { status } }),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái')
      refetch()
    }
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
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right' as const, render: (v: number) => (
      <Text strong style={{ color: v > 0 ? '#d48806' : '#cf1322' }}>
        {v > 0 ? '+' : ''}{v.toLocaleString()}đ
      </Text>
    )},
    { title: 'Kỳ lương áp dụng', render: (_: any, r: any) => `Tháng ${r.thang}/${r.nam}` },
    { title: 'Lý do', dataIndex: 'ly_do', ellipsis: true },
    { title: 'Trạng thái', dataIndex: 'trang_thai', render: (v: string) => <Tag color={v === 'da_duyet' ? 'green' : 'orange'}>{v.toUpperCase()}</Tag> },
    { title: 'Thao tác', render: (_: any, r: any) => (
      <Space>
        {r.trang_thai === 'moi' && (
          <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'da_duyet' })}>Duyệt</Button>
        )}
      </Space>
    )}
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quản lý Khen thưởng & Kỷ luật</Title>
          <Text type="secondary">Ghi nhận các khoản thưởng/phạt để tự động cộng/trừ vào bảng lương tháng</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>Thêm quyết định mới</Button>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table 
          dataSource={rewards || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          bordered
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
