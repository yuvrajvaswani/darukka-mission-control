import apiClient from './client'

export const sitesApi = {
  list: (projectId, params) =>
    apiClient.get('/api/v1/sites/', { params: { project_id: projectId, ...params } }),
  get: (id) => apiClient.get(`/api/v1/sites/${id}`),
  create: (projectId, data) =>
    apiClient.post('/api/v1/sites/', data, { params: { project_id: projectId } }),
  update: (id, data) => apiClient.patch(`/api/v1/sites/${id}`, data),
  delete: (id) => apiClient.delete(`/api/v1/sites/${id}`),
}
