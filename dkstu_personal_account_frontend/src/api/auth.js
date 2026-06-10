import { apiClient } from './client';

// phone — номер в формате E.164 (+71234567890), является логином
export const loginRequest = (phone, password) =>
  apiClient.post('/auth/login', { phone, password });

export const registerRequest = (email, password, fullName) =>
  apiClient.post('/auth/register', { email, password, fullName });