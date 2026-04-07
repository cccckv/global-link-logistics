import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    
    if (!userData) {
      alert('请先登录');
      navigate('/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      
      if (user.userRole !== 'ADMIN') {
        alert('权限不足：此功能仅限管理员使用');
        navigate('/external-tracking');
      }
    } catch (error) {
      console.error('解析用户数据失败:', error);
      alert('用户数据异常，请重新登录');
      localStorage.removeItem('user');
      localStorage.removeItem('jwt_token');
      navigate('/login');
    }
  }, [navigate]);

  const userData = localStorage.getItem('user');
  if (!userData) return null;

  try {
    const user = JSON.parse(userData);
    return user.userRole === 'ADMIN' ? <>{children}</> : null;
  } catch {
    return null;
  }
}
