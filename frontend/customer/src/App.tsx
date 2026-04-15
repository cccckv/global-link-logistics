import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Tracking from './pages/Tracking';
import QuickOrder from './pages/QuickOrder';
import OrderList from './pages/OrderList';
import OrderDetail from './pages/OrderDetail';
import ExternalTracking from './pages/ExternalTracking';
import UserManagement from './pages/UserManagement';
import AdminOrderManagement from './pages/AdminOrderManagement';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/tracking" element={<Tracking />} />
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/tracking-dashboard" element={<Tracking />} />
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
          <Route
            path="/admin/order-management"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminOrderManagement />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/external-tracking"
            element={
              <ProtectedRoute>
                <ExternalTracking />
              </ProtectedRoute>
            }
          />

          <Route
            path="/order/quick"
            element={
              <ProtectedRoute>
                <QuickOrder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order/list"
            element={
              <ProtectedRoute>
                <OrderList />
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
            path="/order/detail/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
