import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

// Страницы — создай их сам, пока просто заглушки
const StudentPage = () => <h1>Кабинет студента</h1>;
const TeacherPage = () => <h1>Кабинет преподавателя</h1>;
const AdminPage = () => <h1>Панель администратора</h1>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Дефолтный редирект */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}