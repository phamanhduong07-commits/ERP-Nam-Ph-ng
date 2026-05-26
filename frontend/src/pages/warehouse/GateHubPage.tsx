import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/auth'
import dayjs from 'dayjs'

const TILES = [
  {
    loai: '',
    icon: '📄',
    label: 'GIẤY CUỘN',
    sub: 'Nhập giấy nguyên liệu từ NCC',
    color: '#1677ff',
    grad: 'linear-gradient(135deg, #001d66 0%, #003eb5 100%)',
    border: '#1677ff',
    href: null,
  },
  {
    loai: 'phoi',
    icon: '🟩',
    label: 'PHÔI',
    sub: 'Nhập phôi từ nhà cung cấp',
    color: '#52c41a',
    grad: 'linear-gradient(135deg, #092b00 0%, #135200 100%)',
    border: '#52c41a',
    href: null,
  },
  {
    loai: 'nvl',
    icon: '🧴',
    label: 'NVL PHỤ',
    sub: 'Nhập nguyên vật liệu phụ',
    color: '#b37feb',
    grad: 'linear-gradient(135deg, #120338 0%, #22075e 100%)',
    border: '#722ed1',
    href: null,
  },
]

export default function GateHubPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/gate-login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 12px',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        paddingTop: 'env(safe-area-inset-top, 8px)',
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#6e7681' }}>Xin chào,</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3', marginTop: 2 }}>
            {user?.ho_ten || user?.username}
          </div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>
            🕐 {dayjs().format('HH:mm — DD/MM/YYYY')}
          </div>
        </div>
        <Button
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          size="small"
          style={{
            background: 'transparent',
            border: '1px solid #30363d',
            color: '#8b949e',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Thoát
        </Button>
      </div>

      <div style={{
        fontSize: 16,
        color: '#8b949e',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 0.3,
      }}>
        Chọn nghiệp vụ
      </div>

      {/* Tiles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {TILES.map(({ loai, icon, label, sub, color, grad, border, href }) => (
          <div
            key={label}
            role="button"
            tabIndex={0}
            onClick={() => href ? navigate(href) : navigate(`/gate/nhap-nhanh${loai ? `?loai=${loai}` : ''}`)}
            onKeyDown={e => e.key === 'Enter' && (href ? navigate(href) : navigate(`/gate/nhap-nhanh${loai ? `?loai=${loai}` : ``}`))}
            style={{
              flex: 1,
              minHeight: 110,
              background: grad,
              border: `2px solid ${border}`,
              borderRadius: 18,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              gap: 18,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'rgba(0,0,0,0)',
              userSelect: 'none',
              outline: 'none',
            }}
          >
            <span style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color, fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>
                {label}
              </div>
              <div style={{ color: '#8b949e', fontSize: 13, marginTop: 3 }}>{sub}</div>
            </div>
            <span style={{ color, fontSize: 28, opacity: 0.6 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
