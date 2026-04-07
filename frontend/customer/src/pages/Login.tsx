import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Smartphone, Lock } from 'lucide-react';
import { authApi } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login({ phone, password });
    localStorage.setItem('jwt_token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    
    // 根据角色跳转
    if (response.data.user.userRole === 'ADMIN') {
      navigate('/order/quick');
    } else {
      navigate('/external-tracking');
    }
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败，请检查手机号和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark to-primary flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-2">欢迎回来</h2>
        <p className="text-gray-600 text-center mb-8">使用用户名或手机号登录您的账户</p>

        {error && (
          <div className="bg-accent-coral/10 border border-accent-coral text-accent-coral px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">用户名/手机号 *</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入用户名或手机号"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">密码 *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2 rounded" />
              <span className="text-gray-600">记住我</span>
            </label>
            <Link to="/forgot-password" className="text-primary hover:text-primary-light">
              忘记密码?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-light transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          还没有账户?{' '}
          <Link to="/register" className="text-primary hover:text-primary-light font-semibold">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
}
