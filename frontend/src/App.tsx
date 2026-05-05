import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/auth'
import AppLayout from './components/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const OrderCreate = lazy(() => import('./pages/sales/OrderCreate'))
const OrderDetail = lazy(() => import('./pages/sales/OrderDetail'))
const SalesOrdersPage = lazy(() => import('./pages/sales/SalesOrdersPage'))
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
const KhoTheoXuongPage = lazy(() => import('./pages/warehouse/KhoTheoXuongPage'))
const ReceiptsPage = lazy(() => import('./pages/warehouse/ReceiptsPage'))
const IssuesPage = lazy(() => import('./pages/warehouse/IssuesPage'))
const TransfersPage = lazy(() => import('./pages/warehouse/TransfersPage'))
const StockAdjustmentsPage = lazy(() => import('./pages/warehouse/StockAdjustmentsPage'))
const ProductionOutputPage = lazy(() => import('./pages/warehouse/ProductionOutputPage'))
const DeliveryPage = lazy(() => import('./pages/warehouse/DeliveryPage'))
const TheoDonHangPage = lazy(() => import('./pages/sales/TheoDonHangPage'))
const GiaoHangPage = lazy(() => import('./pages/sales/GiaoHangPage'))
const POListPage = lazy(() => import('./pages/purchase/POListPage'))
const PhapNhanList = lazy(() => import('./pages/danhmuc/PhapNhanList'))
const PhanXuongList = lazy(() => import('./pages/danhmuc/PhanXuongList'))
const RolePermissionsPage = lazy(() => import('./pages/danhmuc/RolePermissionsPage'))

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

        {/* Mua hàng */}
        <Route path="purchasing/orders" element={<POListPage />} />

        {/* Pháp nhân */}
        <Route path="danhmuc/phap-nhan" element={<PhapNhanList />} />

        {/* Nơi sản xuất (Phân xưởng) */}
        <Route path="master/phan-xuong" element={<PhanXuongList />} />

        {/* BOM / Chi phí */}
        <Route path="master/indirect-costs" element={<IndirectCostList />} />
        <Route path="master/addon-rates" element={<AddonRateList />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
      </Routes>
    </Suspense>
  )
}
