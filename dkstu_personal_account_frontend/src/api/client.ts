import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
});

// Перехватчик: автоматически добавляет токен в каждый запрос
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});