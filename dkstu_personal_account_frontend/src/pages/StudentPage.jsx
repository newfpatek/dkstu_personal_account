import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getProfile } from '../api/students';
import styles from './StudentPage.module.css';

export default function StudentPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    getProfile()
      .then((r) => setGroups(r.data.groups || []))
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
              <span className={styles.profileGroupEmpty}>Группа не назначена</span>
            )}
          </div>

          <span className={styles.navLabel}>Навигация</span>
          <NavLink to="/student/group" className={navClass}>
            Моя группа
          </NavLink>
          <NavLink to="/student/grades" className={navClass}>
            Зачётная книжка
          </NavLink>
          <NavLink to="/student/scholarship" className={navClass}>
            Стипендия
          </NavLink>
          <NavLink to="/student/portfolio" className={navClass}>
            Портфолио
          </NavLink>
          <NavLink to="/student/messages" className={navClass}>
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
