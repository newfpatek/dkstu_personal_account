import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getTeacherGroups } from '../api/teacher';
import styles from './StudentPage.module.css';

export default function TeacherPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    getTeacherGroups()
      .then((r) => setGroups(r.data || []))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navClass = ({ isActive }) =>
    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.logo}>КГТУ — Личный кабинет</span>
        <div className={styles.userBlock}>
          <span className={styles.userName}>{user.fullName}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Выход
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.sidebar}>
          <div className={styles.profileCard}>
            <span className={styles.profileName}>{user.fullName}</span>
            {groups.length > 0 ? (
              <span className={styles.profileGroup}>
                {groups.map((g) => g.name).join(', ')}
              </span>
            ) : (
              <span className={styles.profileGroupEmpty}>Преподаватель</span>
            )}
          </div>

          <span className={styles.navLabel}>Навигация</span>
          <NavLink to="/teacher/groups" className={navClass}>
            Мои группы
          </NavLink>
          <NavLink to="/teacher/messages" className={navClass}>
            Сообщения
          </NavLink>
        </nav>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
