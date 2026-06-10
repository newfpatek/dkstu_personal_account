import { apiClient } from './client';

export const getProfile = () => apiClient.get('/students/me/profile');
export const getMyGroup = () => apiClient.get('/students/me/group');

export const getGrades = (semester, academicYear) => {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  return apiClient.get('/students/me/grades', { params });
};

export const getMyCurrentSemesterPlan = (semester, academicYear) => {
  const params = {};
  if (semester) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  return apiClient.get('/students/me/grades/current', { params });
};

export const getAllGrades = () =>
  apiClient.get('/students/me/grades/all');

export const getGradesHistory = () =>
  apiClient.get('/students/me/grades/history');

export const getGpa = () =>
  apiClient.get('/students/me/gpa');

export const getDebts = () =>
  apiClient.get('/students/me/debts');

export const getScholarship = () =>
  apiClient.get('/students/me/scholarship');

export const getPortfolio = (category) => {
  const params = {};
  if (category) params.category = category;
  return apiClient.get('/students/me/portfolio', { params });
};

export const uploadPortfolioItem = (formData) =>
  apiClient.post('/students/me/portfolio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deletePortfolioItem = (id) =>
  apiClient.delete(`/students/me/portfolio/${id}`);


export const fetchPortfolioFile = (itemId, inline = false) =>
  apiClient.get(`/students/me/portfolio/${itemId}/file`, {
    params: inline ? { inline: 'true' } : {},
    responseType: 'blob',
  });
