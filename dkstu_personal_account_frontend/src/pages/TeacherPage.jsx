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
              <span className={styles.profileGroupEmpty}>Преподаватель</span>
            )}
          </div>

          <span className={styles.navLabel}>Навигация</span>
          <NavLink to="/teacher/groups" className={navClass}>
            <span className={styles.navFull}>Мои группы</span>
            <span className={styles.navShort}>Группы</span>
          </NavLink>
          <NavLink to="/teacher/messages" className={navClass}>
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
