import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import StudentPage from './pages/StudentPage';
import TeacherPage from './pages/TeacherPage';
import StaffPage from './pages/StaffPage';
import AdminPage from './pages/AdminPage';
import GradesPage from './pages/student/GradesPage';
import ScholarshipPage from './pages/student/ScholarshipPage';
import PortfolioPage from './pages/student/PortfolioPage';
import MessagesPage from './pages/student/MessagesPage';
import GroupPage from './pages/student/GroupPage';
import TeacherGroupsPage from './pages/teacher/TeacherGroupsPage';
import StaffStudentsPage from './pages/staff/StaffStudentsPage';

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
        >
          <Route index element={<Navigate to="grades" replace />} />
          <Route path="group" element={<GroupPage />} />
          <Route path="grades" element={<GradesPage />} />
          <Route path="scholarship" element={<ScholarshipPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherPage />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="groups" replace />} />
          <Route path="groups" element={<TeacherGroupsPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffPage />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="students" replace />} />
          <Route path="students" element={<StaffStudentsPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
