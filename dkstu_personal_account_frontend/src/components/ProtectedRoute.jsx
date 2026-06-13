import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = sessionStorage.getItem('access_token');
  const user = JSON.parse(sessionStorage.getItem('user') || 'null');

  // Не авторизован
  if (!token || !user) return <Navigate to="/login" replace />;

  // Роль не подходит
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}