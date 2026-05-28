import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card, Col, Row, Typography, Space, Button, Avatar, List, Tag, Tabs, Modal, Form, DatePicker, Input, message, Select
} from 'antd'
import { 
  UserOutlined, 
  DollarOutlined, 
  CalendarOutlined, 
  FileTextOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'
import { useAuthStore } from '../../store/auth'

const { Title, Text } = Typography
const { TextArea } = Input

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export default function EmployeeMobilePortal() {
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('home')
  const [leaveModal, setLeaveModal] = useState(false)
  const [form] = Form.useForm()

  type ProfileData = { ho_ten?: string; ma_nv?: string; chuc_vu?: string; employee_id?: number; id?: number }
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => client.get<ProfileData>(`/hr/me/profile`).then(r => r.data),
  })

  const { data: payrolls = [] } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: () => client.get(`/hr/me/payroll`).then(r => r.data),
  })

  const { data: leaves = [], refetch: refetchLeaves } = useQuery({
    queryKey: ['my-leave'],
    queryFn: () => client.get(`/hr/me/leave-requests`).then(r => r.data),
  })

  type LeaveFormValues = { loai_don: string; ngay_bat_dau: string | { toISOString?: () => string }; ngay_ket_thuc: string | { toISOString?: () => string }; ly_do: string }
  const createLeaveMutation = useMutation({
    mutationFn: (values: LeaveFormValues) => client.post(`/hr/leave-requests`, {
      ...values,
      employee_id: profile?.employee_id || profile?.id,
      ngay_bat_dau: (values.ngay_bat_dau as unknown as { toISOString?: () => string })?.toISOString?.() || String(values.ngay_bat_dau),
      ngay_ket_thuc: (values.ngay_ket_thuc as unknown as { toISOString?: () => string })?.toISOString?.() || String(values.ngay_ket_thuc),
      tong_ngay: Math.max(0.5, dayjs(values.ngay_ket_thuc as string).diff(dayjs(values.ngay_bat_dau as string), 'day') + 1)
    }),
    onSuccess: () => {
      message.success('Đã gửi đơn thành công')
      setLeaveModal(false)
      refetchLeaves()
    }
  })

  const renderHome = () => (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16, borderRadius: 12, background: 'linear-gradient(135deg, #1b168e 0%, #3a33d1 100%)', border: 'none' }}>
        <Space size="large">
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#ff8200' }} />
          <div style={{ color: 'white' }}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>{profile?.ho_ten}</Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{profile?.ma_nv} - {profile?.chuc_vu}</Text>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', borderRadius: 12 }} 
            onClick={() => setActiveTab('payroll')}
          >
            <DollarOutlined style={{ fontSize: 32, color: '#ff8200', marginBottom: 8 }} />
            <br /><Text strong>Phiếu lương</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => setActiveTab('leave')}
          >
            <FileTextOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 8 }} />
            <br /><Text strong>Đơn từ</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', borderRadius: 12 }}
          >
            <CalendarOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
            <br /><Text strong>Chấm công</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => logout()}
          >
            <LogoutOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 8 }} />
            <br /><Text strong>Đăng xuất</Text>
          </Card>
        </Col>
      </Row>
    </div>
  )

  const renderPayroll = () => (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')} style={{ marginBottom: 16 }}>Quay lại</Button>
      <Title level={4}>Lịch sử nhận lương</Title>
      <List
        dataSource={payrolls || []}
        renderItem={(item: { thang: number; nam: number; thuc_linh: number }) => (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 8 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary">Tháng {item.thang}/{item.nam}</Text>
                <br />
                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>{item.thuc_linh.toLocaleString()}đ</Text>
              </Col>
              <Col>
                <Tag color="green">ĐÃ CHI TRẢ</Tag>
              </Col>
            </Row>
          </Card>
        )}
      />
    </div>
  )

  const renderLeave = () => (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')}>Quay lại</Button>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setLeaveModal(true)}>Tạo đơn</Button>
        </Col>
      </Row>
      <Title level={4}>Đơn từ của tôi</Title>
      <List
        dataSource={leaves || []}
        renderItem={(item: { loai_don: string; ngay_bat_dau: string; ngay_ket_thuc: string; trang_thai: string }) => (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 8 }}>
            <Row justify="space-between">
              <Col>
                <Text strong>{item.loai_don.toUpperCase()}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(item?.ngay_bat_dau).format('DD/MM')} - {dayjs(item?.ngay_ket_thuc).format('DD/MM')}
                </Text>
              </Col>
              <Col>
                <Tag color={item?.trang_thai === 'bgd_duyet' ? 'green' : 'orange'}>
                  {item?.trang_thai?.toUpperCase()}
                </Tag>
              </Col>
            </Row>
          </Card>
        )}
      />
    </div>
  )

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'payroll' && renderPayroll()}
      {activeTab === 'leave' && renderLeave()}

      <Modal
        title="Tạo đơn xin nghỉ / tăng ca"
        open={leaveModal}
        onCancel={() => setLeaveModal(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createLeaveMutation.mutate(v)}>
          <Form.Item name="loai_don" label="Loại đơn" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="nghi_phep">Nghỉ phép</Select.Option>
              <Option value="tang_ca">Tăng ca</Option>
              <Option value="di_muon_ve_som">Đi muộn/Về sớm</Option>
            </Select>
          </Form.Item>
          <Form.Item name="ngay_bat_dau" label="Từ ngày/giờ" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ngay_ket_thuc" label="Đến ngày/giờ" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function Option({ children, value }: { children: React.ReactNode, value: string }) {
    return <Select.Option value={value}>{children}</Select.Option>
}
