import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/auth'
import AppLayout from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const OrderCreate = lazy(() => import('./pages/sales/OrderCreate'))
const OrderDetail = lazy(() => import('./pages/sales/OrderDetail'))
const OrderDiscountUpdate = lazy(() => import('./pages/sales/OrderDiscountUpdate'))
const SalesOrdersPage = lazy(() => import('./pages/sales/SalesOrdersPage'))
const SalesReturnsPage = lazy(() => import('./pages/sales/SalesReturnsPage'))
const SalesReturnCreate = lazy(() => import('./pages/sales/SalesReturnCreate'))
const SalesReturnDetail = lazy(() => import('./pages/sales/SalesReturnDetail'))
const QuoteForm = lazy(() => import('./pages/quotes/QuoteForm'))
const QuoteDetail = lazy(() => import('./pages/quotes/QuoteDetail'))
const QuotesPage = lazy(() => import('./pages/quotes/QuotesPage'))
const CauTrucList = lazy(() => import('./pages/danhmuc/CauTrucList'))
const CustomerList = lazy(() => import('./pages/danhmuc/CustomerList'))
const SupplierList = lazy(() => import('./pages/danhmuc/SupplierList'))
const MaterialGroupList = lazy(() => import('./pages/danhmuc/MaterialGroupList'))
const PaperMaterialList = lazy(() => import('./pages/danhmuc/PaperMaterialList'))
const OtherMaterialList = lazy(() => import('./pages/danhmuc/OtherMaterialList'))
const WarehouseList = lazy(() => import('./pages/danhmuc/WarehouseList'))
const ProductList = lazy(() => import('./pages/danhmuc/ProductList'))
const UserList = lazy(() => import('./pages/danhmuc/UserList'))
const DvtList = lazy(() => import('./pages/danhmuc/DvtList'))
const ViTriList = lazy(() => import('./pages/danhmuc/ViTriList'))
const XeList = lazy(() => import('./pages/danhmuc/XeList'))
const TaiXeList = lazy(() => import('./pages/danhmuc/TaiXeList'))
const TinhThanhList = lazy(() => import('./pages/danhmuc/TinhThanhList'))
const PhuongXaList = lazy(() => import('./pages/danhmuc/PhuongXaList'))
const DonGiaVanChuyenList = lazy(() => import('./pages/danhmuc/DonGiaVanChuyenList'))
const ProductionOrderCreate = lazy(() => import('./pages/production/ProductionOrderCreate'))
const ProductionOrderDetail = lazy(() => import('./pages/production/ProductionOrderDetail'))
const ProductionOrdersPage = lazy(() => import('./pages/production/ProductionOrdersPage'))
const ProductionPlansPage = lazy(() => import('./pages/production/ProductionPlansPage'))
const ProductionPlanForm = lazy(() => import('./pages/production/ProductionPlanForm'))
const ProductionQueuePage = lazy(() => import('./pages/production/ProductionQueuePage'))
const IndirectCostList = lazy(() => import('./pages/danhmuc/IndirectCostList'))
const AddonRateList = lazy(() => import('./pages/danhmuc/AddonRateList'))
const BomListPage = lazy(() => import('./pages/production/BomListPage'))
const PhieuPhoiPage = lazy(() => import('./pages/production/PhieuPhoiPage'))
const KhoPhoiPage = lazy(() => import('./pages/production/KhoPhoiPage'))
const KhoThanhPhamPage = lazy(() => import('./pages/production/KhoThanhPhamPage'))
const PhieuNhapPhoiSongPage = lazy(() => import('./pages/production/PhieuNhapPhoiSongPage'))
const CD2KanbanPage = lazy(() => import('./pages/production/CD2KanbanPage'))
const ScanMayPage = lazy(() => import('./pages/production/ScanMayPage'))
const ScanHistoryPage = lazy(() => import('./pages/production/ScanHistoryPage'))
const CD2DashboardPage = lazy(() => import('./pages/production/CD2DashboardPage'))
const PhieuInHistoryPage = lazy(() => import('./pages/production/PhieuInHistoryPage'))
const MayInQueuePage = lazy(() => import('./pages/production/MayInQueuePage'))
const DinhHinhPage = lazy(() => import('./pages/production/DinhHinhPage'))
const SauInKanbanPage = lazy(() => import('./pages/production/SauInKanbanPage'))
const ShiftPage = lazy(() => import('./pages/production/ShiftPage'))
const ConfigPage = lazy(() => import('./pages/production/ConfigPage'))
const InventoryPage = lazy(() => import('./pages/warehouse/InventoryPage'))
const KhoNVLPage = lazy(() => import('./pages/warehouse/KhoNVLPage'))
const KhoTheoXuongPage = lazy(() => import('./pages/warehouse/KhoTheoXuongPage'))
const ReceiptsPage = lazy(() => import('./pages/warehouse/ReceiptsPage'))
const IssuesPage = lazy(() => import('./pages/warehouse/IssuesPage'))
const TransfersPage = lazy(() => import('./pages/warehouse/TransfersPage'))
const StockAdjustmentsPage = lazy(() => import('./pages/warehouse/StockAdjustmentsPage'))
const InventoryCardPage = lazy(() => import('./pages/warehouse/InventoryCardPage'))
const ProductionOutputPage = lazy(() => import('./pages/warehouse/ProductionOutputPage'))
const DeliveryPage = lazy(() => import('./pages/warehouse/DeliveryPage'))
const TheoDonHangPage = lazy(() => import('./pages/sales/TheoDonHangPage'))
const GiaoHangPage = lazy(() => import('./pages/sales/GiaoHangPage'))
const POListPage = lazy(() => import('./pages/purchase/POListPage'))
const PurchaseReturnPage = lazy(() => import('./pages/purchase/PurchaseReturnPage'))
const PurchaseReportPage = lazy(() => import('./pages/purchase/PurchaseReportPage'))
const PhapNhanList = lazy(() => import('./pages/danhmuc/PhapNhanList'))
const PhanXuongList = lazy(() => import('./pages/danhmuc/PhanXuongList'))
const RolePermissionsPage = lazy(() => import('./pages/danhmuc/RolePermissionsPage'))
// Billing
const SalesInvoiceListPage = lazy(() => import('./pages/billing/SalesInvoiceListPage'))
const SalesInvoiceDetailPage = lazy(() => import('./pages/billing/SalesInvoiceDetailPage'))
const SalesInvoiceForm = lazy(() => import('./pages/billing/SalesInvoiceForm'))
// Agent
const AgentPage = lazy(() => import('./pages/agent/AgentPage'))
// Accounting
const CashReceiptListPage = lazy(() => import('./pages/accounting/CashReceiptListPage'))
const CashReceiptDetailPage = lazy(() => import('./pages/accounting/CashReceiptDetailPage'))
const CashReceiptForm = lazy(() => import('./pages/accounting/CashReceiptForm'))
const CashPaymentListPage = lazy(() => import('./pages/accounting/CashPaymentListPage'))
const CashPaymentDetailPage = lazy(() => import('./pages/accounting/CashPaymentDetailPage'))
const CashPaymentForm = lazy(() => import('./pages/accounting/CashPaymentForm'))
const PurchaseInvoiceListPage = lazy(() => import('./pages/accounting/PurchaseInvoiceListPage'))
const PurchaseInvoiceDetailPage = lazy(() => import('./pages/accounting/PurchaseInvoiceDetailPage'))
const ARLedgerPage = lazy(() => import('./pages/accounting/ARLedgerPage'))
const APLedgerPage = lazy(() => import('./pages/accounting/APLedgerPage'))
const CashBookPage = lazy(() => import('./pages/accounting/CashBookPage'))
const BankLedgerPage = lazy(() => import('./pages/accounting/BankLedgerPage'))
const CCDCListPage = lazy(() => import('./pages/accounting/CCDCListPage'))
const BankAccountList = lazy(() => import('./pages/danhmuc/BankAccountList'))
// Reports
const DebtSummaryPage = lazy(() => import('./pages/reports/DebtSummaryPage'))
const RevenueReportPage = lazy(() => import('./pages/reports/RevenueReportPage'))
const InventoryReportPage = lazy(() => import('./pages/reports/InventoryReportPage'))
const ProductionPerformancePage = lazy(() => import('./pages/reports/ProductionPerformancePage'))
const OrderProgressPage = lazy(() => import('./pages/reports/OrderProgressPage'))
const DeliveryReportPage = lazy(() => import('./pages/reports/DeliveryReportPage'))
const ImportHistoryPage = lazy(() => import('./pages/reports/ImportHistoryPage'))
// Customer Refunds
const CustomerRefundListPage = lazy(() => import('./pages/accounting/CustomerRefundListPage'))
const CustomerRefundDetailPage = lazy(() => import('./pages/accounting/CustomerRefundDetailPage'))
const CustomerReconciliation = lazy(() => import('./pages/accounting/CustomerReconciliation'))
const SupplierReconciliation = lazy(() => import('./pages/accounting/SupplierReconciliation'))
const GeneralLedgerPage = lazy(() => import('./pages/accounting/GeneralLedgerPage'))
const TrialBalancePage = lazy(() => import('./pages/accounting/TrialBalancePage'))
const WorkshopManagement = lazy(() => import('./pages/accounting/WorkshopManagement'))
const JournalEntryListPage = lazy(() => import('./pages/accounting/JournalEntryListPage'))
const JournalEntryForm = lazy(() => import('./pages/accounting/JournalEntryForm'))

// Reports - Workshop
const WorkshopPNLPage = lazy(() => import('./pages/reports/WorkshopPNLPage'))
const LegalEntityCashflowPage = lazy(() => import('./pages/reports/LegalEntityCashflowPage'))
const VATSummaryPage = lazy(() => import('./pages/reports/VATSummaryPage'))
const TaxTrialBalancePage = lazy(() => import('./pages/reports/TaxTrialBalancePage'))
const ProductionCostingPage = lazy(() => import('./pages/reports/ProductionCostingPage'))
const ReportingHubPage = lazy(() => import('./pages/reports/ReportingHubPage'))




function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Đang tải...</div>}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Bán hàng — master-detail list + standalone routes */}
        <Route path="sales/orders" element={<ErrorBoundary><SalesOrdersPage /></ErrorBoundary>} />
        <Route path="sales/orders/new" element={<ErrorBoundary><OrderCreate /></ErrorBoundary>} />
        <Route path="sales/orders/:id" element={<ErrorBoundary><OrderDetail /></ErrorBoundary>} />
        <Route path="sales/orders/:id/discount" element={<ErrorBoundary><OrderDiscountUpdate /></ErrorBoundary>} />

        {/* Trả lại hàng bán */}
        <Route path="sales/returns" element={<ErrorBoundary><SalesReturnsPage /></ErrorBoundary>} />
        <Route path="sales/returns/create" element={<ErrorBoundary><SalesReturnCreate /></ErrorBoundary>} />
        <Route path="sales/returns/:id" element={<ErrorBoundary><SalesReturnDetail /></ErrorBoundary>} />

        {/* Báo giá — master-detail list + standalone routes */}
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/new" element={<ErrorBoundary><QuoteForm /></ErrorBoundary>} />
        <Route path="quotes/:id" element={<ErrorBoundary><QuoteDetail /></ErrorBoundary>} />
        <Route path="quotes/:id/edit" element={<ErrorBoundary><QuoteForm /></ErrorBoundary>} />

        {/* Danh mục */}
        <Route path="danhmuc/cau-truc" element={<CauTrucList />} />
        <Route path="master/customers" element={<CustomerList />} />
        <Route path="master/suppliers" element={<SupplierList />} />
        <Route path="master/material-groups" element={<MaterialGroupList />} />
        <Route path="master/paper-materials" element={<PaperMaterialList />} />
        <Route path="master/other-materials" element={<OtherMaterialList />} />
        <Route path="master/warehouses" element={<WarehouseList />} />
        <Route path="master/products" element={<ProductList />} />
        <Route path="master/users" element={<UserList />} />
        <Route path="master/roles" element={<RolePermissionsPage />} />
        <Route path="master/don-vi-tinh" element={<DvtList />} />
        <Route path="master/vi-tri" element={<ViTriList />} />
        <Route path="master/xe" element={<XeList />} />
        <Route path="master/tai-xe" element={<TaiXeList />} />
        <Route path="master/tinh-thanh" element={<TinhThanhList />} />
        <Route path="master/phuong-xa" element={<PhuongXaList />} />
        <Route path="master/don-gia-van-chuyen" element={<DonGiaVanChuyenList />} />

        {/* Sản xuất — master-detail list + standalone routes */}
        <Route path="production/orders" element={<ProductionOrdersPage />} />
        <Route path="production/orders/new" element={<ProductionOrderCreate />} />
        <Route path="production/orders/:id" element={<ProductionOrderDetail />} />

        {/* Kế hoạch sản xuất */}
        <Route path="production/plans" element={<ProductionPlansPage />} />
        <Route path="production/plans/new" element={<ProductionPlanForm />} />
        <Route path="production/queue" element={<ProductionQueuePage />} />

        {/* Định mức BOM */}
        <Route path="production/bom" element={<BomListPage />} />

        {/* Phiếu phôi sóng */}
        <Route path="production/phieu-phoi" element={<PhieuPhoiPage />} />
        <Route path="sales/theo-don-hang" element={<TheoDonHangPage />} />
        <Route path="sales/giao-hang" element={<GiaoHangPage />} />
        <Route path="production/phieu-nhap-phoi" element={<PhieuNhapPhoiSongPage />} />
        <Route path="production/kho-phoi" element={<KhoPhoiPage />} />
        <Route path="production/kho-thanh-pham" element={<ErrorBoundary><KhoThanhPhamPage /></ErrorBoundary>} />

        {/* Công Đoạn 2 */}
        <Route path="production/cd2" element={<CD2KanbanPage />} />
        <Route path="production/cd2/dashboard" element={<CD2DashboardPage />} />
        <Route path="production/cd2/may-in" element={<MayInQueuePage />} />
        <Route path="production/cd2/scan" element={<ScanMayPage />} />
        <Route path="production/cd2/scan-history" element={<ScanHistoryPage />} />
        <Route path="production/cd2/history" element={<PhieuInHistoryPage />} />
        <Route path="production/cd2/dhcho2" element={<DinhHinhPage />} />
        <Route path="production/cd2/sauin-kanban" element={<SauInKanbanPage />} />
        <Route path="production/cd2/shift" element={<ShiftPage />} />
        <Route path="production/cd2/config" element={<ConfigPage />} />

        {/* Kho */}
        <Route path="warehouse/kho-nvl" element={<ErrorBoundary><KhoNVLPage /></ErrorBoundary>} />
        <Route path="warehouse/kho-phoi" element={<KhoPhoiPage />} />
        <Route path="warehouse/kho-thanh-pham" element={<ErrorBoundary><KhoThanhPhamPage /></ErrorBoundary>} />
        <Route path="warehouse/theo-xuong" element={<KhoTheoXuongPage />} />
        <Route path="warehouse/inventory" element={<InventoryPage />} />
        <Route path="warehouse/receipts" element={<ReceiptsPage />} />
        <Route path="warehouse/issues" element={<IssuesPage />} />
        <Route path="warehouse/production-output" element={<ProductionOutputPage />} />
        <Route path="warehouse/delivery" element={<DeliveryPage />} />
        <Route path="warehouse/transfers" element={<TransfersPage />} />
        <Route path="warehouse/stock-adjustments" element={<StockAdjustmentsPage />} />
        <Route path="warehouse/the-kho" element={<InventoryCardPage />} />

        {/* Mua hàng */}
        <Route path="purchasing/orders" element={<POListPage />} />
        <Route path="purchasing/returns" element={<ErrorBoundary><PurchaseReturnPage /></ErrorBoundary>} />
        <Route path="purchasing/reports" element={<ErrorBoundary><PurchaseReportPage /></ErrorBoundary>} />

        {/* Pháp nhân */}
        <Route path="danhmuc/phap-nhan" element={<PhapNhanList />} />

        {/* Nơi sản xuất (Phân xưởng) */}
        <Route path="master/phan-xuong" element={<PhanXuongList />} />

        {/* BOM / Chi phí */}
        <Route path="master/indirect-costs" element={<IndirectCostList />} />
        <Route path="master/addon-rates" element={<AddonRateList />} />

        {/* Billing — Hóa đơn bán hàng */}
        <Route path="billing/invoices" element={<SalesInvoiceListPage />} />
        <Route path="billing/invoices/new" element={<SalesInvoiceForm />} />
        <Route path="billing/invoices/:id" element={<SalesInvoiceDetailPage />} />
        {/* Accounting — Phiếu thu */}
        <Route path="accounting/receipts" element={<CashReceiptListPage />} />
        <Route path="accounting/receipts/new" element={<CashReceiptForm />} />
        <Route path="accounting/receipts/:id" element={<CashReceiptDetailPage />} />
        {/* Accounting — Phiếu chi */}
        <Route path="accounting/payments" element={<CashPaymentListPage />} />
        <Route path="accounting/payments/new" element={<CashPaymentForm />} />
        <Route path="accounting/payments/:id" element={<CashPaymentDetailPage />} />
        {/* Accounting — Hóa đơn mua hàng */}
        <Route path="accounting/purchase-invoices" element={<PurchaseInvoiceListPage />} />
        <Route path="accounting/purchase-invoices/:id" element={<PurchaseInvoiceDetailPage />} />
        {/* Accounting — Sổ công nợ */}
        <Route path="accounting/ar-ledger" element={<ARLedgerPage />} />
        <Route path="accounting/ap-ledger" element={<APLedgerPage />} />
        {/* Accounting — Sổ quỹ / Sổ ngân hàng */}
        <Route path="accounting/cash-book" element={<CashBookPage />} />
        <Route path="accounting/bank-ledger" element={<BankLedgerPage />} />
        {/* CCDC */}
        <Route path="accounting/ccdc" element={<CCDCListPage />} />
        {/* Danh mục ngân hàng */}
        <Route path="master/bank-accounts" element={<BankAccountList />} />
        <Route path="accounting/ar-reconciliation" element={<ErrorBoundary><CustomerReconciliation /></ErrorBoundary>} />
        <Route path="accounting/ap-reconciliation" element={<ErrorBoundary><SupplierReconciliation /></ErrorBoundary>} />
        <Route path="accounting/general-ledger" element={<ErrorBoundary><GeneralLedgerPage /></ErrorBoundary>} />
        <Route path="accounting/trial-balance" element={<ErrorBoundary><TrialBalancePage /></ErrorBoundary>} />
        <Route path="accounting/workshop-management" element={<ErrorBoundary><WorkshopManagement /></ErrorBoundary>} />
        <Route path="accounting/journal-entries" element={<ErrorBoundary><JournalEntryListPage /></ErrorBoundary>} />
        <Route path="accounting/journal-entries/new" element={<ErrorBoundary><JournalEntryForm /></ErrorBoundary>} />




        {/* Accounting — Phiếu hoàn tiền KH */}
        <Route path="accounting/customer-refunds" element={<ErrorBoundary><CustomerRefundListPage /></ErrorBoundary>} />
        <Route path="accounting/customer-refunds/:id" element={<ErrorBoundary><CustomerRefundDetailPage /></ErrorBoundary>} />

        {/* Reports */}
        <Route path="reports/hub" element={<ErrorBoundary><ReportingHubPage /></ErrorBoundary>} />
        <Route path="reports/debt-summary" element={<ErrorBoundary><DebtSummaryPage /></ErrorBoundary>} />
        <Route path="reports/revenue" element={<ErrorBoundary><RevenueReportPage /></ErrorBoundary>} />
        <Route path="reports/inventory" element={<ErrorBoundary><InventoryReportPage /></ErrorBoundary>} />
        <Route path="reports/production-performance" element={<ErrorBoundary><ProductionPerformancePage /></ErrorBoundary>} />
        <Route path="reports/order-progress" element={<ErrorBoundary><OrderProgressPage /></ErrorBoundary>} />
        <Route path="reports/delivery" element={<ErrorBoundary><DeliveryReportPage /></ErrorBoundary>} />
        <Route path="reports/import-history" element={<ErrorBoundary><ImportHistoryPage /></ErrorBoundary>} />
        <Route path="reports/workshop-pnl" element={<ErrorBoundary><WorkshopPNLPage /></ErrorBoundary>} />
        <Route path="reports/cashflow" element={<ErrorBoundary><LegalEntityCashflowPage /></ErrorBoundary>} />
        <Route path="reports/vat-summary" element={<ErrorBoundary><VATSummaryPage /></ErrorBoundary>} />
        <Route path="reports/tax-trial-balance" element={<ErrorBoundary><TaxTrialBalancePage /></ErrorBoundary>} />
        <Route path="accounting/reports/production-costing" element={<ErrorBoundary><ProductionCostingPage /></ErrorBoundary>} />

        {/* Agent */}
        <Route path="agent" element={<ErrorBoundary><AgentPage /></ErrorBoundary>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      </Routes>
    </Suspense>
  )
}
