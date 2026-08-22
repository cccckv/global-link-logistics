import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface InternalRouteProps {
  children: ReactNode;
}

/**
 * 内部员工路由守卫：
 * 仅允许 ADMIN、SALES、FINANCE 角色访问内部中台。
 * 普通用户 (USER) 访问时自动重定向到客户专属看板 /customer/waybills。
 */
export default function InternalRoute({ children }: InternalRouteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      if (user.userRole === 'USER') {
        navigate('/customer/waybills', { replace: true });
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('jwt_token');
      navigate('/login');
    }
  }, [navigate]);

  const userData = localStorage.getItem('user');
  if (!userData) return null;

  try {
    const user = JSON.parse(userData);
    return user.userRole !== 'USER' ? <>{children}</> : null;
  } catch {
    return null;
  }
}
