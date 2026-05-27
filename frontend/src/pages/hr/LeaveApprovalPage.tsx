import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Table, Tag, Button, Card, Space, Typography, Row, Col, Modal, Form, Input, Select, message
} from 'antd'
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  FileTextOutlined,
  UserOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography
const { TextArea } = Input

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export default function LeaveApprovalPage() {
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedReq, setSelectedReq] = useState<unknown>(null)
  const [form] = Form.useForm()

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['hr-leave-requests'],
    queryFn: () => client.get(`/hr/leave-requests`).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => client.put(`/hr/leave-requests/${selectedReq.id}/approve`, values),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái đơn')
      setModalVisible(false)
      refetch()
    }
  })

  const columns = [
    { title: 'Ngày tạo', dataIndex: 'created_at', render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    { title: 'Nhân viên', dataIndex: 'employee', render: (v: unknown) => (
      <Space>
        <UserOutlined />
        <Text strong>{v.ho_ten}</Text>
        <Text type="secondary">({v.ma_nv})</Text>
      </Space>
    )},
    { title: 'Loại đơn', dataIndex: 'loai_don', render: (v: string) => (
      <Tag color={v === 'nghi_phep' ? 'blue' : 'orange'}>{v.toUpperCase()}</Tag>
    )},
    { title: 'Thời gian', render: (_: unknown, r: LeaveRequest) => (
      <div>
        {dayjs(r.ngay_bat_dau).format('DD/MM HH:mm')} - {dayjs(r.ngay_ket_thuc).format('DD/MM HH:mm')}
        <br />
        <Text type="secondary">({r.tong_ngay} ngày)</Text>
      </div>
    )},
    { title: 'Lý do', dataIndex: 'ly_do' },
    { title: 'Trạng thái', dataIndex: 'trang_thai', render: (v: string) => {
      let color = 'default'
      if (v === 'phong_ban_duyet') color = 'processing'
      if (v === 'bgd_duyet') color = 'success'
      if (v === 'tu_choi') color = 'error'
      return <Tag color={color}>{v.toUpperCase()}</Tag>
    }},
    { title: 'Thao tác', render: (_: unknown, r: LeaveRequest) => (
      <Button 
        type="link" 
        icon={<CheckCircleOutlined />} 
        onClick={() => {
          setSelectedReq(r)
          setModalVisible(true)
        }}
        disabled={r.trang_thai === 'bgd_duyet' || r.trang_thai === 'tu_choi'}
      >
        Xét duyệt
      </Button>
    )}
  ]

  const handleApprove = (status: string) => {
    const values = form.getFieldsValue()
    approveMutation.mutate({
      trang_thai: status,
      y_kien_duyet: values.y_kien_duyet,
      nguoi_duyet_id: 1 // Tạm thời giả định admin duyệt
    })
  }

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Phê duyệt Đơn từ & Nghỉ phép</Title>
          <Text type="secondary">Quy trình duyệt 2 cấp: Trưởng bộ phận {"->"} Ban Giám Đốc</Text>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table 
          dataSource={requests || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
        />
      </Card>

      <Modal
        title="Xét duyệt đơn từ"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="reject" danger icon={<CloseCircleOutlined />} onClick={() => handleApprove('tu_choi')}>
            Từ chối
          </Button>,
          <Button key="dept" type="primary" onClick={() => handleApprove('phong_ban_duyet')}>
            Trưởng phòng Duyệt
          </Button>,
          <Button key="bgd" type="primary" style={{ background: '#52c41a' }} onClick={() => handleApprove('bgd_duyet')}>
            BGD Duyệt (Chốt)
          </Button>
        ]}
      >
        {selectedReq && (
          <Form form={form} layout="vertical">
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <Text strong>{selectedReq.employee.ho_ten}</Text> xin nghỉ {selectedReq.loai_don} 
              <br />
              Từ: {dayjs(selectedReq.ngay_bat_dau).format('DD/MM/YYYY HH:mm')}
              <br />
              Đến: {dayjs(selectedReq.ngay_ket_thuc).format('DD/MM/YYYY HH:mm')}
              <br />
              Lý do: <Text italic>{selectedReq.ly_do}</Text>
            </div>
            <Form.Item name="y_kien_duyet" label="Ý kiến phê duyệt">
              <TextArea rows={3} placeholder="Nhập ý kiến (nếu có)..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
