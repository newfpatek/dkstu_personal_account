import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getProfile } from '../api/students';
import styles from './StudentPage.module.css';

export default function StudentPage() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    getProfile()
      .then((r) => setGroups(r.data.groups || []))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  const navClass = ({ isActive }) =>
    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <a href="https://dksta.ru/" target="_blank" rel="noopener noreferrer" className={styles.logoImgLink}>
            <img src="/logo.svg" alt="КГТУ" className={styles.logoImg} />
          </a>
          <div>
            <a href="https://dksta.ru/" target="_blank" rel="noopener noreferrer" className={styles.logoLink}>КГТУ им. В.А. Дегтярева</a>
            <div className={styles.logoSub}>Личный кабинет</div>
            <div className={styles.logoUserName}>{user.fullName}</div>
          </div>
        </div>
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
            <span className={styles.navFull}>Моя группа</span>
            <span className={styles.navShort}>Группа</span>
          </NavLink>
          <NavLink to="/student/grades" className={navClass}>
            <span className={styles.navFull}>Зачётная книжка</span>
            <span className={styles.navShort}>Оценки</span>
          </NavLink>
          <NavLink to="/student/scholarship" className={navClass}>
            <span className={styles.navFull}>Стипендия</span>
            <span className={styles.navShort}>Стипендия</span>
          </NavLink>
          <NavLink to="/student/portfolio" className={navClass}>
            <span className={styles.navFull}>Портфолио</span>
            <span className={styles.navShort}>Портфолио</span>
          </NavLink>
          <NavLink to="/student/messages" className={navClass}>
            <span className={styles.navFull}>Сообщения</span>
            <span className={styles.navShort}>Сообщения</span>
          </NavLink>
        </nav>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
