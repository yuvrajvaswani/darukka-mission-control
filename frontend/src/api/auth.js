import apiClient from './client'

export const authApi = {
  register: (data) => apiClient.post('/api/v1/auth/register', data),
  login: (data) => apiClient.post('/api/v1/auth/login', data),
  refresh: (refreshToken) =>
    apiClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),
  me: () => apiClient.get('/api/v1/auth/me'),
}
