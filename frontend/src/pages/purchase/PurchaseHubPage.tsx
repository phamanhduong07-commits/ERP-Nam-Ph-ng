import ModuleHub from '../../components/ModuleHub'
import type { HubGroup } from '../../components/ModuleHub'

const GROUPS: HubGroup[] = [
  {
    title: 'Lập kế hoạch',
    items: [
      { icon: '📈', label: 'Dự báo nhu cầu', to: '/purchasing/du-bao-nhu-cau', permissions: ['purchase.orders'] },
      { icon: '📋', label: 'Yêu cầu mua hàng', to: '/purchasing/ymh', permissions: ['purchase.orders'] },
    ],
  },
  {
    title: 'Đặt hàng',
    items: [
      { icon: '🧻', label: 'Mua giấy cuộn', to: '/purchasing/giay-cuon', permissions: ['purchase.orders'] },
      { icon: '📦', label: 'Mua NVL khác', to: '/purchasing/nvl-khac', permissions: ['purchase.orders'] },
      { icon: '🛒', label: 'Đơn mua hàng (PO)', to: '/purchasing/orders', permissions: ['purchase.orders'] },
    ],
  },
  {
    title: 'Nhập hàng & Đối soát',
    items: [
      { icon: '📥', label: 'Phiếu nhập kho (GR)', to: '/purchasing/goods-receipts', permissions: ['purchase.goods_receipts'] },
      { icon: '↩️', label: 'Trả hàng NCC', to: '/purchasing/returns', permissions: ['purchase.returns'] },
      { icon: '🔍', label: 'Đối soát PO vs GR', to: '/purchasing/doi-soat-kho', permissions: ['purchase.goods_receipts'] },
    ],
  },
  {
    title: 'Công nợ & Báo cáo',
    items: [
      { icon: '🧾', label: 'Hóa đơn mua hàng', to: '/accounting/purchase-invoices', permissions: ['accounting.ap_ledger'] },
      { icon: '📋', label: 'Sổ chi tiết mua hàng', to: '/purchasing/reports/so-chi-tiet', permissions: ['purchase.reports'] },
      { icon: '📊', label: 'Báo cáo mua hàng', to: '/purchasing/reports', permissions: ['purchase.reports'] },
      { icon: '🏠', label: 'Dashboard mua hàng', to: '/purchasing/dashboard', permissions: ['purchase.reports'] },
    ],
  },
  {
    title: 'Tiện ích',
    items: [
      { icon: '🔄', label: 'Đối trừ chứng từ', to: '/purchasing/doi-tru', permissions: ['accounting.ap_ledger'] },
      { icon: '⚡', label: 'Đối trừ nhiều đối tượng', to: '/purchasing/doi-tru-nhieu', permissions: ['accounting.ap_ledger'] },
      { icon: '↩️', label: 'Bỏ đối trừ', to: '/purchasing/bo-doi-tru', permissions: ['accounting.ap_ledger'] },
      { icon: '🗑️', label: 'Bỏ đối trừ nhiều đối tượng', to: '/purchasing/bo-doi-tru-nhieu', permissions: ['accounting.ap_ledger'] },
      { icon: '🔃', label: 'Bù trừ công nợ', to: '/purchasing/bu-tru-cong-no', permissions: ['accounting.ap_ledger'] },
    ],
  },
]

export default function PurchaseHubPage() {
  return (
    <ModuleHub
      title="Mua hàng"
      subtitle="Quản lý đặt hàng, nhập kho và công nợ nhà cung cấp"
      accentColor="#00695c"
      groups={GROUPS}
    />
  )
}
