import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export type HubItem = {
  label: string
  to: string
  icon: string
  permissions?: string[]
}

export type HubGroup = {
  title: string
  items: HubItem[]
}

function canSee(permissions: string[] | undefined, role: string, userPermissions: string[]): boolean {
  if (role === 'ADMIN' || role === 'admin') return true
  if (!permissions || permissions.length === 0) return true
  return permissions.some(p => userPermissions.includes(p))
}

function HubCard({ icon, label, to, accent }: HubItem & { accent: string }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => navigate(to)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 10px 14px', background: hovered ? `${accent}0a` : '#fff',
        borderRadius: 10, cursor: 'pointer',
        border: `1.5px solid ${hovered ? accent : '#e8e8e8'}`,
        transition: 'all 0.18s', textAlign: 'center', gap: 8,
        boxShadow: hovered ? `0 4px 16px ${accent}30` : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        userSelect: 'none',
        minHeight: 86,
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#262626', lineHeight: 1.35, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

interface ModuleHubProps {
  title: string
  subtitle?: string
  accentColor: string
  groups: HubGroup[]
}

export default function ModuleHub({ title, subtitle, accentColor, groups }: ModuleHubProps) {
  const user = useAuthStore(state => state.user)
  const role = user?.role ?? ''
  const perms: string[] = user?.permissions ?? []

  return (
    <div style={{ background: 'var(--page-bg, #f0f2f7)', minHeight: '100%' }}>
      {/* Module header bar */}
      <div style={{
        background: accentColor,
        padding: '20px 28px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 3 }}>{subtitle}</div>
          )}
        </div>
      </div>

      {/* Groups */}
      <div style={{ padding: '20px 24px' }}>
        {groups.map(group => {
          const visible = group.items.filter(i => canSee(i.permissions, role, perms))
          if (!visible.length) return null
          return (
            <div
              key={group.title}
              style={{
                marginBottom: 16, background: '#fff', borderRadius: 10,
                padding: '18px 20px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                border: '1px solid #e7e9f2',
              }}
            >
              {/* Section header pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: `${accentColor}14`, color: accentColor,
                  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.4px',
                  padding: '3px 10px', borderRadius: 20,
                  textTransform: 'uppercase' as const,
                }}>
                  {group.title}
                </div>
                <div style={{ flex: 1, height: 1, background: '#e7e9f2' }} />
              </div>

              {/* Card grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {visible.map(item => (
                  <HubCard key={item.to} {...item} accent={accentColor} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
