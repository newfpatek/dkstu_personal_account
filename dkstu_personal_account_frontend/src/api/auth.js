import { apiClient } from './client';

export const loginRequest = (email, password) =>
  apiClient.post('/auth/login', { email, password });

export const registerRequest = (email, password, fullName) =>
  apiClient.post('/auth/register', { email, password, fullName });