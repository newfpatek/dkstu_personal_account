import { apiClient } from './client';

export const searchStudents = (q, groupId) => {
  const params = {};
  if (q) params.q = q;
  if (groupId) params.groupId = groupId;
  return apiClient.get('/students', { params });
};

export const getStudentProfile = (id) =>
  apiClient.get(`/students/${id}/profile`);

export const getStudentGrades = (id, semester, academicYear) => {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  return apiClient.get(`/students/${id}/grades`, { params });
};

export const getStudentScholarship = (id) =>
  apiClient.get(`/students/${id}/scholarship`);

export const getStudentPortfolio = (id, category) => {
  const params = {};
  if (category) params.category = category;
  return apiClient.get(`/students/${id}/portfolio`, { params });
};

export const fetchStudentPortfolioFile = (studentId, itemId, inline = false) =>
  apiClient.get(`/students/${studentId}/portfolio/${itemId}/file`, {
    params: inline ? { inline: 'true' } : {},
    responseType: 'blob',
  });
