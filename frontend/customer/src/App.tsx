import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tracking from './pages/Tracking';
import Orders from './pages/Orders';
import OrderNew from './pages/OrderNew';
import OrderDetail from './pages/OrderDetail';
import Payment from './pages/Payment';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order/new" element={<OrderNew />} />
            <Route path="/order/:orderId" element={<OrderDetail />} />
            <Route path="/payment/:orderId" element={<Payment />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
