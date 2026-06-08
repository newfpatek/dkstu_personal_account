import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import styles from './StudentPage.module.css';

export default function StaffPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
            <span className={styles.profileGroupEmpty}>Сотрудник</span>
          </div>

          <span className={styles.navLabel}>Навигация</span>
          <NavLink to="/staff/students" className={navClass}>
            Студенты
          </NavLink>
          <NavLink to="/staff/messages" className={navClass}>
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
