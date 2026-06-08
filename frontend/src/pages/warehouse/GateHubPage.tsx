import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/auth'
import { usePermission } from '../../hooks/usePermission'
import dayjs from 'dayjs'

interface Tile {
  loai: string
  icon: string
  label: string
  sub: string
  color: string
  grad: string
  border: string
  href: string | null
  /** Permission required to see/use this tile. */
  permission: string
}

const TILES: Tile[] = [
  {
    loai: '',
    icon: '📄',
    label: 'GIẤY CUỘN',
    sub: 'Nhập giấy nguyên liệu từ NCC',
    color: '#1677ff',
    grad: 'linear-gradient(135deg, #001d66 0%, #003eb5 100%)',
    border: '#1677ff',
    href: null,
    permission: 'inventory.import',
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
    permission: 'inventory.import',
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
    permission: 'inventory.import',
  },
]

export default function GateHubPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { hasPermission } = usePermission()

  // Guard: chưa đăng nhập → về màn login (chạy như side-effect, không render UI trống).
  useEffect(() => {
    if (!user) navigate('/gate-login')
  }, [user, navigate])

  const handleLogout = () => {
    logout()
    navigate('/gate-login')
  }

  const handleTileClick = (tile: Tile) => {
    if (tile.href) {
      navigate(tile.href)
    } else {
      navigate(`/gate/nhap-nhanh${tile.loai ? `?loai=${tile.loai}` : ''}`)
    }
  }

  // Chỉ hiển thị tile mà user có quyền (admin luôn thấy tất cả qua usePermission).
  const visibleTiles = TILES.filter(tile => hasPermission(tile.permission))

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
          {user?.role && (
            <div style={{ fontSize: 12, color: '#58a6ff', marginTop: 2 }}>
              {user.role}
            </div>
          )}
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
        {visibleTiles.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#8b949e',
            gap: 8,
            padding: '0 24px',
          }}>
            <span style={{ fontSize: 48, lineHeight: 1 }}>🔒</span>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>
              Bạn không có quyền nhập kho
            </div>
            <div style={{ fontSize: 13 }}>
              Liên hệ quản trị viên để được cấp quyền nhập kho.
            </div>
          </div>
        ) : (
          visibleTiles.map(tile => (
            <div
              key={tile.label}
              role="button"
              tabIndex={0}
              onClick={() => handleTileClick(tile)}
              onKeyDown={e => e.key === 'Enter' && handleTileClick(tile)}
              style={{
                flex: 1,
                minHeight: 110,
                background: tile.grad,
                border: `2px solid ${tile.border}`,
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
              <span style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{tile.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: tile.color, fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>
                  {tile.label}
                </div>
                <div style={{ color: '#8b949e', fontSize: 13, marginTop: 3 }}>{tile.sub}</div>
              </div>
              <span style={{ color: tile.color, fontSize: 28, opacity: 0.6 }}>›</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
