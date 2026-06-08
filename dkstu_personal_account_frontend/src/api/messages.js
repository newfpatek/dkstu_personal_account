import { apiClient } from './client';

export const getInbox = () => apiClient.get('/messages/inbox');
export const getSent = () => apiClient.get('/messages/sent');
export const getMessageUsers = (q = '') => apiClient.get('/messages/users', { params: q ? { q } : {} });
export const getMessageGroups = (q = '') => apiClient.get('/messages/groups', { params: q ? { q } : {} });
export const searchRecipients = (q = '') => apiClient.get('/messages/search', { params: { q } });
export const sendMessage = (data) => apiClient.post('/messages', data);
export const setMessageRelevance = (id, isRelevant) =>
  apiClient.patch(`/messages/${id}/status`, { isRelevant });
