const BASE_URL = 'http://localhost:3000/api';

export const apiClient = {
  get: async (path: string) => {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return res.json();
  },
  // post, put, delete — добавить если/когда надо будет
};