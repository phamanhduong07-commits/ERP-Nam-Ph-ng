import ModuleHub from '../../components/ModuleHub'
import type { HubGroup } from '../../components/ModuleHub'

const GROUPS: HubGroup[] = [
  {
    title: 'Quỹ & Ngân hàng',
    items: [
      { icon: '💵', label: 'Phiếu thu', to: '/accounting/receipts' },
      { icon: '💸', label: 'Phiếu chi', to: '/accounting/payments' },
      { icon: '📒', label: 'Sổ quỹ tiền mặt', to: '/accounting/cash-book' },
      { icon: '🏦', label: 'Sổ tiền gửi NH', to: '/accounting/bank-ledger' },
      { icon: '🔄', label: 'Đối soát ngân hàng', to: '/accounting/bank-reconciliation' },
      { icon: '📋', label: 'Khế ước đi vay',     to: '/accounting/khe-uoc-vay' },
      { icon: '💼', label: 'Khế ước cho vay',    to: '/accounting/khe-uoc-cho-vay' },
      { icon: '📈', label: 'Dự báo dòng tiền',   to: '/accounting/du-bao-dong-tien' },
    ],
  },
  {
    title: 'Công nợ',
    items: [
      { icon: '📈', label: 'Sổ CN phải thu', to: '/accounting/ar-ledger' },
      { icon: '📉', label: 'Sổ CN phải trả', to: '/accounting/ap-ledger' },
      { icon: '🔍', label: 'Đối soát CN KH', to: '/accounting/ar-reconciliation' },
      { icon: '🔍', label: 'Đối chiếu CN NCC', to: '/accounting/ap-reconciliation' },
      { icon: '↩️', label: 'Hoàn tiền trả hàng', to: '/accounting/customer-refunds' },
      { icon: '✏️', label: 'Duyệt điều chỉnh HĐ', to: '/billing/adjustments' },
    ],
  },
  {
    title: 'Sổ sách & Bút toán',
    items: [
      { icon: '📝', label: 'Bút toán tổng hợp', to: '/accounting/journal-entries' },
      { icon: '📖', label: 'Sổ cái tài khoản', to: '/accounting/general-ledger' },
      { icon: '⚖️', label: 'Cân đối phát sinh', to: '/accounting/trial-balance' },
      { icon: '🔏', label: 'Nhật ký audit', to: '/accounting/audit-logs', permissions: ['accounting.view'] },
    ],
  },
  {
    title: 'Hóa đơn & Thuế',
    items: [
      { icon: '🧾', label: 'Hóa đơn điện tử', to: '/accounting/hoa-don-dien-tu' },
      { icon: '🛒', label: 'Hóa đơn mua hàng', to: '/accounting/purchase-invoices' },
      { icon: '💹', label: 'Giá thành sản phẩm', to: '/accounting/reports/production-costing' },
    ],
  },
  {
    title: 'Báo cáo tài chính',
    items: [
      { icon: '📊', label: 'Báo cáo lãi/lỗ', to: '/accounting/profit-loss' },
      { icon: '🏛️', label: 'Bảng cân đối kế toán', to: '/accounting/balance-sheet' },
    ],
  },
  {
    title: 'Quản lý kỳ kế toán',
    items: [
      { icon: '🔐', label: 'Khóa sổ kỳ kế toán', to: '/accounting/period-closing', permissions: ['accounting.manage'] },
      { icon: '📥', label: 'Số dư đầu kỳ', to: '/accounting/opening-balances', permissions: ['accounting.import'] },
    ],
  },
  {
    title: 'Tài sản',
    items: [
      { icon: '🖥️', label: 'Tài sản & CCDC', to: '/accounting/ccdc' },
      { icon: '🏗️', label: 'Tài sản cố định', to: '/fixed-assets' },
    ],
  },
  {
    title: 'Lương & Xưởng',
    items: [
      { icon: '👔', label: 'Quản trị xưởng (Lương)', to: '/accounting/workshop-management', permissions: ['accounting.workshop_mgmt', 'accounting.view'] },
    ],
  },
]

export default function AccountingHubPage() {
  return <ModuleHub title="Kế toán — Tài chính" accentColor="#6a1b9a" groups={GROUPS} />
}
