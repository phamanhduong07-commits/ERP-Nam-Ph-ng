import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrderCreate from './pages/sales/OrderCreate'
import OrderDetail from './pages/sales/OrderDetail'
import SalesOrdersPage from './pages/sales/SalesOrdersPage'
import QuoteForm from './pages/quotes/QuoteForm'
import QuoteDetail from './pages/quotes/QuoteDetail'
import QuotesPage from './pages/quotes/QuotesPage'
import CauTrucList from './pages/danhmuc/CauTrucList'
import CustomerList from './pages/danhmuc/CustomerList'
import SupplierList from './pages/danhmuc/SupplierList'
import MaterialGroupList from './pages/danhmuc/MaterialGroupList'
import PaperMaterialList from './pages/danhmuc/PaperMaterialList'
import OtherMaterialList from './pages/danhmuc/OtherMaterialList'
import WarehouseList from './pages/danhmuc/WarehouseList'
import ProductList from './pages/danhmuc/ProductList'
import UserList from './pages/danhmuc/UserList'
import DvtList from './pages/danhmuc/DvtList'
import ViTriList from './pages/danhmuc/ViTriList'
import XeList from './pages/danhmuc/XeList'
import TaiXeList from './pages/danhmuc/TaiXeList'
import TinhThanhList from './pages/danhmuc/TinhThanhList'
import PhuongXaList from './pages/danhmuc/PhuongXaList'
import DonGiaVanChuyenList from './pages/danhmuc/DonGiaVanChuyenList'
import ProductionOrderCreate from './pages/production/ProductionOrderCreate'
import ProductionOrderDetail from './pages/production/ProductionOrderDetail'
import ProductionOrdersPage from './pages/production/ProductionOrdersPage'
import ProductionPlansPage from './pages/production/ProductionPlansPage'
import ProductionPlanForm from './pages/production/ProductionPlanForm'
import ProductionQueuePage from './pages/production/ProductionQueuePage'
import IndirectCostList from './pages/danhmuc/IndirectCostList'
import AddonRateList from './pages/danhmuc/AddonRateList'
import BomListPage from './pages/production/BomListPage'
import PhieuPhoiPage from './pages/production/PhieuPhoiPage'
import CD2KanbanPage from './pages/production/CD2KanbanPage'
import ScanMayPage from './pages/production/ScanMayPage'
import ScanHistoryPage from './pages/production/ScanHistoryPage'
import CD2DashboardPage from './pages/production/CD2DashboardPage'
import PhieuInHistoryPage from './pages/production/PhieuInHistoryPage'
import MayInQueuePage from './pages/production/MayInQueuePage'
import DinhHinhPage from './pages/production/DinhHinhPage'
import SauInKanbanPage from './pages/production/SauInKanbanPage'
import ShiftPage from './pages/production/ShiftPage'
import ConfigPage from './pages/production/ConfigPage'
import InventoryPage from './pages/warehouse/InventoryPage'
import ReceiptsPage from './pages/warehouse/ReceiptsPage'
import IssuesPage from './pages/warehouse/IssuesPage'
import TransfersPage from './pages/warehouse/TransfersPage'
import ProductionOutputPage from './pages/warehouse/ProductionOutputPage'
import DeliveryPage from './pages/warehouse/DeliveryPage'
import POListPage from './pages/purchase/POListPage'
import PhapNhanList from './pages/danhmuc/PhapNhanList'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
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
        <Route path="sales/orders" element={<SalesOrdersPage />} />
        <Route path="sales/orders/new" element={<OrderCreate />} />
        <Route path="sales/orders/:id" element={<OrderDetail />} />

        {/* Báo giá — master-detail list + standalone routes */}
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/new" element={<QuoteForm />} />
        <Route path="quotes/:id" element={<QuoteDetail />} />
        <Route path="quotes/:id/edit" element={<QuoteForm />} />

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
        <Route path="warehouse/inventory" element={<InventoryPage />} />
        <Route path="warehouse/receipts" element={<ReceiptsPage />} />
        <Route path="warehouse/issues" element={<IssuesPage />} />
        <Route path="warehouse/production-output" element={<ProductionOutputPage />} />
        <Route path="warehouse/delivery" element={<DeliveryPage />} />
        <Route path="warehouse/transfers" element={<TransfersPage />} />

        {/* Mua hàng */}
        <Route path="purchasing/orders" element={<POListPage />} />

        {/* Pháp nhân */}
        <Route path="danhmuc/phap-nhan" element={<PhapNhanList />} />

        {/* BOM / Chi phí */}
        <Route path="master/indirect-costs" element={<IndirectCostList />} />
        <Route path="master/addon-rates" element={<AddonRateList />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
