import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
});

// Перехватчик: автоматически добавляет токен в каждый запрос
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);