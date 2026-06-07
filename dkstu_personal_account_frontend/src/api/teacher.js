import { apiClient } from './client';

export const getTeacherGroups = () => apiClient.get('/teacher/groups');
export const getTeacherGroupStudents = (groupId) =>
  apiClient.get(`/teacher/groups/${groupId}/students`);
