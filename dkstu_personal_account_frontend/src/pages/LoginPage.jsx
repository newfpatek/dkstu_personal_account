import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await loginRequest(email, password);
      const { access_token, user } = response.data;

      // Сохраняем токен и данные пользователя
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Редирект по роли
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else navigate('/student');

    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка входа');
    }
  };

  return (
    <div>
      <h1>Вход</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Войти</button>
      </form>
    </div>
  );
}