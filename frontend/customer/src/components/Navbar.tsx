import { Link, useNavigate } from 'react-router-dom';
import { Package, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  return (
    <nav className="bg-primary-dark text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 text-xl font-bold">
            <Package className="w-8 h-8 text-accent-cyan" />
            <span className="text-gradient">Global Link Logistics</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link to="/" className="hover:text-accent-cyan transition">
              首页
            </Link>
            <Link to="/tracking" className="hover:text-accent-cyan transition">
              物流追踪
            </Link>

            {user ? (
              <>
                <Link to="/orders" className="hover:text-accent-cyan transition">
                  我的订单
                </Link>
                <Link to="/order/new" className="hover:text-accent-cyan transition">
                  下单
                </Link>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 hover:text-accent-coral transition"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>登出</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:text-accent-cyan transition"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-light transition"
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
