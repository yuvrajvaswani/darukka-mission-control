import { useEffect, useMemo, useState } from 'react'
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
import { Line, Bar } from 'react-chartjs-2'
import { analyticsApi } from '../../api/analytics'
import { useMapStore } from '../../store/mapStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler)

// ── Metric config ─────────────────────────────────────────────────────────────
const METRICS = {
  carbon: {
    label: 'Carbon Stock',
    unit: 't/ha',
    color: '#f59e0b',
    fill: 'rgba(245,158,11,0.12)',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  biodiversity: {
    label: 'Biodiversity Index',
    unit: 'score',
    color: '#8b5cf6',
    fill: 'rgba(139,92,246,0.12)',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  ndvi: {
    label: 'NDVI',
    unit: '',
    color: '#1a9f76',
    fill: 'rgba(26,159,118,0.12)',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
}

const MAX_NORMALISE = { carbon: 150, biodiversity: 100, ndvi: 1 }

// ── Executive summary computation ─────────────────────────────────────────────
function buildExecSummary(allSeries, siteName) {
  const trends = []
  const risks = []
  const recommendations = []

  for (const [metricKey, series] of Object.entries(allSeries)) {
    if (!series || series.length < 2) continue
    const cfg    = METRICS[metricKey]
    const latest = series[series.length - 1]?.metric_value
    const first  = series[0]?.metric_value
    const pct    = first && Math.abs(first) > 1e-9 ? ((latest - first) / Math.abs(first)) * 100 : 0
    const last3  = series.slice(-3).map((d) => d.metric_value)
    const isPlateauing =
      last3.length >= 3 &&
      last3.every((v) => Math.abs(v - last3[0]) / (Math.abs(last3[0]) || 1) < 0.03)

    trends.push({
      key: metricKey,
      label: cfg.label,
      latest,
      unit: cfg.unit,
      pct: pct.toFixed(1),
      positive: pct >= 0,
      color: cfg.color,
      plateauing: isPlateauing,
    })

    if (metricKey === 'carbon' && latest < 50)
      risks.push({ icon: '🔴', text: `Carbon stock critically low at ${latest.toFixed(1)} t/ha — immediate intervention required.` })
    else if (metricKey === 'carbon' && pct < -5)
      risks.push({ icon: '🟡', text: `Carbon declining ${Math.abs(pct).toFixed(1)}% — reforestation action recommended.` })

    if (metricKey === 'biodiversity' && latest < 40)
      risks.push({ icon: '🔴', text: `Biodiversity index critically low (${latest.toFixed(1)}) — urgent habitat restoration needed.` })
    else if (isPlateauing && metricKey === 'biodiversity')
      risks.push({ icon: '🟡', text: `Biodiversity plateau detected over last 3 months — ecosystem growth has stalled.` })

    if (metricKey === 'ndvi' && latest < 0.3)
      risks.push({ icon: '🟡', text: `NDVI at ${latest.toFixed(3)} indicates sparse vegetation cover — monitor closely.` })

    if (metricKey === 'carbon' && pct > 5)
      recommendations.push(`Maintain current carbon sequestration programme — ${Math.abs(pct).toFixed(1)}% growth on track.`)
    else if (metricKey === 'carbon' && pct < -3)
      recommendations.push(`Expand native tree planting across ${siteName ?? 'the site'} to reverse carbon decline.`)

    if (metricKey === 'biodiversity' && pct < 0)
      recommendations.push('Introduce corridor plantings and micro-habitats to boost species diversity.')
    else if (metricKey === 'biodiversity' && pct > 3)
      recommendations.push(`Biodiversity recovering well (+${pct.toFixed(1)}%) — consider expanding buffer zones.`)

    if (metricKey === 'ndvi' && latest > 0.6)
      recommendations.push(`High NDVI (${latest.toFixed(3)}) signals dense canopy — assess fire management protocols.`)
  }

  if (risks.length === 0)
    risks.push({ icon: '🟢', text: 'No critical risk conditions detected — all metrics within healthy range.' })
  if (recommendations.length === 0)
    recommendations.push('Continue the current conservation programme — site performing within expected parameters.')

  return { trends, risks, recommendations }
}

// ── Linear regression extrapolation ──────────────────────────────────────────
function computeProjection(series) {
  if (!series || series.length < 3) return null
  const n     = Math.min(8, series.length)
  const tail  = series.slice(-n)
  const ys    = tail.map((d) => d.metric_value)
  const meanX = (n - 1) / 2
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (i - meanX) * (ys[i] - meanY); den += (i - meanX) ** 2 }
  const slope     = den !== 0 ? num / den : 0
  const intercept = meanY - slope * meanX
  const lastDate  = series[series.length - 1].observed_on.slice(0, 7)
  const [lastY, lastM] = lastDate.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(lastY, lastM - 1 + i + 1, 1)
    return {
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: Math.max(0, intercept + slope * (n - 1 + i + 1)),
    }
  })
}

// ── Chart options ─────────────────────────────────────────────────────────────
function makeChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d1f18',
        borderColor: '#1e3328',
        borderWidth: 1,
        titleColor: '#9ca3af',
        bodyColor: '#f9fafb',
        padding: 10,
        cornerRadius: 8,
        filter: (item) => item.raw !== null,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 7 } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 } } },
    },
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`bg-surface-700/60 rounded-lg animate-pulse ${className}`} />
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({ siteId, metricKey }) {
  const cfg      = METRICS[metricKey]
  const [series, setSeries]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [showSimul, setShowSimul] = useState(false)
  const timelineDate = useMapStore((s) => s.timelineDate)

  const activeIdx = useMemo(() => {
    if (!timelineDate || !series) return -1
    return series.findIndex((d) => d.observed_on.slice(0, 7) === timelineDate)
  }, [timelineDate, series])

  useEffect(() => {
    if (!siteId) return
    setLoading(true); setError(null); setShowSimul(false)
    analyticsApi
      .getTimeSeries(siteId, metricKey)
      .then(({ data: ts }) => setSeries(ts.data))
      .catch(() => setError('No data available'))
      .finally(() => setLoading(false))
  }, [siteId, metricKey])

  const projection = useMemo(
    () => (showSimul ? computeProjection(series) : null),
    [showSimul, series],
  )

  const latest    = series?.[series.length - 1]?.metric_value
  const first     = series?.[0]?.metric_value
  const pctChange =
    first != null && latest != null && Math.abs(first) > 1e-9
      ? (((latest - first) / Math.abs(first)) * 100).toFixed(1)
      : null

  const chartData = useMemo(() => {
    if (!series) return null
    const histLabels = series.map((d) =>
      new Date(d.observed_on).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    )
    const projLabels = projection ? projection.map((p) => p.label) : []
    const allLabels  = [...histLabels, ...projLabels]
    const nullPad    = projLabels.map(() => null)
    const zeroPad    = projLabels.map(() => 0)

    const historicalDataset = {
      data: [...series.map((d) => d.metric_value), ...nullPad],
      borderColor: cfg.color,
      backgroundColor: cfg.fill,
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      spanGaps: false,
      pointRadius: [
        ...series.map((_, i) => (activeIdx >= 0 ? (i === activeIdx ? 7 : 1.5) : 2)),
        ...zeroPad,
      ],
      pointHoverRadius: [
        ...series.map((_, i) => (i === activeIdx ? 9 : 5)),
        ...zeroPad,
      ],
      pointBackgroundColor: [
        ...series.map((_, i) => (i === activeIdx ? '#ffffff' : cfg.color)),
        ...nullPad,
      ],
      pointBorderColor: [
        ...series.map((_, i) => (i === activeIdx ? cfg.color : 'transparent')),
        ...nullPad,
      ],
      pointBorderWidth: [...series.map((_, i) => (i === activeIdx ? 2 : 0)), ...zeroPad],
    }

    const datasets = [historicalDataset]

    if (projection) {
      const n = series.length
      const forecastData = [
        ...series.map((_, i) => (i === n - 1 ? series[n - 1].metric_value : null)),
        ...projection.map((p) => p.value),
      ]
      datasets.push({
        label: 'Forecast',
        data: forecastData,
        borderColor: `${cfg.color}90`,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 4],
        fill: false,
        tension: 0.3,
        spanGaps: true,
        pointRadius: forecastData.map((_, i) => (i >= n ? 3 : 0)),
        pointHoverRadius: forecastData.map((_, i) => (i >= n ? 5 : 0)),
        pointBackgroundColor: `${cfg.color}90`,
      })
    }

    return { labels: allLabels, datasets }
  }, [series, projection, activeIdx, cfg])

  return (
    <div className="bg-surface-800/80 border border-surface-700/80 rounded-xl overflow-hidden
                    backdrop-blur-sm hover:border-surface-600 transition-colors duration-200">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{cfg.label}</span>
        </div>
        {!loading && !error && pctChange !== null && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full
            ${parseFloat(pctChange) >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {parseFloat(pctChange) >= 0 ? '↑' : '↓'} {Math.abs(pctChange)}%
          </span>
        )}
      </div>
      {/* Latest value */}
      {!loading && !error && latest != null && (
        <div className="px-4 pb-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-white" style={{ textShadow: `0 0 20px ${cfg.color}40` }}>
            {metricKey === 'ndvi' ? latest.toFixed(3) : latest.toFixed(1)}
          </span>
          {cfg.unit && <span className="text-xs text-gray-500">{cfg.unit}</span>}
          <span className="text-xs text-gray-600 ml-1">latest</span>
        </div>
      )}
      {/* Timeline callout */}
      {!loading && !error && activeIdx >= 0 && series?.[activeIdx] != null && (
        <div key={timelineDate} className="px-4 pb-2 flex items-center gap-2 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-xs text-gray-500">
            {new Date(timelineDate + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}:
          </span>
          <span className="text-xs font-semibold text-white tabular-nums">
            {metricKey === 'ndvi'
              ? series[activeIdx].metric_value.toFixed(3)
              : series[activeIdx].metric_value.toFixed(1)}
          </span>
          {cfg.unit && <span className="text-xs text-gray-600">{cfg.unit}</span>}
        </div>
      )}
      {/* Chart */}
      <div className="px-3 pb-2">
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: cfg.color, borderTopColor: 'transparent' }} />
          </div>
        ) : error ? (
          <div className="h-32 flex items-center justify-center">
            <p className="text-xs text-gray-600">{error}</p>
          </div>
        ) : (
          <div className={showSimul ? 'h-40' : 'h-32'}>
            <Line data={chartData} options={makeChartOptions()} />
          </div>
        )}
      </div>
      {/* Predict button */}
      {!loading && !error && series && series.length >= 3 && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowSimul((s) => !s)}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                       text-xs font-medium transition-all duration-150 border
                       ${showSimul
                         ? 'bg-brand-600/20 border-brand-500/40 text-brand-400 hover:bg-brand-600/30'
                         : 'bg-surface-700/60 border-surface-600/60 text-gray-400 hover:text-gray-200 hover:bg-surface-700'}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {showSimul ? 'Hide forecast' : 'Predict next 6 months'}
          </button>
          {showSimul && (
            <p className="text-center text-[10px] text-gray-600 mt-1.5">
              Linear trend extrapolation · indicative only
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── SnapshotCard ──────────────────────────────────────────────────────────────
function SnapshotCard({ siteId }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    Promise.all(
      Object.keys(METRICS).map((m) =>
        analyticsApi.getTimeSeries(siteId, m).then(({ data: ts }) => ({
          metric: m,
          value: ts.data[ts.data.length - 1]?.metric_value ?? 0,
        }))
      )
    ).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [siteId])

  const chartData = data
    ? {
        labels: data.map((d) => METRICS[d.metric].label),
        datasets: [{
          data: data.map((d) => Math.min(100, (d.value / (MAX_NORMALISE[d.metric] || 1)) * 100).toFixed(1)),
          backgroundColor: data.map((d) => `${METRICS[d.metric].color}99`),
          borderColor: data.map((d) => METRICS[d.metric].color),
          borderWidth: 1.5,
          borderRadius: 6,
        }],
      }
    : null

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d1f18', borderColor: '#1e3328', borderWidth: 1,
        titleColor: '#9ca3af', bodyColor: '#f9fafb', padding: 10, cornerRadius: 8,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 }, callback: (v) => `${v}%` }, max: 110 },
    },
  }

  return (
    <div className="bg-surface-800/80 border border-surface-700/80 rounded-xl overflow-hidden backdrop-blur-sm">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Current Snapshot</span>
        <span className="text-xs text-gray-600 ml-1">normalised %</span>
      </div>
      <div className="px-3 pb-4">
        {loading ? (
          <div className="h-28 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData ? (
          <div className="h-28"><Bar data={chartData} options={barOpts} /></div>
        ) : null}
      </div>
    </div>
  )
}

// ── Insights ──────────────────────────────────────────────────────────────────
const INSIGHT_ICONS = ['💡', '📈', '🌿', '⚠️', '🔬']

function InsightRow({ text, index }) {
  return (
    <div className="flex gap-3 p-3 bg-surface-700/40 rounded-lg border border-surface-600/40
                    hover:border-surface-500/60 transition-colors duration-150">
      <span className="text-base flex-shrink-0 mt-0.5">{INSIGHT_ICONS[index % INSIGHT_ICONS.length]}</span>
      <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
    </div>
  )
}

function InsightsBlock({ siteId, metric }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    analyticsApi
      .getInsights(siteId, metric)
      .then(({ data }) => setInsights(data.insights ?? []))
      .catch(() => setInsights([]))
      .finally(() => setLoading(false))
  }, [siteId, metric])

  if (loading)
    return (
      <div className="px-4 pb-4 space-y-2">
        <Skeleton className="h-12" /><Skeleton className="h-12" />
      </div>
    )
  if (insights.length === 0)
    return <p className="px-4 pb-4 text-xs text-gray-600">No insights available.</p>
  return (
    <div className="px-4 pb-4 space-y-2">
      {insights.map((t, i) => <InsightRow key={i} text={t} index={i} />)}
    </div>
  )
}

// ── Executive Summary Card ────────────────────────────────────────────────────
function ExecSummaryCard({ siteId, siteName }) {
  const [allSeries, setAllSeries] = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    Promise.all(
      Object.keys(METRICS).map((m) =>
        analyticsApi
          .getTimeSeries(siteId, m)
          .then(({ data: ts }) => [m, ts.data])
          .catch(() => [m, []])
      )
    )
      .then((pairs) => setAllSeries(Object.fromEntries(pairs)))
      .finally(() => setLoading(false))
  }, [siteId])

  const summary = useMemo(
    () => (allSeries ? buildExecSummary(allSeries, siteName) : null),
    [allSeries, siteName],
  )

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <Skeleton className="h-28" /><Skeleton className="h-36" /><Skeleton className="h-24" />
      </div>
    )
  }
  if (!summary) return null

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Key Metrics */}
      <div className="bg-gradient-to-br from-surface-800/90 to-surface-900/90 border border-surface-700/80
                      rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-surface-700/60">
          <span className="text-sm">📊</span>
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Key Metrics</span>
        </div>
        <div className="p-3 space-y-2">
          {summary.trends.map((t) => (
            <div key={t.key} className="flex items-center justify-between px-3 py-2
                                        bg-surface-700/30 rounded-lg border border-surface-600/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-xs text-gray-400">{t.label}</span>
                {t.plateauing && (
                  <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1 py-0.5 rounded">plateau</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white tabular-nums">
                  {t.key === 'ndvi' ? Number(t.latest).toFixed(3) : Number(t.latest).toFixed(1)}
                  {t.unit ? ` ${t.unit}` : ''}
                </span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full
                  ${t.positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {t.positive ? '↑' : '↓'} {Math.abs(t.pct)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Signals */}
      <div className="bg-gradient-to-br from-surface-800/90 to-surface-900/90 border border-surface-700/80
                      rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-surface-700/60">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Risk Signals</span>
        </div>
        <div className="p-3 space-y-2">
          {summary.risks.map((r, i) => (
            <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-surface-700/20 border border-surface-600/30">
              <span className="text-sm flex-shrink-0 mt-0.5">{r.icon}</span>
              <p className="text-xs text-gray-300 leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-brand-900/30 to-surface-900/90 border border-brand-800/40
                      rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-brand-800/30">
          <span className="text-sm">🎯</span>
          <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">Recommendations</span>
        </div>
        <div className="p-3 space-y-2">
          {summary.recommendations.map((rec, i) => (
            <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-brand-900/20 border border-brand-800/20">
              <span className="text-xs text-brand-400 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
              <p className="text-xs text-gray-300 leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function SiteAnalyticsPanel() {
  const selectedSiteId = useMapStore((s) => s.selectedSiteId)
  const selectedSite   = useMapStore((s) => s.selectedSite())
  const [insightMetric, setInsightMetric] = useState('carbon')
  const [mode, setMode] = useState('analytics') // 'analytics' | 'summary'

  if (!selectedSiteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-surface-700 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">Select a site</p>
          <p className="text-xs text-gray-600 mt-1">to view analytics &amp; insights</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-700 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-brand-400 uppercase tracking-wider font-medium">Analytics</p>
            <h3 className="text-sm font-semibold text-white mt-0.5 truncate">{selectedSite?.name ?? 'Site'}</h3>
            {selectedSite?.site_type && (
              <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium
                ${selectedSite.site_type === 'monitoring' ? 'bg-brand-500/15 text-brand-400'
                  : selectedSite.site_type === 'exclusion' ? 'bg-red-500/15 text-red-400'
                  : 'bg-gray-500/15 text-gray-400'}`}>
                {selectedSite.site_type}
              </span>
            )}
          </div>
          {/* Executive Summary toggle */}
          <button
            onClick={() => setMode((m) => (m === 'analytics' ? 'summary' : 'analytics'))}
            title={mode === 'analytics' ? 'Executive Summary' : 'Back to Analytics'}
            className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5
                        rounded-lg border transition-all duration-150 whitespace-nowrap
                        ${mode === 'summary'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-surface-700 border-surface-600 text-gray-400 hover:text-gray-200 hover:bg-surface-600'}`}
          >
            <span>🧾</span>
            <span>{mode === 'summary' ? 'Analytics' : 'Summary'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {mode === 'summary' ? (
          <ExecSummaryCard siteId={selectedSiteId} siteName={selectedSite?.name} />
        ) : (
          <>
            <SnapshotCard siteId={selectedSiteId} />
            <MetricCard siteId={selectedSiteId} metricKey="carbon" />
            <MetricCard siteId={selectedSiteId} metricKey="biodiversity" />
            <MetricCard siteId={selectedSiteId} metricKey="ndvi" />
            {/* Insights */}
            <div className="bg-surface-800/80 border border-surface-700/80 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Insights</span>
                </div>
                <select
                  value={insightMetric}
                  onChange={(e) => setInsightMetric(e.target.value)}
                  className="bg-surface-700 border border-surface-600 rounded-lg text-xs text-gray-300
                             px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  {Object.entries(METRICS).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <InsightsBlock siteId={selectedSiteId} metric={insightMetric} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
