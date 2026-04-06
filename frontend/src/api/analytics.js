import apiClient from './client'

export const analyticsApi = {
  getTimeSeries: (siteId, metricName, params) =>
    apiClient.get(`/api/v1/analytics/site/${siteId}/timeseries`, {
      params: { metric_name: metricName, ...params },
    }),
  getInsights: (siteId, metricName) =>
    apiClient.get(`/api/v1/analytics/site/${siteId}/insights`, {
      params: { metric_name: metricName },
    }),
  listRecords: (siteId, params) =>
    apiClient.get(`/api/v1/analytics/site/${siteId}`, { params }),
  createRecord: (data) => apiClient.post('/api/v1/analytics/', data),
}
