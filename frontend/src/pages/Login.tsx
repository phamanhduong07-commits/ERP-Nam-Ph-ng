import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert, Space, Modal, Divider, Select } from 'antd'
import { UserOutlined, LockOutlined, ScanOutlined, CrownOutlined, DollarOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/auth'
import namPhuongLogo from '../assets/nam-phuong-logo-cropped.png'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm()

  const handleQuickLogin = (u: string, p: string) => {
    form.setFieldsValue({ username: u, password: p })
    form.submit()
  }

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(values.username, values.password)
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user)
      navigate('/dashboard')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      let msg: string | undefined
      if (Array.isArray(detail)) {
        msg = detail.map((d: { msg?: string }) => d.msg).join(', ')
      } else if (typeof detail === 'object' && detail !== null) {
        msg = JSON.stringify(detail)
      } else if (typeof detail === 'string') {
        msg = detail
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
      <Card style={{ width: '100%', maxWidth: 420, boxShadow: '0 16px 44px rgba(8, 12, 56, 0.28)', border: '1px solid rgba(255,255,255,0.72)' }}>
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
          form={form}
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

        <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
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
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/gate-login')}
            style={{
              fontWeight: 700,
              background: '#389e0d',
              borderColor: '#389e0d',
              height: 50,
              width: '100%',
              fontSize: 16,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(56, 158, 13, 0.3)'
            }}
          >
            🚛 ĐĂNG NHẬP NHẬN HÀNG
          </Button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/gate-login')}
            style={{
              fontWeight: 700,
              background: '#1677ff',
              borderColor: '#1677ff',
              height: 50,
              width: '100%',
              fontSize: 16,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(22, 119, 255, 0.3)'
            }}
          >
            📦 XÁC NHẬN GIAO HÀNG
          </Button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/kho-login')}
            style={{
              fontWeight: 700,
              background: '#002766',
              borderColor: '#002766',
              height: 50,
              width: '100%',
              fontSize: 16,
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0, 39, 102, 0.3)'
            }}
          >
            ⚖️ CÂN CUỘN GIẤY
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

        {import.meta.env.DEV && (
          <>
            <Divider style={{ margin: '12px 0' }}>Đăng nhập nhanh (Test)</Divider>
            <div style={{ paddingBottom: 10 }}>
              <Select
                showSearch
                placeholder="Chọn chức vụ / phòng ban để test..."
                style={{ width: '100%', height: 40 }}
                onChange={(val) => handleQuickLogin(val, '123456')}
                options={[
                  { label: 'Hệ thống & BGD', options: [
                    { label: 'Administrator', value: 'ADMIN' },
                    { label: 'Giám đốc - Ban Giám Đốc', value: 'BGD_GIAM_DOC' },
                    { label: 'Tổ trưởng - Ban Giám Đốc', value: 'BGD_TO_TRUONG' },
                    { label: 'Nhân viên - Ban Giám Đốc', value: 'BGD_NHAN_VIEN' },
                  ]},
                  { label: 'Kinh Doanh & Sale Admin', options: [
                    { label: 'Trưởng phòng Sale Admin', value: 'TRUONG_PHONG_SALE_ADMIN' },
                    { label: 'Tổ trưởng - Sale Admin', value: 'SALE_ADMIN_TO_TRUONG' },
                    { label: 'Sale Admin', value: 'SALE_ADMIN' },
                    { label: 'Nhân viên - Sale Admin', value: 'SALE_ADMIN_NHAN_VIEN' },
                    { label: 'Tổ trưởng - Phòng Kinh Doanh', value: 'KINH_DOANH_TO_TRUONG' },
                    { label: 'Nhân viên - Phòng Kinh Doanh', value: 'KINH_DOANH_NHAN_VIEN' },
                  ]},
                  { label: 'Kế Toán', options: [
                    { label: 'Kế toán trưởng', value: 'KE_TOAN_TRUONG' },
                    { label: 'Kế toán công nợ', value: 'KE_TOAN_CONG_NO' },
                    { label: 'Tổ trưởng - Phòng Kế Toán', value: 'KETOAN_TO_TRUONG' },
                    { label: 'Nhân viên - Phòng Kế Toán', value: 'KETOAN_NHAN_VIEN' },
                  ]},
                  { label: 'Sản Xuất & Kho', options: [
                    { label: 'Giám sát - Khối Sản Xuất', value: 'SAN_XUAT_GIAM_SAT' },
                    { label: 'Tổ trưởng - Khối Sản Xuất', value: 'SAN_XUAT_TO_TRUONG' },
                    { label: 'Thợ - Khối Sản Xuất', value: 'SAN_XUAT_THO' },
                    { label: 'Tổ trưởng - Kho', value: 'KHO_TO_TRUONG' },
                    { label: 'Nhân viên - Kho', value: 'KHO_NHAN_VIEN' },
                  ]},
                  { label: 'Nhân Sự & Thiết Kế', options: [
                    { label: 'Tổ trưởng - Phòng Nhân Sự', value: 'NHAN_SU_TO_TRUONG' },
                    { label: 'Nhân viên - Phòng Nhân Sự', value: 'NHAN_SU_NHAN_VIEN' },
                    { label: 'Tổ trưởng - Phòng Thiết Kế', value: 'THIET_KE_TO_TRUONG' },
                    { label: 'Nhân viên - Phòng Thiết Kế', value: 'THIET_KE_NHAN_VIEN' },
                  ]}
                ]}
              />
            </div>
          </>
        )}

        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
          Công ty TNHH SX TM Nam Phương
        </Text>
      </Card>
    </div>
  )
}
