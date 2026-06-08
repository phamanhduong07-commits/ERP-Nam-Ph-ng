import ModuleHub from '../../components/ModuleHub'
import type { HubGroup } from '../../components/ModuleHub'

const GROUPS: HubGroup[] = [
  {
    title: 'Tổng quan & Tồn kho',
    items: [
      { icon: '🏪', label: 'Kho theo xưởng', to: '/warehouse/theo-xuong', permissions: ['inventory.view', 'inventory.import'] },
      { icon: '📊', label: 'Tồn kho', to: '/warehouse/inventory', permissions: ['inventory.view', 'inventory.import'] },
      { icon: '📔', label: 'Thẻ kho / Sổ CT', to: '/warehouse/the-kho', permissions: ['inventory.view', 'inventory.import'] },
    ],
  },
  {
    title: 'Nhập kho',
    items: [
      { icon: '🧻', label: 'Nhập giấy cuộn', to: '/warehouse/nhap-giay', permissions: ['inventory.import'] },
      { icon: '⚖️', label: 'Cân giấy cuộn', to: '/warehouse/can-cuon-giay', permissions: ['inventory.import'] },
      { icon: '📥', label: 'Nhập phôi (mua ngoài)', to: '/warehouse/nhap-phoi-ngoai', permissions: ['inventory.import'] },
      { icon: '📦', label: 'Nhập NVL khác', to: '/warehouse/receipts', permissions: ['inventory.import'] },
      { icon: '🏭', label: 'Nhập TP từ SX', to: '/warehouse/production-output', permissions: ['inventory.import'] },
    ],
  },
  {
    title: 'Ghi nhận nhanh (Cổng)',
    items: [
      { icon: '📷', label: 'Xe nhập giấy', to: '/warehouse/nhap-nhanh', permissions: ['inventory.import'] },
      { icon: '📷', label: 'Xe nhập NVL', to: '/warehouse/nhap-nhanh?loai=nvl', permissions: ['inventory.import'] },
      { icon: '📷', label: 'Xe nhập phôi', to: '/warehouse/nhap-nhanh?loai=phoi', permissions: ['inventory.import'] },
    ],
  },
  {
    title: 'Xuất & Chuyển kho',
    items: [
      { icon: '📤', label: 'Xuất NVL SX', to: '/warehouse/issues', permissions: ['inventory.export'] },
      { icon: '🔄', label: 'Chuyển kho', to: '/warehouse/transfers', permissions: ['inventory.transfer'] },
      { icon: '🔎', label: 'Kiểm kê / điều chỉnh', to: '/warehouse/stock-adjustments', permissions: ['inventory.adjust'] },
    ],
  },
]

export default function WarehouseHubPage() {
  return <ModuleHub title="Kho" accentColor="#0277bd" groups={GROUPS} />
}
