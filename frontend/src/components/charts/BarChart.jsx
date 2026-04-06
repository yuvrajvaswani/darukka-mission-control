import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { analyticsApi } from '../../api/analytics'

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Legend, Filler
)

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111a16',
      borderColor: '#213329',
      borderWidth: 1,
      titleColor: '#9ca3af',
      bodyColor: '#f3f4f6',
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: { color: '#19261f' },
      ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 6 },
    },
    y: {
      grid: { color: '#19261f' },
      ticks: { color: '#6b7280', font: { size: 10 } },
    },
  },
}

/**
 * BarChart
 *
 * Props:
 *   siteId     {string}
 *   metricName {string}  default 'ndvi'
 */
export default function BarChart({ siteId, metricName = 'ndvi' }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    setError(null)
    analyticsApi
      .getTimeSeries(siteId, metricName)
      .then(({ data: ts }) => {
        setData({
          labels: ts.data.map((d) => d.observed_on),
          datasets: [
            {
              data:            ts.data.map((d) => d.metric_value),
              backgroundColor: 'rgba(26, 159, 118, 0.25)',
              borderColor:     '#1a9f76',
              borderWidth:     2,
              fill:            true,
              tension:         0.3,
              pointRadius:     3,
              pointBackgroundColor: '#3aba8e',
            },
          ],
        })
      })
      .catch(() => setError('No data available'))
      .finally(() => setLoading(false))
  }, [siteId, metricName])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{metricName}</p>
        <p className="text-xs text-gray-600">Time series</p>
      </div>

      <div className="h-40 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        )}
        {!loading && !error && data && (
          <Line data={data} options={CHART_OPTIONS} />
        )}
      </div>
    </div>
  )
}
