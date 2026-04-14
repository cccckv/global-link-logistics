import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Package, LogOut, User, MapPin, Menu, X, Search, Zap, Users, List, DollarSign } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (!parsedUser.userRole) {
            console.warn('旧用户数据缺少 userRole 字段，请重新登录');
            localStorage.removeItem('user');
            localStorage.removeItem('jwt_token');
            setUser(null);
            return;
          }
          setUser(parsedUser);
        } catch (error) {
          console.error('用户数据解析失败:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('jwt_token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    loadUser();

    const handleStorageChange = () => {
      loadUser();
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(loadUser, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/tracking-dashboard') {
      return location.pathname === '/tracking-dashboard';
    }
    
    const isOrderDetailPage = location.pathname.match(/^\/order\/[^/]+$/) || location.pathname.startsWith('/order/detail/');
    const fromPath = (location.state as { from?: string })?.from;
    
    if (isOrderDetailPage && fromPath) {
      return path === fromPath;
    }
    
    if (path === '/order/list' && location.pathname === '/order/list') {
      return true;
    }
    
    return location.pathname === path;
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link
      to={to}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
        isActive(to)
          ? 'bg-primary text-white'
          : 'text-gray-300 hover:bg-primary-dark/50 hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? label : ''}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-primary-dark text-white rounded-lg shadow-lg hover:bg-primary transition"
      >
        <Menu className="w-6 h-6" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`bg-gradient-to-b from-primary-dark to-[#051526] text-white flex flex-col transition-all duration-300 fixed lg:sticky lg:top-0 h-screen z-40 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <Link to="/" className="flex items-center space-x-2">
                <Package className="w-8 h-8 text-accent-cyan" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold bg-gradient-to-r from-white to-accent-cyan bg-clip-text text-transparent">
                    Global Link
                  </span>
                  <span className="text-xs text-gray-400">Logistics</span>
                </div>
              </Link>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title={collapsed ? '展开菜单' : '收起菜单'}
            >
              {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem to="/order/list" icon={List} label="运单管理" />
          <NavItem to="/external-tracking" icon={Search} label="外部查询" />
          {user?.userRole === 'ADMIN' && (
            <>
              <NavItem to="/order/quick" icon={Zap} label="快速下单" />
              <NavItem to="/tracking-dashboard" icon={MapPin} label="物流追踪" />
              <NavItem to="/admin/order-management" icon={DollarSign} label="订单收款" />
              <NavItem to="/user-management" icon={Users} label="用户管理" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          {user ? (
            <div className="space-y-3">
              {!collapsed && (
                <div className="flex items-center space-x-2 px-2 py-2 bg-white/5 rounded-lg">
                  <User className="w-5 h-5 text-accent-cyan flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || user.phone}</p>
                    <p className="text-xs text-gray-400 truncate">{user.phone}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-accent-coral/20 hover:text-accent-coral transition ${
                  collapsed ? 'justify-center' : ''
                }`}
                title={collapsed ? '登出' : ''}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>登出</span>}
              </button>
            </div>
          ) : (
            <div className={`space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
              <Link
                to="/login"
                className={`block text-center px-4 py-2 rounded-lg hover:bg-white/10 transition ${
                  collapsed ? 'w-12 h-10 flex items-center justify-center' : ''
                }`}
                title={collapsed ? '登录' : ''}
              >
                {collapsed ? <User className="w-5 h-5" /> : '登录'}
              </Link>
              {!collapsed && (
                <Link
                  to="/register"
                  className="block text-center bg-primary px-4 py-2 rounded-lg hover:bg-primary-light transition"
                >
                  注册
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
