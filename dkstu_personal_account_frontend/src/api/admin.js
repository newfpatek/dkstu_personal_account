import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000/api' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Users
export const getUsers = (role) =>
  api.get('/admin/users', { params: role ? { role } : {} });

export const getUser = (id) => api.get(`/admin/users/${id}`);

export const createUser = (data) => api.post('/admin/users', data);

export const updateUser = (id, data) => api.patch(`/admin/users/${id}`, data);

export const deleteUser = (id) => api.delete(`/admin/users/${id}`);

export const importUsers = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/users/import', form);
};

// Groups
export const importGroup = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/groups/import', form);
};

export const getGroups = () => api.get('/admin/groups');

export const getGroup = (id) => api.get(`/admin/groups/${id}`);

export const createGroup = (data) => api.post('/admin/groups', data);

export const deleteGroup = (id) => api.delete(`/admin/groups/${id}`);

export const addUserToGroup = (groupId, userId) =>
  api.post(`/admin/groups/${groupId}/users/${userId}`);

export const removeUserFromGroup = (groupId, userId) =>
  api.delete(`/admin/groups/${groupId}/users/${userId}`);

export const setGroupRole = (groupId, userId, label) =>
  api.post(`/admin/groups/${groupId}/users/${userId}/role`, { label });

export const removeGroupRole = (groupId, userId) =>
  api.delete(`/admin/groups/${groupId}/users/${userId}/role`);

// Group semester disciplines
export const getGroupSemesterDisciplines = (groupId, semester, academicYear) => {
  const params = { groupId };
  if (semester !== undefined) params.semester = semester;
  if (academicYear) params.academicYear = academicYear;
  return api.get('/admin/group-disciplines', { params });
};

export const assignGroupDisciplines = (data) =>
  api.post('/admin/group-disciplines', data);

export const removeGroupSemesterDiscipline = (id) =>
  api.delete(`/admin/group-disciplines/${id}`);

export const importGroupDisciplines = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/group-disciplines/import', form);
};

// Teacher assignments
export const getTeacherAssignments = (params) =>
  api.get('/admin/teacher-assignments', { params });

export const createTeacherAssignment = (data) =>
  api.post('/admin/teacher-assignments', data);

export const deleteTeacherAssignment = (id) =>
  api.delete(`/admin/teacher-assignments/${id}`);

export const getDisciplines = () => api.get('/admin/disciplines');

// Scholarship import
export const importScholarships = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/admin/scholarships/import', form);
};

// Scholarship base amounts
export const getBaseAmounts = () => api.get('/admin/scholarships/base');

export const setBaseAmount = (data) => api.post('/admin/scholarships/base', data);

// Student scholarships
export const getStudentScholarships = (studentId) =>
  api.get(`/admin/students/${studentId}/scholarships`);

export const assignScholarship = (studentId, data) =>
  api.post(`/admin/students/${studentId}/scholarships`, data);

export const updateScholarship = (studentId, id, data) =>
  api.patch(`/admin/students/${studentId}/scholarships/${id}`, data);

export const deleteScholarship = (studentId, id) =>
  api.delete(`/admin/students/${studentId}/scholarships/${id}`);
