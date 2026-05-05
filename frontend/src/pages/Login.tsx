import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'
import namPhuongLogo from '../assets/nam-phuong-logo-cropped.png'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(values.username, values.password)
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Đăng nhập thất bại, vui lòng thử lại')
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
      background: 'linear-gradient(135deg, #1b168e 0%, #15116f 62%, #ff8200 100%)',
      padding: 24,
    }}>
      <Card style={{ width: 420, boxShadow: '0 16px 44px rgba(8, 12, 56, 0.28)', border: '1px solid rgba(255,255,255,0.72)' }}>
        <Space className="np-login-brand" direction="vertical" style={{ width: '100%', textAlign: 'center' }} size={4}>
          <img
            src={namPhuongLogo}
            alt="Nam Phuong"
            style={{ width: 260, maxWidth: '100%', height: 118, objectFit: 'contain', margin: '0 auto' }}
          />
          <Text style={{ fontSize: 32 }}>🏭</Text>
          <Title level={3} style={{ margin: 0 }}>ERP Nam Phương</Title>
          <Text type="secondary">Hệ thống quản lý sản xuất</Text>
        </Space>

        <Form
          name="login"
          onFinish={onFinish}
          style={{ marginTop: 24 }}
          size="large"
        >
          {error && (
            <Form.Item>
              <Alert message={error} type="error" showIcon />
            </Form.Item>
          )}

          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" autoComplete="username" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
          Công ty TNHH SX TM Nam Phương
        </Text>
      </Card>
    </div>
  )
}
