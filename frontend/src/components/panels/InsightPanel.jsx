import { useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analytics'
import { useMapStore } from '../../store/mapStore'

const METRIC_OPTIONS = ['ndvi', 'temperature', 'moisture']

export default function InsightPanel() {
  const selectedSiteId = useMapStore((s) => s.selectedSiteId)
  const selectedSite   = useMapStore((s) => s.selectedSite())
  const [metric, setMetric]     = useState('ndvi')
  const [insights, setInsights] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!selectedSiteId) {
      setInsights([])
      return
    }
    setLoading(true)
    setError(null)
    analyticsApi
      .getInsights(selectedSiteId, metric)
      .then(({ data }) => setInsights(data.insights ?? []))
      .catch((err) => {
        const msg = err.response?.data?.detail ?? 'Failed to load insights'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [selectedSiteId, metric])

  if (!selectedSiteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center">
        <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">Select a site on the map</p>
        <p className="text-xs text-gray-600 mt-1">to view AI-powered insights</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-700">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-brand-400 uppercase tracking-wider">Insights</p>
            <h3 className="text-sm font-semibold text-white truncate mt-0.5">
              {selectedSite?.name ?? 'Site'}
            </h3>
          </div>
          {/* Metric selector */}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="bg-surface-700 border border-surface-500 rounded-lg text-xs text-gray-300
                       px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500
                       cursor-pointer uppercase"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading && (
          <div className="flex gap-2 items-center text-sm text-gray-400 mt-2">
            <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            Analysing…
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-800/40">
            {error}
          </div>
        )}

        {!loading && !error && insights.map((text, i) => (
          <InsightCard key={i} index={i} text={text} />
        ))}

        {!loading && !error && insights.length === 0 && (
          <p className="text-xs text-gray-500 mt-2">No analytics data available for this site yet.</p>
        )}
      </div>
    </div>
  )
}

function InsightCard({ text, index }) {
  const icons = ['📊', '📈', '⚡', '🌿', '💧', '🌡️']
  const icon = icons[index % icons.length]

  return (
    <div className="flex gap-2.5 bg-surface-700/60 rounded-lg p-3 border border-surface-600 animate-slide-up">
      <span className="text-base flex-shrink-0">{icon}</span>
      <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
    </div>
  )
}
