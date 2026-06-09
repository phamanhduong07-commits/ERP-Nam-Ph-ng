import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, Typography } from 'antd'

const { Title, Text } = Typography

export interface LowStockRow {
  ten_hang: string
  ten_kho: string
  ton_luong: number
  ton_toi_thieu: number
  don_vi: string
}

export interface DashboardStats {
  don_hang_moi_hom_nay: number
  cho_duyet: number
  dang_san_xuat: number
  tong_khach_hang: number
  sales?: {
    doanh_thu_hom_nay: number
    doanh_thu_thang: number
    don_hang_cho_duyet: number
    don_hang_da_duyet: number
    bao_gia_moi: number
    don_hang_can_giao: number
  }
  production?: {
    lenh_sx_moi: number
    dang_san_xuat: number
    lenh_sx_tre: number
    lenh_sx_hoan_thanh_hom_nay: number
  }
  warehouse?: {
    tong_gia_tri_ton: number
    giao_hang_cho_xuat: number
    ton_thap: LowStockRow[]
    phieu_nhap_hom_nay: number
    phieu_xuat_nvl_hom_nay: number
    phieu_giao_hom_nay: number
  }
  accounting?: {
    phieu_thu_cho_duyet: number
    phieu_chi_cho_duyet: number
    ar_tien_qua_han: number
    ar_so_hoa_don_qua_han: number
    ap_tien_qua_han: number
    ap_so_hoa_don_qua_han: number
    doanh_thu_thang_truoc: number
  }
  purchase?: {
    po_cho_duyet: number
    po_dang_ve: number
  }
  kpi?: {
    backlog_lsx: number
    backlog_so_luong: number
    ton_kho_phoi_kg: number
    ton_kho_tp_sl: number
    cong_no_qua_han_tien: number
    cong_no_qua_han_so_hd: number
  }
}

export const KPICard = ({ title, value, suffix, icon, color, gradient }: {
  title: string
  value: number | string
  suffix?: string
  icon: React.ReactNode
  color?: string
  gradient?: string
}) => (
  <Card
    variant="borderless"
    style={{
      borderRadius: 16,
      background: gradient || '#fff',
      boxShadow: gradient ? '0 8px 24px rgba(27,22,142,0.15)' : '0 4px 12px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Text style={{ color: gradient ? 'rgba(255,255,255,0.8)' : '#8c8c8c', fontSize: 13 }}>{title}</Text>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <Title level={3} style={{ margin: 0, color: gradient ? '#fff' : '#1b168e', fontWeight: 800 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Title>
          {suffix && (
            <Text style={{ color: gradient ? 'rgba(255,255,255,0.8)' : '#8c8c8c', fontSize: 12 }}>{suffix}</Text>
          )}
        </div>
      </div>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: gradient ? 'rgba(255,255,255,0.2)' : `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: gradient ? '#fff' : color,
        fontSize: 20,
      }}>
        {icon}
      </div>
    </div>
  </Card>
)

export const QuickLink = ({ icon, label, path, color }: {
  icon: React.ReactNode
  label: string
  path: string
  color: string
}) => (
  <Link to={path}>
    <Card hoverable size="small" styles={{ body: { padding: '12px 8px' } }}>
      <div style={{ color, fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <Text strong style={{ fontSize: 12, display: 'block' }}>{label}</Text>
    </Card>
  </Link>
)

export const DashboardHeader = ({
  userName,
  subtitle,
  actions,
}: {
  userName: string
  subtitle?: string
  actions?: React.ReactNode
}) => {
  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
      <div>
        <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#1b168e' }}>
          Chào {userName} 👋
        </Title>
        <Text type="secondary">
          {todayStr}
          {subtitle ? ` · ${subtitle}` : ' · Chúc bạn một ngày làm việc hiệu quả!'}
        </Text>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  )
}

// Prefetch common page chunks when user is idle on dashboard
const PREFETCH_GROUPS: Record<string, () => void> = {
  sales: () => {
    import('../sales/SalesOrdersPage')
    import('../quotes/QuotesPage')
    import('../sales/GiaoHangPage')
  },
  production: () => {
    import('../production/ProductionOrdersPage')
    import('../production/ProductionPlansPage')
  },
  warehouse: () => {
    import('../warehouse/InventoryPage')
    import('../warehouse/ReceiptsPage')
    import('../warehouse/NhapGiayPage')
  },
  accounting: () => {
    import('../accounting/CashReceiptListPage')
    import('../accounting/CashPaymentListPage')
    import('../reports/DebtSummaryPage')
  },
}

export function usePrefetchPages(groups: (keyof typeof PREFETCH_GROUPS)[]) {
  useEffect(() => {
    const prefetch = () => groups.forEach(g => PREFETCH_GROUPS[g]?.())
    if ('requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(prefetch)
      return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
    }
    const t = setTimeout(prefetch, 2000)
    return () => clearTimeout(t)
  }, [])
}

export const dashboardPageStyle: React.CSSProperties = {
  padding: '24px 40px',
  background: '#f8f9fc',
  minHeight: '100vh',
}

export const sharedCardStyle: React.CSSProperties = {
  borderRadius: 20,
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
}

export const hoverCardCss = `
  .ant-card-title { font-weight: 700 !important; color: #262626 !important; }
  .ant-card { transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1); }
  .ant-card-hoverable:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(27,22,142,0.08) !important; }
`
