import { apiClient } from './client';

export const getInbox = () => apiClient.get('/messages/inbox');
export const getSent = () => apiClient.get('/messages/sent');
export const getMessageUsers = () => apiClient.get('/messages/users');
export const sendMessage = (data) => apiClient.post('/messages', data);
export const setMessageRelevance = (id, isRelevant) =>
  apiClient.patch(`/messages/${id}/status`, { isRelevant });
export const getMessageGroups = () => apiClient.get('/messages/groups');
