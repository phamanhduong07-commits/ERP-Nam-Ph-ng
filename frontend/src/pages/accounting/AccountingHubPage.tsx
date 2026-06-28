import ModuleHub from '../../components/ModuleHub'
import type { HubGroup } from '../../components/ModuleHub'

const GROUPS: HubGroup[] = [
  {
    title: 'Quỹ & Ngân hàng',
    items: [
      { icon: '💵', label: 'Phiếu thu',         to: '/accounting/receipts',              permissions: ['accounting.receipts'] },
      { icon: '💸', label: 'Phiếu chi',          to: '/accounting/payments',              permissions: ['accounting.payments'] },
      { icon: '📒', label: 'Sổ quỹ tiền mặt',   to: '/accounting/cash-book',             permissions: ['accounting.cash_book'] },
      { icon: '🏦', label: 'Sổ tiền gửi NH',     to: '/accounting/bank-ledger',           permissions: ['accounting.bank_ledger'] },
      { icon: '🔄', label: 'Đối soát ngân hàng', to: '/accounting/bank-reconciliation',   permissions: ['accounting.bank_ledger'] },
      { icon: '📋', label: 'Khế ước đi vay',     to: '/accounting/khe-uoc-vay',           permissions: ['accounting.manage'] },
      { icon: '💼', label: 'Khế ước cho vay',    to: '/accounting/khe-uoc-cho-vay',       permissions: ['accounting.manage'] },
      { icon: '📈', label: 'Dự báo dòng tiền',   to: '/accounting/du-bao-dong-tien',      permissions: ['accounting.manage'] },
    ],
  },
  {
    title: 'Công nợ',
    items: [
      { icon: '📈', label: 'Sổ CN phải thu',       to: '/accounting/ar-ledger',          permissions: ['accounting.ar_ledger'] },
      { icon: '📉', label: 'Sổ CN phải trả',       to: '/accounting/ap-ledger',          permissions: ['accounting.ap_ledger'] },
      { icon: '🔍', label: 'Đối soát CN KH',        to: '/accounting/ar-reconciliation',  permissions: ['accounting.ar_ledger'] },
      { icon: '🔍', label: 'Đối chiếu CN NCC',      to: '/accounting/ap-reconciliation',  permissions: ['accounting.ap_ledger'] },
      { icon: '↩️', label: 'Hoàn tiền trả hàng',   to: '/accounting/customer-refunds',   permissions: ['accounting.manage'] },
      { icon: '✏️', label: 'Duyệt điều chỉnh HĐ',  to: '/billing/adjustments',           permissions: ['accounting.manage'] },
    ],
  },
  {
    title: 'Sổ sách & Bút toán',
    items: [
      { icon: '📝', label: 'Bút toán tổng hợp', to: '/accounting/journal-entries',  permissions: ['accounting.journal'] },
      { icon: '📖', label: 'Sổ cái tài khoản',  to: '/accounting/general-ledger',   permissions: ['accounting.general_ledger'] },
      { icon: '⚖️', label: 'Cân đối phát sinh',  to: '/accounting/trial-balance',    permissions: ['accounting.general_ledger', 'accounting.journal'] },
      { icon: '🔏', label: 'Nhật ký audit',      to: '/accounting/audit-logs',       permissions: ['accounting.import', 'accounting.manage'] },
    ],
  },
  {
    title: 'Hóa đơn & Thuế',
    items: [
      { icon: '🧾', label: 'Hóa đơn điện tử',    to: '/accounting/hoa-don-dien-tu',               permissions: ['accounting.hoa_don_dien_tu', 'accounting.manage'] },
      { icon: '🛒', label: 'Hóa đơn mua hàng',   to: '/accounting/purchase-invoices',             permissions: ['accounting.manage'] },
      { icon: '💹', label: 'Giá thành sản phẩm',  to: '/accounting/reports/production-costing',    permissions: ['accounting.manage', 'report.phoi_thanh_pham'] },
    ],
  },
  {
    title: 'Báo cáo tài chính',
    items: [
      { icon: '📊', label: 'Báo cáo lãi/lỗ',          to: '/accounting/profit-loss',   permissions: ['accounting.manage'] },
      { icon: '🏛️', label: 'Bảng cân đối kế toán',    to: '/accounting/balance-sheet', permissions: ['accounting.manage'] },
    ],
  },
  {
    title: 'Quản lý kỳ kế toán',
    items: [
      { icon: '🔐', label: 'Khóa sổ kỳ kế toán', to: '/accounting/period-closing',    permissions: ['accounting.manage'] },
      { icon: '📥', label: 'Số dư đầu kỳ',        to: '/accounting/opening-balances', permissions: ['accounting.import'] },
    ],
  },
  {
    title: 'Tài sản',
    items: [
      { icon: '🖥️', label: 'Tài sản & CCDC',   to: '/accounting/ccdc',  permissions: ['accounting.ccdc'] },
      { icon: '🏗️', label: 'Tài sản cố định',  to: '/fixed-assets',     permissions: ['accounting.ccdc', 'accounting.manage'] },
    ],
  },
  {
    title: 'Lương & Xưởng',
    items: [
      { icon: '👔', label: 'Quản trị xưởng (Lương)', to: '/accounting/workshop-management', permissions: ['accounting.workshop_mgmt'] },
    ],
  },
]

export default function AccountingHubPage() {
  return <ModuleHub title="Kế toán — Tài chính" accentColor="#6a1b9a" groups={GROUPS} />
}
