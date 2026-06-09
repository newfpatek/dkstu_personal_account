import { apiClient } from './client';

export const getGroups = () => apiClient.get('/teacher/groups');
export const getGroupById = (id) => apiClient.get(`/teacher/groups/${id}`);
