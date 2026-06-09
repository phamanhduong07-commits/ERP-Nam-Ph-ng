import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Modal } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { usePermission } from '../hooks/usePermission'

type SearchItem = {
  label: string
  to: string
  module: string
  permissions?: string[]
}

const INDEX: SearchItem[] = [
  { label: 'Tổng quan', to: '/dashboard', module: 'Dashboard' },
  // Bán hàng
  { label: 'Báo giá', to: '/quotes', module: 'Bán hàng', permissions: ['sales_order.approve'] },
  { label: 'Đơn hàng', to: '/sales/orders', module: 'Bán hàng', permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'] },
  { label: 'Trả hàng bán', to: '/sales/returns', module: 'Bán hàng', permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'] },
  { label: 'Theo dõi đơn hàng', to: '/sales/theo-don-hang', module: 'Bán hàng', permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'] },
  { label: 'Giao hàng', to: '/sales/giao-hang', module: 'Bán hàng', permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'] },
  { label: 'Hóa đơn VAT', to: '/billing/invoices', module: 'Bán hàng', permissions: ['sales_order.view', 'sales_order.create', 'sales_order.edit', 'sales_order.approve'] },
  // Sản xuất
  { label: 'Lệnh sản xuất', to: '/production/orders', module: 'Sản xuất' },
  { label: 'Theo dõi LSX', to: '/production/theo-doi', module: 'Sản xuất' },
  { label: 'Kế hoạch sản xuất', to: '/production/plans', module: 'Sản xuất' },
  { label: 'Kế hoạch tận dụng', to: '/production/tan-dung', module: 'Sản xuất' },
  { label: 'KH SX chờ', to: '/production/queue', module: 'Sản xuất' },
  { label: 'Định mức (BOM)', to: '/production/bom', module: 'Sản xuất' },
  { label: 'Phân tích chi phí', to: '/production/cost-analysis', module: 'Sản xuất', permissions: ['production.cost_analysis'] },
  { label: 'Kho phôi sóng', to: '/production/kho-phoi', module: 'Sản xuất' },
  { label: 'Kho thành phẩm', to: '/production/kho-thanh-pham', module: 'Sản xuất' },
  { label: 'Kho hàng lỗi', to: '/production/kho-loi', module: 'Sản xuất' },
  { label: 'Dashboard CD2', to: '/production/cd2/dashboard', module: 'Sản xuất - CD2' },
  { label: 'Kanban máy in', to: '/production/cd2', module: 'Sản xuất - CD2' },
  { label: 'Queue máy in', to: '/production/cd2/may-in', module: 'Sản xuất - CD2' },
  { label: 'Thống kê sản lượng', to: '/production/cd2/history', module: 'Sản xuất - CD2' },
  { label: 'Quản lý ca', to: '/production/cd2/shift', module: 'Sản xuất - CD2' },
  // Kho
  { label: 'Kho theo xưởng', to: '/warehouse/theo-xuong', module: 'Kho' },
  { label: 'Tồn kho', to: '/warehouse/inventory', module: 'Kho' },
  { label: 'Nhập giấy cuộn', to: '/warehouse/nhap-giay', module: 'Kho' },
  { label: 'Nhập NVL khác', to: '/warehouse/receipts', module: 'Kho' },
  { label: 'Xuất NVL sản xuất', to: '/warehouse/issues', module: 'Kho' },
  { label: 'Nhập TP từ SX', to: '/warehouse/production-output', module: 'Kho' },
  { label: 'Chuyển kho', to: '/warehouse/transfers', module: 'Kho' },
  { label: 'Kiểm kê / điều chỉnh', to: '/warehouse/stock-adjustments', module: 'Kho' },
  { label: 'Thẻ kho', to: '/warehouse/the-kho', module: 'Kho' },
  { label: 'Kho giấy cuộn', to: '/warehouse/kho-giay-cuon', module: 'Kho' },
  // Mua hàng
  { label: 'Dự báo nhu cầu', to: '/purchasing/du-bao-nhu-cau', module: 'Mua hàng' },
  { label: 'Yêu cầu mua hàng', to: '/purchasing/ymh', module: 'Mua hàng' },
  { label: 'Mua giấy', to: '/purchasing/giay-cuon', module: 'Mua hàng' },
  { label: 'Mua NVL khác', to: '/purchasing/nvl-khac', module: 'Mua hàng' },
  { label: 'Đơn mua hàng (PO)', to: '/purchasing/orders', module: 'Mua hàng' },
  { label: 'Phiếu nhập kho (GR)', to: '/purchasing/goods-receipts', module: 'Mua hàng' },
  { label: 'Hóa đơn mua hàng', to: '/accounting/purchase-invoices', module: 'Mua hàng' },
  { label: 'Trả hàng NCC', to: '/purchasing/returns', module: 'Mua hàng' },
  // Kế toán
  { label: 'Phiếu thu', to: '/accounting/receipts', module: 'Kế toán' },
  { label: 'Phiếu chi', to: '/accounting/payments', module: 'Kế toán' },
  { label: 'Sổ quỹ tiền mặt', to: '/accounting/cash-book', module: 'Kế toán' },
  { label: 'Sổ tiền gửi ngân hàng', to: '/accounting/bank-ledger', module: 'Kế toán' },
  { label: 'Đối chiếu ngân hàng', to: '/accounting/bank-reconciliation', module: 'Kế toán' },
  { label: 'Công nợ phải thu (AR)', to: '/accounting/ar-ledger', module: 'Kế toán' },
  { label: 'Công nợ phải trả (AP)', to: '/accounting/ap-ledger', module: 'Kế toán' },
  { label: 'Đối chiếu KH', to: '/accounting/ar-reconciliation', module: 'Kế toán' },
  { label: 'Đối chiếu NCC', to: '/accounting/ap-reconciliation', module: 'Kế toán' },
  { label: 'Sổ cái', to: '/accounting/general-ledger', module: 'Kế toán' },
  { label: 'Cân đối thử', to: '/accounting/trial-balance', module: 'Kế toán' },
  { label: 'Bút toán thủ công', to: '/accounting/journal-entries', module: 'Kế toán' },
  { label: 'Lợi nhuận & Lỗ', to: '/accounting/profit-loss', module: 'Kế toán' },
  { label: 'Bảng cân đối kế toán', to: '/accounting/balance-sheet', module: 'Kế toán' },
  { label: 'Đóng kỳ', to: '/accounting/period-closing', module: 'Kế toán' },
  { label: 'Số dư đầu kỳ', to: '/accounting/opening-balances', module: 'Kế toán' },
  { label: 'Hoàn tiền khách hàng', to: '/accounting/customer-refunds', module: 'Kế toán' },
  { label: 'Hóa đơn điện tử', to: '/accounting/hoa-don-dien-tu', module: 'Kế toán' },
  // HR
  { label: 'Nhân viên', to: '/hr/employees', module: 'HR' },
  { label: 'Chấm công', to: '/hr/attendance', module: 'HR' },
  { label: 'Phòng ban', to: '/hr/departments', module: 'HR' },
  { label: 'Bảng lương', to: '/hr/payroll', module: 'HR' },
  { label: 'Cấu hình lương', to: '/hr/payroll-config', module: 'HR' },
  { label: 'Phê duyệt nghỉ phép', to: '/hr/approvals', module: 'HR' },
  { label: 'Khen thưởng - Kỷ luật', to: '/hr/rewards', module: 'HR' },
  { label: 'Cổng nhân viên', to: '/hr/me', module: 'HR' },
  // Logistics
  { label: 'GPS tracking', to: '/logistics/gps-tracking', module: 'Logistics' },
  { label: 'Chi phí chuyến xe', to: '/logistics/chi-phi-chuyen', module: 'Logistics' },
  { label: 'Km thực tế', to: '/logistics/km-thuc-te', module: 'Logistics' },
  { label: 'Đối soát xăng', to: '/logistics/doi-soat-xang', module: 'Logistics' },
  { label: 'Nhật ký xe', to: '/logistics/nhat-ky-xe', module: 'Logistics' },
  // Báo cáo
  { label: 'Tổng hợp công nợ', to: '/reports/debt-summary', module: 'Báo cáo', permissions: ['report.cong_no'] },
  { label: 'Doanh thu', to: '/reports/revenue', module: 'Báo cáo', permissions: ['report.export'] },
  { label: 'Tồn kho (BC)', to: '/reports/inventory', module: 'Báo cáo', permissions: ['report.inventory'] },
  { label: 'Hiệu suất sản xuất', to: '/reports/production-performance', module: 'Báo cáo', permissions: ['report.view'] },
  { label: 'Tiến độ đơn hàng', to: '/reports/order-progress', module: 'Báo cáo', permissions: ['report.view'] },
  { label: 'Báo cáo giao hàng', to: '/reports/delivery', module: 'Báo cáo', permissions: ['report.export'] },
  { label: 'Tổng hợp VAT', to: '/reports/vat-summary', module: 'Báo cáo', permissions: ['accounting.view'] },
  { label: 'Cân đối thuế', to: '/reports/tax-trial-balance', module: 'Báo cáo', permissions: ['accounting.view'] },
  // Danh mục
  { label: 'Khách hàng', to: '/master/customers', module: 'Danh mục', permissions: ['master.customers.view', 'master.customers.manage', 'customer.view'] },
  { label: 'Nhà cung cấp', to: '/master/suppliers', module: 'Danh mục' },
  { label: 'Sản phẩm', to: '/master/products', module: 'Danh mục' },
  { label: 'Người dùng', to: '/master/users', module: 'Danh mục' },
  { label: 'Phân xưởng', to: '/master/phan-xuong', module: 'Danh mục' },
  { label: 'Pháp nhân', to: '/danhmuc/phap-nhan', module: 'Danh mục' },
  { label: 'Kho (danh mục)', to: '/master/warehouses', module: 'Danh mục' },
  { label: 'Template in', to: '/master/print-templates', module: 'Danh mục' },
]

type Props = {
  open: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<{ focus?: () => void } | null>(null)
  const { hasAnyPermission, isAdmin } = usePermission()

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => {
        inputRef.current?.focus?.()
      }, 80)
    }
  }, [open])

  const allowed = INDEX.filter(item =>
    !item.permissions || isAdmin || hasAnyPermission(item.permissions)
  )

  const results = query.trim().length < 1
    ? allowed.slice(0, 12)
    : allowed.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.module.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)

  function handleSelect(to: string) {
    navigate(to)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      closable={false}
      styles={{ body: { padding: 0 } }}
      style={{ top: '18vh' }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e7e9f2' }}>
        <Input
          ref={inputRef as never}
          prefix={<SearchOutlined style={{ color: '#8c8fa3' }} />}
          placeholder="Tìm kiếm màn hình, chức năng... (Ctrl+K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          size="large"
          bordered={false}
          style={{ fontSize: 15 }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0].to)
          }}
          autoComplete="off"
        />
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
        {results.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: '#8c8fa3', fontSize: 13 }}>
            Không tìm thấy kết quả
          </div>
        ) : (
          results.map(item => (
            <div
              key={item.to}
              onClick={() => handleSelect(item.to)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 16px', cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f7ff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 13.5, color: '#20233a', fontWeight: 500 }}>{item.label}</span>
              <span style={{
                fontSize: 11, color: '#8c8fa3', background: '#f0f2f7',
                padding: '2px 8px', borderRadius: 10, flexShrink: 0, marginLeft: 12,
              }}>{item.module}</span>
            </div>
          ))
        )}
      </div>

      <div style={{
        padding: '8px 16px', borderTop: '1px solid #e7e9f2',
        display: 'flex', gap: 16, fontSize: 11, color: '#8c8fa3',
      }}>
        <span>↵ mở</span>
        <span>Esc đóng</span>
        <span style={{ marginLeft: 'auto' }}>Ctrl+K</span>
      </div>
    </Modal>
  )
}
