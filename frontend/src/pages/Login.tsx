import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert, Space, Modal, Divider } from 'antd'
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons'
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
      const detail = (err as any)?.response?.data?.detail
      let msg = detail
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => d.msg).join(', ')
      } else if (typeof detail === 'object' && detail !== null) {
        msg = JSON.stringify(detail)
      }
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
              Đăng nhập Quản trị
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 12 }}>
          <Button 
            type="primary" 
            size="large"
            onClick={() => navigate('/cd2/machine-login')}
            style={{ 
              fontWeight: 700, 
              background: '#ff8200', 
              borderColor: '#ff8200',
              height: 50,
              width: '100%',
              fontSize: 16,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(255, 130, 0, 0.3)'
            }}
          >
            🏭 ĐĂNG NHẬP MÁY
          </Button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Button 
            type="default" 
            icon={<ScanOutlined />}
            onClick={() => {
              Modal.info({
                title: 'Hướng dẫn cài đặt App Nam Phương',
                width: 400,
                content: (
                  <div style={{ marginTop: 16 }}>
                    <p><b>Dành cho Android (Samsung, Oppo...):</b></p>
                    <p>1. Bấm nút <b>3 chấm</b> góc trên bên phải Chrome.</p>
                    <p>2. Chọn <b>"Cài đặt ứng dụng"</b> hoặc "Thêm vào MH chính".</p>
                    <Divider />
                    <p><b>Dành cho iPhone (Safari):</b></p>
                    <p>1. Bấm nút <b>Chia sẻ</b> (hình ô vuông mũi tên lên) ở dưới cùng.</p>
                    <p>2. Chọn <b>"Thêm vào màn hình chính"</b>.</p>
                  </div>
                ),
                okText: 'Đã hiểu',
              });
            }}
          >
            Tải App về điện thoại
          </Button>
        </div>

        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
          Công ty TNHH SX TM Nam Phương
        </Text>
      </Card>
    </div>
  )
}
