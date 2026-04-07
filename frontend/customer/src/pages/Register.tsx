import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Smartphone, Lock, User, MessageSquare } from 'lucide-react';
import { authApi } from '../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    phone: '',
    code: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!formData.phone) {
      setError('请输入手机号');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      setError('请输入有效的手机号');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await authApi.sendCode(formData.phone);
      setCodeSent(true);
      setCountdown(300);
      setError('');
      alert(`验证码已发送! 请查看后端控制台获取验证码\n(开发环境下验证码会输出到后端日志)`);
    } catch (err: any) {
      setError(err.response?.data?.error || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    if (!formData.code) {
      setError('请输入验证码');
      return;
    }

    setLoading(true);

    if (!formData.name) {
      setError('请输入用户名');
      return;
    }

    try {
      const response = await authApi.register({
        phone: formData.phone,
        code: formData.code,
        password: formData.password,
        name: formData.name,
      });
      
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
      setError(err.response?.data?.error || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark to-primary flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-2">创建账户</h2>
        <p className="text-gray-600 text-center mb-8">开始使用全球物流服务</p>

        {error && (
          <div className="bg-accent-coral/10 border border-accent-coral text-accent-coral px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">手机号 *</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="请输入手机号"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                pattern="1[3-9]\d{9}"
                maxLength={11}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">用户名 *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入用户名"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">验证码 *</label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="请输入验证码"
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                  maxLength={6}
                />
              </div>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0 || loading}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-light transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}秒` : codeSent ? '重新发送' : '发送验证码'}
              </button>
            </div>
            {codeSent && countdown > 0 && (
              <p className="text-xs text-gray-500 mt-1">验证码已发送，{Math.floor(countdown / 60)}分{countdown % 60}秒后可重新发送</p>
            )}
          </div>



          <div>
            <label className="block text-sm font-medium mb-2">密码 *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="请输入密码 (至少6位)"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">确认密码 *</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="请再次输入密码"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-light transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          已有账户?{' '}
          <Link to="/login" className="text-primary hover:text-primary-light font-semibold">
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
}
