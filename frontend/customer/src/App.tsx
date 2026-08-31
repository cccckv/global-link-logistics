import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import InternalRoute from './components/InternalRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import OrderDetail from './pages/OrderDetail';
import WaybillDetail from './pages/WaybillDetail';
import ExternalTracking from './pages/ExternalTracking';
import UserManagement from './pages/UserManagement';
import VesselPosition from './pages/VesselPosition';
import InboundWorkbench from './pages/v2/InboundWorkbench';
import WaybillManagement from './pages/v2/WaybillManagement';
import WaybillDetailView from './pages/v2/WaybillDetailView';
import ContainerTracking from './pages/v2/ContainerTracking';
import ContainerReturnManagement from './pages/v2/ContainerReturnManagement';
import CustomerManagement from './pages/v2/CustomerManagement';
import ChannelManagement from './pages/v2/ChannelManagement';
import OriginWarehouseManagement from './pages/v2/OriginWarehouseManagement';
import CustomerWaybillList from './pages/customer/CustomerWaybillList';
import CustomerWaybillDetail from './pages/customer/CustomerWaybillDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        <Route element={<DashboardLayout />}>
          {/* 客户专属查单中心 (普通用户与内部人员均可访问) */}
          <Route
            path="/customer/waybills"
            element={
              <ProtectedRoute>
                <CustomerWaybillList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/waybills/:id"
            element={
              <ProtectedRoute>
                <CustomerWaybillDetail />
              </ProtectedRoute>
            }
          />

          {/* 公共辅助工具 */}
          <Route
            path="/external-tracking"
            element={
              <ProtectedRoute>
                <ExternalTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vessel-position"
            element={
              <ProtectedRoute>
                <VesselPosition />
              </ProtectedRoute>
            }
          />

          {/* 管理员专属用户系统管理 */}
          <Route
            path="/user-management"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          {/* 内部中台 (ADMIN / SALES / FINANCE 访问；普通用户被 InternalRoute 拦截重定向) */}
          <Route
            path="/v2/inbound"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <InboundWorkbench />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/waybills"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <WaybillManagement />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/waybills/:id"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <WaybillDetailView />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/containers"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <ContainerTracking />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/container-return"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <ContainerReturnManagement />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/customers"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <CustomerManagement />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/channels"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <ChannelManagement />
                </InternalRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/v2/warehouses"
            element={
              <ProtectedRoute>
                <InternalRoute>
                  <OriginWarehouseManagement />
                </InternalRoute>
              </ProtectedRoute>
            }
          />

          {/* 兼容历史旧路由 */}
          <Route
            path="/order/list"
            element={
              <ProtectedRoute>
                <Navigate to="/customer/waybills" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/waybill/:orderId"
            element={
              <ProtectedRoute>
                <WaybillDetail />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
