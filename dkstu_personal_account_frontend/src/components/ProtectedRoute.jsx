import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('access_token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Не авторизован
  if (!token || !user) return <Navigate to="/login" replace />;

  // Роль не подходит
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}