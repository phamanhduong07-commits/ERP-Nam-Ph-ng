import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert, Space, Divider, Modal } from 'antd'
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/auth'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'

const { Title, Text } = Typography

export default function GateLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(values.username, values.password)
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user)
      navigate('/gate-hub')
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Đăng nhập thất bại, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a3d0a 0%, #145214 60%, #1b7e1b 100%)',
      padding: 16,
    }}>
      <Card style={{ width: 400, maxWidth: '100%', boxShadow: '0 16px 44px rgba(0,0,0,0.35)', borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }} size={4}>
          <img src={namPhuongLogo} alt="Nam Phuong"
            style={{ width: 200, maxWidth: '100%', height: 90, objectFit: 'contain', margin: '0 auto' }} />
          <Text style={{ fontSize: 28 }}>🚛</Text>
          <Title level={3} style={{ margin: 0 }}>Nhận hàng tại cổng</Title>
          <Text type="secondary">Đăng nhập để ghi nhận xe nhập hàng</Text>
        </Space>

        <Form form={form} onFinish={onFinish} style={{ marginTop: 28 }} size="large">
          {error && (
            <Form.Item>
              <Alert message={error} type="error" showIcon closable onClose={() => setError('')} />
            </Form.Item>
          )}

          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block
              style={{ height: 52, fontSize: 18, fontWeight: 700, background: '#389e0d', borderColor: '#389e0d', borderRadius: 8 }}>
              🚛 Vào nhận hàng
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '20px 0 12px' }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button block onClick={() => navigate('/login')} style={{ flex: 1 }}>
            ← Đăng nhập thường
          </Button>
          <Button block icon={<ScanOutlined />} onClick={() => Modal.info({
            title: 'Cài đặt App về điện thoại',
            content: (
              <div style={{ marginTop: 12 }}>
                <p><b>Android:</b> Menu 3 chấm → "Cài đặt ứng dụng"</p>
                <p><b>iPhone:</b> Nút Chia sẻ → "Thêm vào màn hình chính"</p>
              </div>
            ),
            okText: 'Đã hiểu',
          })} style={{ flex: 1 }}>
            Tải App
          </Button>
        </div>

        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12, marginTop: 16 }}>
          Công ty TNHH SX TM Nam Phương
        </Text>
      </Card>
    </div>
  )
}
