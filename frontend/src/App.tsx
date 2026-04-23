import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import OrderList from './pages/sales/OrderList'
import OrderCreate from './pages/sales/OrderCreate'
import OrderDetail from './pages/sales/OrderDetail'
import QuoteList from './pages/quotes/QuoteList'
import QuoteForm from './pages/quotes/QuoteForm'
import QuoteDetail from './pages/quotes/QuoteDetail'
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
import ProductionOrderList from './pages/production/ProductionOrderList'
import ProductionOrderCreate from './pages/production/ProductionOrderCreate'
import ProductionOrderDetail from './pages/production/ProductionOrderDetail'

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

        {/* Bán hàng */}
        <Route path="sales/orders" element={<OrderList />} />
        <Route path="sales/orders/new" element={<OrderCreate />} />
        <Route path="sales/orders/:id" element={<OrderDetail />} />

        {/* Báo giá */}
        <Route path="quotes" element={<QuoteList />} />
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

        {/* Sản xuất */}
        <Route path="production/orders" element={<ProductionOrderList />} />
        <Route path="production/orders/new" element={<ProductionOrderCreate />} />
        <Route path="production/orders/:id" element={<ProductionOrderDetail />} />

        {/* Các module khác sẽ thêm sau */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
