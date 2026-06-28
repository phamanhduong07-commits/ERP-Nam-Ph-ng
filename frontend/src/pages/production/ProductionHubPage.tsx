import ModuleHub from '../../components/ModuleHub'
import type { HubGroup } from '../../components/ModuleHub'

const GROUPS: HubGroup[] = [
  {
    title: 'Lệnh & Kế hoạch',
    items: [
      { icon: '📋', label: 'Lệnh sản xuất', to: '/production/orders' },
      { icon: '🔍', label: 'Theo dõi LSX', to: '/production/theo-doi' },
      { icon: '📅', label: 'Kế hoạch SX', to: '/production/plans' },
      { icon: '♻️', label: 'Kế hoạch tận dụng', to: '/production/tan-dung' },
      { icon: '⏳', label: 'KH SX chờ', to: '/production/queue' },
    ],
  },
  {
    title: 'Định mức & Chi phí',
    items: [
      { icon: '🗂️', label: 'Định mức (BOM)', to: '/production/bom' },
      { icon: '📊', label: 'Phân tích chi phí', to: '/production/cost-analysis' },
      { icon: '🌊', label: 'Máy Sóng', to: '/production/may-song' },
    ],
  },
  {
    title: 'Kho Sản xuất',
    items: [
      { icon: '📦', label: 'Kho phôi sóng', to: '/production/kho-phoi', permissions: ['inventory.view', 'inventory.phoi_tp'] },
      { icon: '✅', label: 'Kho thành phẩm', to: '/production/kho-thanh-pham', permissions: ['inventory.view', 'inventory.phoi_tp'] },
      { icon: '⚠️', label: 'Kho hàng lỗi', to: '/production/kho-loi', permissions: ['inventory.view', 'inventory.phoi_tp'] },
      { icon: '📥', label: 'DS nhập phôi', to: '/production/phieu-nhap-phoi', permissions: ['inventory.view', 'inventory.import'] },
    ],
  },
  {
    title: 'CD2 — Công đoạn 2',
    items: [
      { icon: '📈', label: 'Dashboard', to: '/production/cd2/dashboard' },
      { icon: '🗂️', label: 'Kanban máy in', to: '/production/cd2' },
      { icon: '🏭', label: 'Kanban TP', to: '/production/cd2/sauin-kanban' },
      { icon: '📋', label: 'Queue máy in', to: '/production/cd2/may-in' },
      { icon: '📊', label: 'Thống kê SL', to: '/production/cd2/history' },
      { icon: '👷', label: 'Máy in của tôi', to: '/production/cd2/worker' },
      { icon: '⏰', label: 'Quản lý ca', to: '/production/cd2/shift' },
      { icon: '📦', label: 'Quét mã nhập kho TP', to: '/production/cd2/nhap-kho-tp' },
      { icon: '⚙️', label: 'Cấu hình CD2', to: '/production/cd2/config', permissions: ['master.other.manage'] },
    ],
  },
]

export default function ProductionHubPage() {
  return <ModuleHub title="Sản xuất" accentColor="#2e7d32" groups={GROUPS} />
}
