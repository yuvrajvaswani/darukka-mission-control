import apiClient from './client'

export const projectsApi = {
  list: (params) => apiClient.get('/api/v1/projects/', { params }),
  get: (id) => apiClient.get(`/api/v1/projects/${id}`),
  create: (data) => apiClient.post('/api/v1/projects/', data),
  update: (id, data) => apiClient.patch(`/api/v1/projects/${id}`, data),
  delete: (id) => apiClient.delete(`/api/v1/projects/${id}`),
  seedDemo: () => apiClient.post('/api/v1/projects/seed-demo'),
}
