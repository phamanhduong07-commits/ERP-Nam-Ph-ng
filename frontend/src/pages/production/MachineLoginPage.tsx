import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Tabs, Alert, Typography } from 'antd'
import { UserOutlined, LockOutlined, ScanOutlined } from '@ant-design/icons'
import { cd2Api, WorkerSession } from '../../api/cd2'

const { Title, Text } = Typography

export default function MachineLoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rfidValue, setRfidValue] = useState('')

  function saveSession(session: WorkerSession) {
    localStorage.setItem('cd2_worker_session', JSON.stringify(session))
    navigate('/production/cd2/mobile-tracking')
  }

  async function handlePasswordLogin(values: { token_user: string; token_password: string }) {
    setLoading(true)
    setError(null)
    try {
      const res = await cd2Api.machineLogin({ token_user: values.token_user, token_password: values.token_password })
      saveSession(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleRfidSubmit(rfid: string) {
    if (!rfid.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await cd2Api.machineLogin({ rfid_key: rfid.trim() })
      saveSession(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Thẻ không hợp lệ')
      setRfidValue('')
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
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      padding: 24,
    }}>
      <Card style={{ width: 380, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>CD2 — Đăng nhập máy</Title>
          <Text type="secondary">Công nhân đăng nhập để bắt đầu ca làm việc</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Tabs
          defaultActiveKey="password"
          centered
          items={[
            {
              key: 'password',
              label: 'Mật khẩu',
              children: (
                <Form layout="vertical" onFinish={handlePasswordLogin} disabled={loading}>
                  <Form.Item name="token_user" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
                    <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" size="large" autoComplete="username" />
                  </Form.Item>
                  <Form.Item name="token_password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" autoComplete="current-password" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                      Đăng nhập
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'rfid',
              label: 'Thẻ RFID',
              children: (
                <div>
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#8c8c8c' }}>
                    <ScanOutlined style={{ fontSize: 48, marginBottom: 12, display: 'block' }} />
                    <Text type="secondary">Quét thẻ hoặc nhập mã RFID</Text>
                  </div>
                  <Input
                    value={rfidValue}
                    onChange={(e) => setRfidValue(e.target.value)}
                    onPressEnter={() => handleRfidSubmit(rfidValue)}
                    placeholder="Mã RFID..."
                    size="large"
                    autoFocus
                    disabled={loading}
                  />
                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={loading}
                    onClick={() => handleRfidSubmit(rfidValue)}
                    style={{ marginTop: 12 }}
                  >
                    Xác nhận
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
