import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Spin } from 'antd'

interface BeforeInstallPromptEvent extends Event {
  prompt(): void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
import { useAuthStore } from './store/auth'
import AppLayout from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { storage } from './utils/storage'

const Login = lazy(() => import('./pages/Login'))
const GateLoginPage = lazy(() => import('./pages/warehouse/GateLoginPage'))
const GateHubPage = lazy(() => import('./pages/warehouse/GateHubPage'))
const GiaoHangMobilePage = lazy(() => import('./pages/warehouse/GiaoHangMobilePage'))
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
const TieuChuanKyThuatList = lazy(() => import('./pages/danhmuc/TieuChuanKyThuatList'))
const WarehouseList = lazy(() => import('./pages/danhmuc/WarehouseList'))
const ProductList = lazy(() => import('./pages/danhmuc/ProductList'))
const UserList = lazy(() => import('./pages/danhmuc/UserList'))
const DvtList = lazy(() => import('./pages/danhmuc/DvtList'))
const ViTriList = lazy(() => import('./pages/danhmuc/ViTriList'))
const XeList = lazy(() => import('./pages/danhmuc/XeList'))
const TaiXeList = lazy(() => import('./pages/danhmuc/TaiXeList'))
const LoXeList = lazy(() => import('./pages/danhmuc/LoXeList'))
const TinhThanhList = lazy(() => import('./pages/danhmuc/TinhThanhList'))
const PhuongXaList = lazy(() => import('./pages/danhmuc/PhuongXaList'))
const DonGiaVanChuyenList = lazy(() => import('./pages/danhmuc/DonGiaVanChuyenList'))
const ProductionOrderCreate = lazy(() => import('./pages/production/ProductionOrderCreate'))
const ProductionOrderDetail = lazy(() => import('./pages/production/ProductionOrderDetail'))
const ProductionOrdersPage = lazy(() => import('./pages/production/ProductionOrdersPage'))
const ProductionPlansPage = lazy(() => import('./pages/production/ProductionPlansPage'))
const TanDungPlanPage = lazy(() => import('./pages/production/TanDungPlanPage'))
const ProductionPlanForm = lazy(() => import('./pages/production/ProductionPlanForm'))
const ProductionQueuePage = lazy(() => import('./pages/production/ProductionQueuePage'))
const IndirectCostList = lazy(() => import('./pages/danhmuc/IndirectCostList'))
const AddonRateList = lazy(() => import('./pages/danhmuc/AddonRateList'))
const TemPaperPriceList = lazy(() => import('./pages/danhmuc/TemPaperPriceList'))
const OffsetAddonPriceList = lazy(() => import('./pages/danhmuc/OffsetAddonPriceList'))
const BomListPage = lazy(() => import('./pages/production/BomListPage'))
const CostAnalysisPage = lazy(() => import('./pages/production/CostAnalysisPage'))
const PhieuPhoiPage = lazy(() => import('./pages/production/PhieuPhoiPage'))
const PhieuTraHangPage = lazy(() => import('./pages/production/PhieuTraHangPage'))
const HauGiaoHangPage = lazy(() => import('./pages/production/HauGiaoHang'))
const KhoPhoiPage = lazy(() => import('./pages/production/KhoPhoiPage'))
const KhoThanhPhamPage = lazy(() => import('./pages/production/KhoThanhPhamPage'))
const KhoLoiPage = lazy(() => import('./pages/production/KhoLoiPage'))
const PhieuNhapPhoiSongPage = lazy(() => import('./pages/production/PhieuNhapPhoiSongPage'))
const CD2KanbanPage = lazy(() => import('./pages/production/CD2KanbanPage'))
const ScanMayPage = lazy(() => import('./pages/production/ScanMayPage'))
const ScanNhapKhoTPPage = lazy(() => import('./pages/production/ScanNhapKhoTPPage'))
const ScanHistoryPage = lazy(() => import('./pages/production/ScanHistoryPage'))
const CD2DashboardPage = lazy(() => import('./pages/production/CD2DashboardPage'))
const PhieuInHistoryPage = lazy(() => import('./pages/production/PhieuInHistoryPage'))
const MayInQueuePage = lazy(() => import('./pages/production/MayInQueuePage'))
const DinhHinhPage = lazy(() => import('./pages/production/DinhHinhPage'))
const SauInKanbanPage = lazy(() => import('./pages/production/SauInKanbanPage'))
const ShiftPage = lazy(() => import('./pages/production/ShiftPage'))
const LenhTheoDoiPage = lazy(() => import('./pages/production/LenhTheoDoiPage'))
const ConfigPage = lazy(() => import('./pages/production/ConfigPage'))
const MobileTrackingPage = lazy(() => import('./pages/production/MobileTrackingPage'))
const MachineLoginPage = lazy(() => import('./pages/production/MachineLoginPage'))
const CD2WorkerPage = lazy(() => import('./pages/production/CD2WorkerPage'))
const MaySongPage = lazy(() => import('./pages/production/MaySongPage'))
const InventoryPage = lazy(() => import('./pages/warehouse/InventoryPage'))
const KhoNVLPage = lazy(() => import('./pages/warehouse/KhoNVLPage'))
const KhoTheoXuongPage = lazy(() => import('./pages/warehouse/KhoTheoXuongPage'))
const ReceiptsPage = lazy(() => import('./pages/warehouse/ReceiptsPage'))
const NhapGiayPage = lazy(() => import('./pages/warehouse/NhapGiayPage'))
const KhoGiayCuonPage = lazy(() => import('./pages/warehouse/KhoGiayCuonPage'))
const CanCuonGiayPage = lazy(() => import('./pages/warehouse/CanCuonGiayPage'))
const KhoLoginPage = lazy(() => import('./pages/warehouse/KhoLoginPage'))
const OcrExamplesPage = lazy(() => import('./pages/warehouse/OcrExamplesPage'))
const NhapNhanhPage = lazy(() => import('./pages/warehouse/NhapNhanhPage'))
const NhapPhoiNgoaiPage = lazy(() => import('./pages/warehouse/NhapPhoiNgoaiPage'))
const IssuesPage = lazy(() => import('./pages/warehouse/IssuesPage'))
const TransfersPage = lazy(() => import('./pages/warehouse/TransfersPage'))
const StockAdjustmentsPage = lazy(() => import('./pages/warehouse/StockAdjustmentsPage'))
const TonDauKyPage = lazy(() => import('./pages/warehouse/TonDauKyPage'))
const SoNhapXuatTonPage = lazy(() => import('./pages/warehouse/SoNhapXuatTonPage'))
const DoiSoatCuonPage = lazy(() => import('./pages/warehouse/DoiSoatCuonPage'))
const InventoryCardPage = lazy(() => import('./pages/warehouse/InventoryCardPage'))
const ProductionOutputPage = lazy(() => import('./pages/warehouse/ProductionOutputPage'))
const ProductionSessionsPage = lazy(() => import('./pages/warehouse/ProductionSessionsPage'))
const ProductionSessionReportPage = lazy(() => import('./pages/warehouse/ProductionSessionReportPage'))
const TheoDonHangPage = lazy(() => import('./pages/sales/TheoDonHangPage'))
const GiaoHangPage = lazy(() => import('./pages/sales/GiaoHangPage'))
const POListPage = lazy(() => import('./pages/purchase/POListPage'))
const PurchaseReturnPage = lazy(() => import('./pages/purchase/PurchaseReturnPage'))
const PurchaseReportPage = lazy(() => import('./pages/purchase/PurchaseReportPage'))
const MuaGiayPage = lazy(() => import('./pages/purchase/MuaGiayPage'))
const MuaNVLPage = lazy(() => import('./pages/purchase/MuaNVLPage'))
const GoodsReceiptPage = lazy(() => import('./pages/purchase/GoodsReceiptPage'))
const DoiSoatKhoPage = lazy(() => import('./pages/purchase/DoiSoatKhoPage'))
const DuBaoNhuCauPage = lazy(() => import('./pages/purchase/DuBaoNhuCauPage'))
const YMHListPage = lazy(() => import('./pages/purchase/YMHListPage'))
const YMHDetailPage = lazy(() => import('./pages/purchase/YMHDetailPage'))
const PurchaseDashboardPage = lazy(() => import('./pages/purchase/PurchaseDashboardPage'))
const PurchaseHubPage = lazy(() => import('./pages/purchase/PurchaseHubPage'))
const DoiTruPage = lazy(() => import('./pages/purchase/DoiTruPage'))
const DoiTruNhieuPage = lazy(() => import('./pages/purchase/DoiTruNhieuPage'))
const BoDoiTruPage = lazy(() => import('./pages/purchase/BoDoiTruPage'))
const BoDoiTruNhieuPage = lazy(() => import('./pages/purchase/BoDoiTruNhieuPage'))
const BuTruCongNoPage = lazy(() => import('./pages/purchase/BuTruCongNoPage'))
const SoChiTietMuaHangPage = lazy(() => import('./pages/purchase/SoChiTietMuaHangPage'))
const ChiTietCongNoPhatTraPage = lazy(() => import('./pages/purchase/ChiTietCongNoPhatTraPage'))
const PhapNhanList = lazy(() => import('./pages/danhmuc/PhapNhanList'))
const PhanXuongList = lazy(() => import('./pages/danhmuc/PhanXuongList'))
const RolePermissionsPage = lazy(() => import('./pages/danhmuc/RolePermissionsPage'))
const DanhMucLanding = lazy(() => import('./pages/danhmuc/DanhMucLanding'))
const PhimTatPage = lazy(() => import('./pages/danhmuc/PhimTatPage'))
// Danh mục mới (kế toán, nhân sự, tài sản)
const DieuKhoanThanhToanList = lazy(() => import('./pages/danhmuc/DieuKhoanThanhToanList'))
const MucThuChiList = lazy(() => import('./pages/danhmuc/MucThuChiList'))
const KhoanMucChiPhiList = lazy(() => import('./pages/danhmuc/KhoanMucChiPhiList'))
const LoaiTaisanCoDinhList = lazy(() => import('./pages/danhmuc/LoaiTaisanCoDinhList'))
const KyHieuChamCongList = lazy(() => import('./pages/danhmuc/KyHieuChamCongList'))
const BieuThueThuNhapPage = lazy(() => import('./pages/danhmuc/BieuThueThuNhapPage'))
const NhomDoiTuongList = lazy(() => import('./pages/danhmuc/NhomDoiTuongList'))
const ChartOfAccountsPage = lazy(() => import('./pages/danhmuc/ChartOfAccountsPage'))
const TaiKhoanNgamDinhPage = lazy(() => import('./pages/danhmuc/TaiKhoanNgamDinhPage'))
const LoaiTienList = lazy(() => import('./pages/danhmuc/LoaiTienList'))
const NganHangList = lazy(() => import('./pages/danhmuc/NganHangList'))
// Billing
const SalesInvoiceListPage = lazy(() => import('./pages/billing/SalesInvoiceListPage'))
const SalesInvoiceDetailPage = lazy(() => import('./pages/billing/SalesInvoiceDetailPage'))
const SalesInvoiceForm = lazy(() => import('./pages/billing/SalesInvoiceForm'))
const InvoiceAdjustmentListPage = lazy(() => import('./pages/billing/InvoiceAdjustmentListPage'))
// Agent
const AgentPage = lazy(() => import('./pages/agent/AgentPage'))
// Accounting
const TienMatPage = lazy(() => import('./pages/accounting/TienMatPage'))
const NganHangPage = lazy(() => import('./pages/accounting/NganHangPage'))
const CashReceiptListPage = lazy(() => import('./pages/accounting/CashReceiptListPage'))
const CashReceiptDetailPage = lazy(() => import('./pages/accounting/CashReceiptDetailPage'))
const CashReceiptForm = lazy(() => import('./pages/accounting/CashReceiptForm'))
const CashReceiptBatchPage = lazy(() => import('./pages/accounting/CashReceiptBatchPage'))
const CashReceiptByInvoicePage = lazy(() => import('./pages/accounting/CashReceiptByInvoicePage'))
const InternalTransferListPage = lazy(() => import('./pages/accounting/InternalTransferListPage'))
const InternalTransferForm = lazy(() => import('./pages/accounting/InternalTransferForm'))
const InternalTransferDetailPage = lazy(() => import('./pages/accounting/InternalTransferDetailPage'))
const CashPaymentListPage = lazy(() => import('./pages/accounting/CashPaymentListPage'))
const CashPaymentDetailPage = lazy(() => import('./pages/accounting/CashPaymentDetailPage'))
const CashPaymentForm = lazy(() => import('./pages/accounting/CashPaymentForm'))
const TaxPaymentPage = lazy(() => import('./pages/accounting/TaxPaymentPage'))
const InsurancePaymentPage = lazy(() => import('./pages/accounting/InsurancePaymentPage'))
const SalaryPaymentPage = lazy(() => import('./pages/accounting/SalaryPaymentPage'))
const ExcelImportWizardPage = lazy(() => import('./pages/accounting/ExcelImportWizardPage'))
const PurchaseInvoiceListPage = lazy(() => import('./pages/accounting/PurchaseInvoiceListPage'))
const PurchaseInvoiceDetailPage = lazy(() => import('./pages/accounting/PurchaseInvoiceDetailPage'))
const IncomingInvoiceProcessingPage = lazy(() => import('./pages/accounting/IncomingInvoiceProcessingPage'))
const ARLedgerPage = lazy(() => import('./pages/accounting/ARLedgerPage'))
const APLedgerPage = lazy(() => import('./pages/accounting/APLedgerPage'))
const CashBookPage = lazy(() => import('./pages/accounting/CashBookPage'))
const BankLedgerPage = lazy(() => import('./pages/accounting/BankLedgerPage'))
const BankReconciliationPage = lazy(() => import('./pages/accounting/BankReconciliationPage'))
const KheUocVayPage = lazy(() => import('./pages/accounting/KheUocVayPage'))
const KheUocChoVayPage = lazy(() => import('./pages/accounting/KheUocChoVayPage'))
const DuBaoDongTienPage = lazy(() => import('./pages/accounting/DuBaoDongTienPage'))
const CCDCListPage = lazy(() => import('./pages/accounting/CCDCListPage'))
const BankAccountList = lazy(() => import('./pages/danhmuc/BankAccountList'))
// Quality
const QCListPage = lazy(() => import('./pages/quality/QCListPage'))
const QCGiayCuonPage = lazy(() => import('./pages/quality/QCGiayCuonPage'))
const QCNvlPage = lazy(() => import('./pages/quality/QCNvlPage'))
// Maintenance
const MaintenanceSchedulePage = lazy(() => import('./pages/maintenance/MaintenanceSchedulePage'))
const MaintenanceLogPage = lazy(() => import('./pages/maintenance/MaintenanceLogPage'))
// Fixed Assets
const FixedAssetPage = lazy(() => import('./pages/fixed_assets/FixedAssetPage'))
// Reports
const DebtSummaryPage = lazy(() => import('./pages/reports/DebtSummaryPage'))
const BaoCaoPhoiTpPage = lazy(() => import('./pages/reports/BaoCaoPhoiTpPage'))
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
const AccountingAuditPage = lazy(() => import('./pages/accounting/AccountingAuditPage'))
const ProfitLossPage = lazy(() => import('./pages/accounting/ProfitLossPage'))
const BalanceSheetPage = lazy(() => import('./pages/accounting/BalanceSheetPage'))
const PeriodClosingPage = lazy(() => import('./pages/accounting/PeriodClosingPage'))
const OpeningBalancePage = lazy(() => import('./pages/accounting/OpeningBalancePage'))
const HoaDonDienTuPage = lazy(() => import('./pages/accounting/HoaDonDienTuPage'))
// HR
const HRDashboardPage = lazy(() => import('./pages/hr/HRDashboardPage'))
const HealthCheckPage = lazy(() => import('./pages/hr/HealthCheckPage'))
const SafetyPage = lazy(() => import('./pages/hr/SafetyPage'))
const KPIPage = lazy(() => import('./pages/hr/KPIPage'))
const HRReportsPage = lazy(() => import('./pages/hr/HRReportsPage'))
const HRProductionOutputPage = lazy(() => import('./pages/hr/ProductionOutputPage'))
const PayrollAdjustmentsPage = lazy(() => import('./pages/hr/PayrollAdjustmentsPage'))
const PayrollRunsPage = lazy(() => import('./pages/hr/PayrollRunsPage'))
const PayrollComplaintsPage = lazy(() => import('./pages/hr/PayrollComplaintsPage'))
const MyPayslipPage = lazy(() => import('./pages/hr/MyPayslipPage'))
const EmployeeListPage = lazy(() => import('./pages/hr/EmployeeListPage'))
const DepartmentPage = lazy(() => import('./pages/hr/DepartmentPage'))
const PayrollConfigPage = lazy(() => import('./pages/hr/PayrollConfigPage'))
const AttendancePage = lazy(() => import('./pages/hr/AttendancePage'))
// PayrollPage cũ — gỡ. Sprint D thay thế bằng /hr/payroll-runs (engine 6 công thức + workflow)
const LogisticsPage = lazy(() => import('./pages/hr/LogisticsPage'))
const LeaveApprovalPage = lazy(() => import('./pages/hr/LeaveApprovalPage'))
const RewardDisciplinePage = lazy(() => import('./pages/hr/RewardDisciplinePage'))
const EmployeeMobilePortal = lazy(() => import('./pages/hr/EmployeeMobilePortal'))
const PermissionMatrixPage = lazy(() => import('./pages/hr/PermissionMatrixPage'))
const TeamPermissionsPage = lazy(() => import('./pages/hr/TeamPermissionsPage'))
const CheckInLocationsPage = lazy(() => import('./pages/hr/CheckInLocationsPage'))
const BenefitsPage = lazy(() => import('./pages/hr/BenefitsPage'))
const PrintTemplatePage = lazy(() => import('./pages/master/PrintTemplatePage'))
const DocsPage = lazy(() => import('./pages/docs/DocsPage'))
const GpsTrackingPage = lazy(() => import('./pages/logistics/GpsTrackingPage'))
const ChiPhiChuyenPage = lazy(() => import('./pages/logistics/ChiPhiChuyenPage'))
const KmThucTePage = lazy(() => import('./pages/logistics/KmThucTePage'))
const DoiSoatXangPage = lazy(() => import('./pages/logistics/DoiSoatXangPage'))
const BaoDuongKmPage = lazy(() => import('./pages/logistics/BaoDuongKmPage'))
const NhatKyXePage = lazy(() => import('./pages/logistics/NhatKyXePage'))
const CanhBaoDauPage = lazy(() => import('./pages/logistics/CanhBaoDauPage'))

// Module Hubs
const ProductionHubPage = lazy(() => import('./pages/production/ProductionHubPage'))
const WarehouseHubPage = lazy(() => import('./pages/warehouse/WarehouseHubPage'))
const AccountingHubPage = lazy(() => import('./pages/accounting/AccountingHubPage'))

// Reports - Workshop
const WorkshopPNLPage = lazy(() => import('./pages/reports/WorkshopPNLPage'))
const LegalEntityCashflowPage = lazy(() => import('./pages/reports/LegalEntityCashflowPage'))
const VATSummaryPage = lazy(() => import('./pages/reports/VATSummaryPage'))
const TaxTrialBalancePage = lazy(() => import('./pages/reports/TaxTrialBalancePage'))
const ProductionCostingPage = lazy(() => import('./pages/reports/ProductionCostingPage'))
const ReportingHubPage = lazy(() => import('./pages/reports/ReportingHubPage'))
const CashflowDailyPage = lazy(() => import('./pages/reports/CashflowDailyPage'))
const GroupPNLPage = lazy(() => import('./pages/reports/GroupPNLPage'))
const SalesGroupPage = lazy(() => import('./pages/reports/SalesGroupPage'))
const GroupDebtPage = lazy(() => import('./pages/reports/GroupDebtPage'))
const SalesByNVKDPage = lazy(() => import('./pages/reports/SalesByNVKDPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

function PermissionGuard({ required, children }: { required: string[]; children: React.ReactNode }) {
  const userPermissions: string[] = useAuthStore((s) => s.user?.permissions ?? [])
  const role: string = useAuthStore((s) => s.user?.role ?? '')
  if (role === 'ADMIN' || role === 'admin') return <>{children}</>
  const ok = required.some(p => userPermissions.includes(p))
  return ok ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function WorkerOrPrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const hasWorkerSession = !!storage.get('cd2_worker_session')
  if (isAuthenticated() || hasWorkerSession) return <>{children}</>
  return <Navigate to="/cd2/machine-login" replace />
}

export default function App() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
  }

  return (
    <>
      {installPrompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          background: '#1b168e', color: '#fff', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>📥 Cài đặt App Nam Phương ERP để dùng nhanh hơn</span>
          <button 
            onClick={handleInstall}
            style={{
              background: '#ff8200', border: 'none', color: '#fff', 
              padding: '6px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer'
            }}
          >
            CÀI ĐẶT NGAY
          </button>
        </div>
      )}
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Spin size="large" /></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/production/cd2/mobile-tracking" element={<WorkerOrPrivateRoute><ErrorBoundary><MobileTrackingPage /></ErrorBoundary></WorkerOrPrivateRoute>} />
          <Route path="/production/cd2/scan" element={<WorkerOrPrivateRoute><ErrorBoundary><ScanMayPage /></ErrorBoundary></WorkerOrPrivateRoute>} />
          <Route path="/production/cd2/nhap-kho-tp" element={<WorkerOrPrivateRoute><ErrorBoundary><ScanNhapKhoTPPage /></ErrorBoundary></WorkerOrPrivateRoute>} />
          <Route path="/production/may-song" element={<WorkerOrPrivateRoute><ErrorBoundary><MaySongPage /></ErrorBoundary></WorkerOrPrivateRoute>} />
          <Route path="/cd2/machine-login" element={<ErrorBoundary><MachineLoginPage /></ErrorBoundary>} />
          <Route path="/gate-login" element={<ErrorBoundary><GateLoginPage /></ErrorBoundary>} />
          <Route path="/kho-login" element={<ErrorBoundary><KhoLoginPage /></ErrorBoundary>} />
          <Route path="/kho-cuon-giay" element={<ErrorBoundary><Suspense fallback={null}><CanCuonGiayPage /></Suspense></ErrorBoundary>} />
          <Route path="/gate-hub" element={<ErrorBoundary><Suspense fallback={null}><GateHubPage /></Suspense></ErrorBoundary>} />
          <Route path="/gate/nhap-nhanh" element={<ErrorBoundary><Suspense fallback={null}><NhapNhanhPage /></Suspense></ErrorBoundary>} />
          <Route path="/giao-hang-mobile" element={<ErrorBoundary><Suspense fallback={null}><GiaoHangMobilePage /></Suspense></ErrorBoundary>} />
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
            <Route path="sales/orders" element={<ErrorBoundary><SalesOrdersPage /></ErrorBoundary>} />
            <Route path="sales/orders/new" element={<ErrorBoundary><OrderCreate /></ErrorBoundary>} />
            <Route path="sales/orders/:id" element={<ErrorBoundary><OrderDetail /></ErrorBoundary>} />
            <Route path="sales/orders/:id/discount" element={<ErrorBoundary><OrderDiscountUpdate /></ErrorBoundary>} />
            <Route path="sales/returns" element={<ErrorBoundary><SalesReturnsPage /></ErrorBoundary>} />
            <Route path="sales/returns/create" element={<ErrorBoundary><SalesReturnCreate /></ErrorBoundary>} />
            <Route path="sales/returns/:id" element={<ErrorBoundary><SalesReturnDetail /></ErrorBoundary>} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="quotes/new" element={<ErrorBoundary><QuoteForm /></ErrorBoundary>} />
            <Route path="quotes/:id" element={<ErrorBoundary><QuoteDetail /></ErrorBoundary>} />
            <Route path="quotes/:id/edit" element={<ErrorBoundary><QuoteForm /></ErrorBoundary>} />
            <Route path="danhmuc" element={<DanhMucLanding />} />
            <Route path="danhmuc/cau-truc" element={<CauTrucList />} />
            <Route path="danhmuc/tieu-chuan-ky-thuat" element={<TieuChuanKyThuatList />} />
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
            <Route path="master/lo-xe" element={<LoXeList />} />
            <Route path="master/tinh-thanh" element={<TinhThanhList />} />
            <Route path="master/phuong-xa" element={<PhuongXaList />} />
            <Route path="master/don-gia-van-chuyen" element={<DonGiaVanChuyenList />} />
            <Route path="master/dieu-khoan-thanh-toan" element={<ErrorBoundary><DieuKhoanThanhToanList /></ErrorBoundary>} />
            <Route path="master/muc-thu-chi" element={<ErrorBoundary><MucThuChiList /></ErrorBoundary>} />
            <Route path="master/khoan-muc-chi-phi" element={<ErrorBoundary><KhoanMucChiPhiList /></ErrorBoundary>} />
            <Route path="master/loai-tai-san-co-dinh" element={<ErrorBoundary><LoaiTaisanCoDinhList /></ErrorBoundary>} />
            <Route path="master/ky-hieu-cham-cong" element={<ErrorBoundary><KyHieuChamCongList /></ErrorBoundary>} />
            <Route path="master/bieu-thue-thu-nhap" element={<ErrorBoundary><BieuThueThuNhapPage /></ErrorBoundary>} />
            <Route path="master/nhom-doi-tuong" element={<ErrorBoundary><NhomDoiTuongList /></ErrorBoundary>} />
            <Route path="master/chart-of-accounts" element={<ErrorBoundary><ChartOfAccountsPage /></ErrorBoundary>} />
            <Route path="master/tai-khoan-ngam-dinh" element={<ErrorBoundary><TaiKhoanNgamDinhPage /></ErrorBoundary>} />
            <Route path="master/loai-tien" element={<ErrorBoundary><LoaiTienList /></ErrorBoundary>} />
            <Route path="master/ngan-hang" element={<ErrorBoundary><NganHangList /></ErrorBoundary>} />
            <Route path="production/hub" element={<ErrorBoundary><ProductionHubPage /></ErrorBoundary>} />
            <Route path="warehouse/hub" element={<ErrorBoundary><WarehouseHubPage /></ErrorBoundary>} />
            <Route path="accounting/hub" element={<ErrorBoundary><AccountingHubPage /></ErrorBoundary>} />
            <Route path="production/theo-doi" element={<LenhTheoDoiPage />} />
            <Route path="production/orders" element={<ProductionOrdersPage />} />
            <Route path="production/orders/new" element={<ProductionOrderCreate />} />
            <Route path="production/orders/:id" element={<ProductionOrderDetail />} />
            <Route path="production/plans" element={<ProductionPlansPage />} />
            <Route path="production/plans/new" element={<ProductionPlanForm />} />
            <Route path="production/tan-dung" element={<TanDungPlanPage />} />
            <Route path="production/queue" element={<ProductionQueuePage />} />
            <Route path="production/bom" element={<BomListPage />} />
            <Route path="production/cost-analysis" element={<CostAnalysisPage />} />
            <Route path="production/phieu-phoi" element={<PhieuPhoiPage />} />
            <Route path="production/phieu-tra-hang" element={<PhieuTraHangPage />} />
            <Route path="production/hau-giao-hang" element={<HauGiaoHangPage />} />
            <Route path="sales/theo-don-hang" element={<TheoDonHangPage />} />
            <Route path="sales/giao-hang" element={<GiaoHangPage />} />
            <Route path="production/phieu-nhap-phoi" element={<PhieuNhapPhoiSongPage />} />
            <Route path="production/kho-phoi" element={<KhoPhoiPage />} />
            <Route path="production/kho-thanh-pham" element={<ErrorBoundary><KhoThanhPhamPage /></ErrorBoundary>} />
            <Route path="production/kho-loi" element={<ErrorBoundary><KhoLoiPage /></ErrorBoundary>} />
            <Route path="production/cd2" element={<CD2KanbanPage />} />
            <Route path="production/cd2/dashboard" element={<CD2DashboardPage />} />
            <Route path="production/cd2/may-in" element={<MayInQueuePage />} />
            <Route path="production/cd2/scan-history" element={<ScanHistoryPage />} />
            <Route path="production/cd2/history" element={<PhieuInHistoryPage />} />
            <Route path="production/cd2/dhcho2" element={<DinhHinhPage />} />
            <Route path="production/cd2/sauin-kanban" element={<SauInKanbanPage />} />
            <Route path="production/cd2/worker" element={<CD2WorkerPage />} />
            <Route path="production/cd2/shift" element={<ShiftPage />} />
            <Route path="production/cd2/config" element={<ConfigPage />} />
            <Route path="warehouse/kho-nvl" element={<ErrorBoundary><KhoNVLPage /></ErrorBoundary>} />
            <Route path="warehouse/theo-xuong" element={<KhoTheoXuongPage />} />
            <Route path="warehouse/inventory" element={<InventoryPage />} />
            <Route path="warehouse/nhap-nhanh" element={<NhapNhanhPage />} />
            <Route path="warehouse/nhap-giay" element={<NhapGiayPage />} />
            <Route path="warehouse/kho-giay-cuon" element={<KhoGiayCuonPage />} />
            <Route path="warehouse/can-cuon-giay" element={<CanCuonGiayPage />} />
            <Route path="warehouse/ocr-examples" element={<OcrExamplesPage />} />
            <Route path="warehouse/nhap-phoi-ngoai" element={<NhapPhoiNgoaiPage />} />
            <Route path="warehouse/receipts" element={<ReceiptsPage />} />
            <Route path="warehouse/issues" element={<IssuesPage />} />
            <Route path="warehouse/production-output" element={<ProductionOutputPage />} />
            <Route path="warehouse/transfers" element={<TransfersPage />} />
            <Route path="warehouse/stock-adjustments" element={<StockAdjustmentsPage />} />
            <Route path="warehouse/ton-dau-ky" element={<ErrorBoundary><TonDauKyPage /></ErrorBoundary>} />
            <Route path="warehouse/so-nhap-xuat-ton" element={<ErrorBoundary><SoNhapXuatTonPage /></ErrorBoundary>} />
            <Route path="warehouse/doi-soat-cuon" element={<ErrorBoundary><DoiSoatCuonPage /></ErrorBoundary>} />
            <Route path="warehouse/the-kho" element={<InventoryCardPage />} />
            <Route path="warehouse/production-sessions" element={<ErrorBoundary><ProductionSessionsPage /></ErrorBoundary>} />
            <Route path="warehouse/production-session-report" element={<ErrorBoundary><ProductionSessionReportPage /></ErrorBoundary>} />
            <Route path="purchasing/hub" element={<ErrorBoundary><PurchaseHubPage /></ErrorBoundary>} />
            <Route path="purchasing/giay-cuon" element={<ErrorBoundary><MuaGiayPage /></ErrorBoundary>} />
            <Route path="purchasing/nvl-khac" element={<ErrorBoundary><MuaNVLPage /></ErrorBoundary>} />
            <Route path="purchasing/orders" element={<POListPage />} />
            <Route path="purchasing/goods-receipts" element={<ErrorBoundary><GoodsReceiptPage /></ErrorBoundary>} />
            <Route path="purchasing/doi-soat-kho" element={<ErrorBoundary><DoiSoatKhoPage /></ErrorBoundary>} />
            <Route path="purchasing/du-bao-nhu-cau" element={<ErrorBoundary><DuBaoNhuCauPage /></ErrorBoundary>} />
            <Route path="purchasing/ymh" element={<ErrorBoundary><YMHListPage /></ErrorBoundary>} />
            <Route path="purchasing/ymh/:id" element={<ErrorBoundary><YMHDetailPage /></ErrorBoundary>} />
            <Route path="purchasing/dashboard" element={<ErrorBoundary><PurchaseDashboardPage /></ErrorBoundary>} />
            <Route path="purchasing/returns" element={<ErrorBoundary><PurchaseReturnPage /></ErrorBoundary>} />
            <Route path="purchasing/reports" element={<ErrorBoundary><PurchaseReportPage /></ErrorBoundary>} />
            <Route path="purchasing/doi-tru" element={<ErrorBoundary><DoiTruPage /></ErrorBoundary>} />
            <Route path="purchasing/doi-tru-nhieu" element={<ErrorBoundary><DoiTruNhieuPage /></ErrorBoundary>} />
            <Route path="purchasing/bo-doi-tru" element={<ErrorBoundary><BoDoiTruPage /></ErrorBoundary>} />
            <Route path="purchasing/bo-doi-tru-nhieu" element={<ErrorBoundary><BoDoiTruNhieuPage /></ErrorBoundary>} />
            <Route path="purchasing/bu-tru-cong-no" element={<ErrorBoundary><BuTruCongNoPage /></ErrorBoundary>} />
            <Route path="purchasing/reports/so-chi-tiet" element={<ErrorBoundary><SoChiTietMuaHangPage /></ErrorBoundary>} />
            <Route path="purchasing/reports/chi-tiet-cong-no-phai-tra" element={<ErrorBoundary><ChiTietCongNoPhatTraPage /></ErrorBoundary>} />
            <Route path="danhmuc/phap-nhan" element={<PhapNhanList />} />
            <Route path="danhmuc/phim-tat" element={<PhimTatPage />} />
            <Route path="master/phan-xuong" element={<PhanXuongList />} />
            <Route path="master/indirect-costs" element={<IndirectCostList />} />
            <Route path="master/addon-rates" element={<AddonRateList />} />
            <Route path="master/tem-paper-prices" element={<TemPaperPriceList />} />
            <Route path="master/offset-addon-prices" element={<OffsetAddonPriceList />} />
            <Route path="billing/invoices" element={<SalesInvoiceListPage />} />
            <Route path="billing/invoices/new" element={<SalesInvoiceForm />} />
            <Route path="billing/invoices/:id" element={<SalesInvoiceDetailPage />} />
            <Route path="billing/adjustments" element={<InvoiceAdjustmentListPage />} />
            <Route path="accounting/tien-mat" element={<TienMatPage />} />
            <Route path="accounting/ngan-hang" element={<NganHangPage />} />
            <Route path="accounting/receipts" element={<Navigate to="/accounting/tien-mat" replace />} />
            <Route path="accounting/receipts/new" element={<CashReceiptForm />} />
            <Route path="accounting/receipts/by-invoice" element={<CashReceiptByInvoicePage />} />
            <Route path="accounting/receipts/batch" element={<CashReceiptBatchPage />} />
            <Route path="accounting/receipts/:id/edit" element={<CashReceiptForm />} />
            <Route path="accounting/receipts/:id" element={<CashReceiptDetailPage />} />
            <Route path="accounting/internal-transfers" element={<InternalTransferListPage />} />
            <Route path="accounting/internal-transfers/new" element={<InternalTransferForm />} />
            <Route path="accounting/internal-transfers/:id" element={<InternalTransferDetailPage />} />
            <Route path="accounting/payments" element={<Navigate to="/accounting/tien-mat" replace />} />
            <Route path="accounting/payments/new" element={<CashPaymentForm />} />
            <Route path="accounting/payments/:id/edit" element={<CashPaymentForm />} />
            <Route path="accounting/tax-payments/new" element={<TaxPaymentPage />} />
            <Route path="accounting/insurance-payments/new" element={<InsurancePaymentPage />} />
            <Route path="accounting/salary-payments/new" element={<SalaryPaymentPage />} />
            <Route path="accounting/excel-import" element={<ExcelImportWizardPage />} />
            <Route path="accounting/payments/:id" element={<CashPaymentDetailPage />} />
            <Route path="accounting/purchase-invoices" element={<PurchaseInvoiceListPage />} />
            <Route path="accounting/purchase-invoices/:id" element={<PurchaseInvoiceDetailPage />} />
            <Route path="accounting/incoming-invoices" element={<ErrorBoundary><IncomingInvoiceProcessingPage /></ErrorBoundary>} />
            <Route path="accounting/ar-ledger" element={<ARLedgerPage />} />
            <Route path="accounting/ap-ledger" element={<APLedgerPage />} />
            <Route path="accounting/cash-book" element={<CashBookPage />} />
            <Route path="accounting/bank-ledger" element={<BankLedgerPage />} />
            <Route path="accounting/bank-reconciliation" element={<BankReconciliationPage />} />
            <Route path="accounting/khe-uoc-vay" element={<KheUocVayPage />} />
            <Route path="accounting/khe-uoc-cho-vay" element={<KheUocChoVayPage />} />
            <Route path="accounting/du-bao-dong-tien" element={<DuBaoDongTienPage />} />
            <Route path="accounting/ccdc" element={<CCDCListPage />} />
            <Route path="master/bank-accounts" element={<BankAccountList />} />
            <Route path="accounting/ar-reconciliation" element={<ErrorBoundary><CustomerReconciliation /></ErrorBoundary>} />
            <Route path="accounting/ap-reconciliation" element={<ErrorBoundary><SupplierReconciliation /></ErrorBoundary>} />
            <Route path="accounting/general-ledger" element={<ErrorBoundary><GeneralLedgerPage /></ErrorBoundary>} />
            <Route path="accounting/trial-balance" element={<ErrorBoundary><TrialBalancePage /></ErrorBoundary>} />
            <Route path="accounting/workshop-management" element={<ErrorBoundary><WorkshopManagement /></ErrorBoundary>} />
            <Route path="accounting/journal-entries" element={<ErrorBoundary><JournalEntryListPage /></ErrorBoundary>} />
            <Route path="accounting/journal-entries/new" element={<ErrorBoundary><JournalEntryForm /></ErrorBoundary>} />
            <Route path="accounting/audit-logs" element={<ErrorBoundary><AccountingAuditPage /></ErrorBoundary>} />
            <Route path="accounting/profit-loss" element={<ErrorBoundary><ProfitLossPage /></ErrorBoundary>} />
            <Route path="accounting/balance-sheet" element={<ErrorBoundary><BalanceSheetPage /></ErrorBoundary>} />
            <Route path="accounting/period-closing" element={<ErrorBoundary><PeriodClosingPage /></ErrorBoundary>} />
            <Route path="accounting/hoa-don-dien-tu" element={<ErrorBoundary><HoaDonDienTuPage /></ErrorBoundary>} />
            <Route path="accounting/opening-balances" element={<ErrorBoundary><OpeningBalancePage /></ErrorBoundary>} />
            <Route path="accounting/customer-refunds" element={<ErrorBoundary><CustomerRefundListPage /></ErrorBoundary>} />
            <Route path="accounting/customer-refunds/:id" element={<ErrorBoundary><CustomerRefundDetailPage /></ErrorBoundary>} />
            <Route path="reports/hub" element={<ErrorBoundary><ReportingHubPage /></ErrorBoundary>} />
            <Route path="reports/debt-summary" element={<ErrorBoundary><DebtSummaryPage /></ErrorBoundary>} />
            <Route path="reports/phoi-thanh-pham" element={<ErrorBoundary><BaoCaoPhoiTpPage /></ErrorBoundary>} />
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
            <Route path="reports/cashflow-daily" element={<ErrorBoundary><CashflowDailyPage /></ErrorBoundary>} />
            <Route path="reports/group-pnl" element={<ErrorBoundary><GroupPNLPage /></ErrorBoundary>} />
            <Route path="reports/sales-group" element={<ErrorBoundary><SalesGroupPage /></ErrorBoundary>} />
            <Route path="reports/group-debt" element={<ErrorBoundary><GroupDebtPage /></ErrorBoundary>} />
            <Route path="reports/sales-nvkd" element={<ErrorBoundary><SalesByNVKDPage /></ErrorBoundary>} />
            <Route path="hr/dashboard" element={<ErrorBoundary><HRDashboardPage /></ErrorBoundary>} />
            <Route path="hr/health-checks" element={<ErrorBoundary><HealthCheckPage /></ErrorBoundary>} />
            <Route path="hr/safety" element={<ErrorBoundary><SafetyPage /></ErrorBoundary>} />
            <Route path="hr/kpi" element={<ErrorBoundary><KPIPage /></ErrorBoundary>} />
            <Route path="hr/reports" element={<ErrorBoundary><HRReportsPage /></ErrorBoundary>} />
            <Route path="hr/production-output" element={<ErrorBoundary><HRProductionOutputPage /></ErrorBoundary>} />
            <Route path="hr/payroll-adjustments" element={<ErrorBoundary><PayrollAdjustmentsPage /></ErrorBoundary>} />
            <Route path="hr/payroll-runs" element={<ErrorBoundary><PayrollRunsPage /></ErrorBoundary>} />
            <Route path="hr/payroll-complaints" element={<ErrorBoundary><PayrollComplaintsPage /></ErrorBoundary>} />
            <Route path="portal/payslip" element={<ErrorBoundary><MyPayslipPage /></ErrorBoundary>} />
            <Route path="hr/employees" element={<PermissionGuard required={['hr.view', 'hr.employees']}><ErrorBoundary><EmployeeListPage /></ErrorBoundary></PermissionGuard>} />
            <Route path="hr/attendance" element={<ErrorBoundary><AttendancePage /></ErrorBoundary>} />
            <Route path="hr/checkin-locations" element={<ErrorBoundary><CheckInLocationsPage /></ErrorBoundary>} />
            <Route path="hr/benefits" element={<ErrorBoundary><BenefitsPage /></ErrorBoundary>} />
            <Route path="hr/departments" element={<ErrorBoundary><DepartmentPage /></ErrorBoundary>} />
            {/* Redirect: /hr/payroll cũ → /hr/payroll-runs Sprint D (engine + workflow chốt + duyệt). Ngày lễ → /hr/payroll-config tab 5 */}
            <Route path="hr/payroll" element={<Navigate to="/hr/payroll-runs" replace />} />
            <Route path="hr/payroll-config" element={<ErrorBoundary><PayrollConfigPage /></ErrorBoundary>} />
            <Route path="hr/logistics" element={<ErrorBoundary><LogisticsPage /></ErrorBoundary>} />
            <Route path="logistics/gps-tracking" element={<ErrorBoundary><GpsTrackingPage /></ErrorBoundary>} />
            <Route path="logistics/chi-phi-chuyen" element={<ErrorBoundary><ChiPhiChuyenPage /></ErrorBoundary>} />
            <Route path="logistics/km-thuc-te" element={<ErrorBoundary><KmThucTePage /></ErrorBoundary>} />
            <Route path="logistics/doi-soat-xang" element={<ErrorBoundary><DoiSoatXangPage /></ErrorBoundary>} />
            <Route path="logistics/bao-duong-km" element={<ErrorBoundary><BaoDuongKmPage /></ErrorBoundary>} />
            <Route path="logistics/nhat-ky-xe" element={<ErrorBoundary><NhatKyXePage /></ErrorBoundary>} />
            <Route path="logistics/canh-bao-dau" element={<ErrorBoundary><CanhBaoDauPage /></ErrorBoundary>} />
            <Route path="hr/approvals" element={<ErrorBoundary><LeaveApprovalPage /></ErrorBoundary>} />
            <Route path="hr/rewards" element={<ErrorBoundary><RewardDisciplinePage /></ErrorBoundary>} />
            <Route path="hr/me" element={<ErrorBoundary><EmployeeMobilePortal /></ErrorBoundary>} />
            <Route path="hr/permission-matrix" element={<ErrorBoundary><PermissionMatrixPage /></ErrorBoundary>} />
            <Route path="hr/team-permissions" element={<ErrorBoundary><TeamPermissionsPage /></ErrorBoundary>} />
            <Route path="quality/qc-sheets" element={<ErrorBoundary><QCListPage /></ErrorBoundary>} />
            <Route path="quality/giay-cuon" element={<ErrorBoundary><QCGiayCuonPage /></ErrorBoundary>} />
            <Route path="quality/nvl" element={<ErrorBoundary><QCNvlPage /></ErrorBoundary>} />
            <Route path="maintenance/schedules" element={<ErrorBoundary><MaintenanceSchedulePage /></ErrorBoundary>} />
            <Route path="maintenance/logs" element={<ErrorBoundary><MaintenanceLogPage /></ErrorBoundary>} />

            <Route path="fixed-assets" element={<ErrorBoundary><FixedAssetPage /></ErrorBoundary>} />

            <Route path="agent" element={<ErrorBoundary><AgentPage /></ErrorBoundary>} />
            <Route path="master/print-templates" element={<ErrorBoundary><PrintTemplatePage /></ErrorBoundary>} />
            <Route path="docs" element={<ErrorBoundary><DocsPage /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
