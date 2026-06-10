import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import styles from './StudentPage.module.css';

export default function AdminPage() {
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
            <span className={styles.profileGroupEmpty}>Администратор</span>
          </div>

          <span className={styles.navLabel}>Навигация</span>
          <NavLink to="/admin/users" className={navClass}>
            <span className={styles.navFull}>Пользователи</span>
            <span className={styles.navShort}>Польз.</span>
          </NavLink>
          <NavLink to="/admin/groups" className={navClass}>
            <span className={styles.navFull}>Группы</span>
            <span className={styles.navShort}>Группы</span>
          </NavLink>
          <NavLink to="/admin/grades" className={navClass}>
            <span className={styles.navFull}>Оценки</span>
            <span className={styles.navShort}>Оценки</span>
          </NavLink>
          <NavLink to="/admin/scholarships" className={navClass}>
            <span className={styles.navFull}>Стипендии</span>
            <span className={styles.navShort}>Стипендии</span>
          </NavLink>
          <NavLink to="/admin/messages" className={navClass}>
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
