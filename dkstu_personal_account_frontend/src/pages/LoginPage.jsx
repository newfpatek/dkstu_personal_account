import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../api/auth';
import { getErrorMessage } from '../utils/error';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginRequest(phone, password);
      const { access_token, user } = response.data;

      sessionStorage.setItem('access_token', access_token);
      sessionStorage.setItem('user', JSON.stringify(user));

      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else if (user.role === 'staff') navigate('/staff');
      else navigate('/student');
    } catch (err) {
      setError(getErrorMessage(err, 'Неверный email или пароль'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.overlay} />

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoText}>
            <span className={styles.logoName}>КГТУ им. В.А. Дегтярева</span>
            <span className={styles.logoSub}>Личный кабинет</span>
          </div>
        </div>

        <p className={styles.title}>Вход в систему</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.field}>
            {/* tel тип не используем — он добавляет лишние стили на мобильных браузерах.
                Паттерн E.164: +71234567890 (страна+номер, только цифры после +) */}
            <input
              className={styles.input}
              type="tel"
              placeholder="Введите номер телефона..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </div>

          <div className={styles.field}>
            {/* <label className={styles.label}>Пароль</label> */}
            <input
              className={styles.input}
              type="password"
              placeholder="Введите пароль..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
