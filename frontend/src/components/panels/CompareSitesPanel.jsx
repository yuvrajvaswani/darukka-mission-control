import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { analyticsApi } from '../../api/analytics'
import { useMapStore } from '../../store/mapStore'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Filler)

const METRICS = {
  carbon:       { label: 'Carbon Stock',      unit: 't/ha',  color: '#f59e0b' },
  biodiversity: { label: 'Biodiversity Index', unit: 'score', color: '#8b5cf6' },
  ndvi:         { label: 'NDVI',               unit: '',      color: '#1a9f76' },
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useSiteMetrics(siteId) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!siteId) { setData(null); return }
    setLoading(true)
    Promise.all(
      Object.keys(METRICS).map((m) =>
        analyticsApi
          .getTimeSeries(siteId, m)
          .then(({ data: ts }) => [m, ts.data])
          .catch(() => [m, []])
      )
    )
      .then((pairs) => setData(Object.fromEntries(pairs)))
      .finally(() => setLoading(false))
  }, [siteId])

  return { data, loading }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLatest(series) {
  return series?.[series.length - 1]?.metric_value ?? null
}
function getPctChange(series) {
  if (!series || series.length < 2) return null
  const first = series[0]?.metric_value
  const last  = series[series.length - 1]?.metric_value
  if (first == null || last == null || Math.abs(first) < 1e-9) return null
  return ((last - first) / Math.abs(first)) * 100
}
function fmt(val, key) {
  if (val == null) return '—'
  return key === 'ndvi' ? val.toFixed(3) : val.toFixed(1)
}

// ── Mini overlaid line chart ──────────────────────────────────────────────────
function MiniChart({ seriesA, seriesB, metricKey }) {
  const cfg = METRICS[metricKey]
  const base = seriesA || seriesB
  if (!base) return null

  const labels = base.map((d) =>
    new Date(d.observed_on).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  )

  const datasets = [
    seriesA && {
      data: seriesA.map((d) => d.metric_value),
      borderColor: cfg.color,
      backgroundColor: `${cfg.color}18`,
      borderWidth: 1.5,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
    },
    seriesB && {
      data: seriesB.map((d) => d.metric_value),
      borderColor: `${cfg.color}70`,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [4, 3],
      fill: false,
      tension: 0.35,
      pointRadius: 0,
    },
  ].filter(Boolean)

  return (
    <div className="h-12">
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CompareSitesPanel() {
  const sites = useMapStore((s) => s.sites)
  const [siteAId, setSiteAId] = useState('')
  const [siteBId, setSiteBId] = useState('')

  const { data: dataA, loading: loadingA } = useSiteMetrics(siteAId)
  const { data: dataB, loading: loadingB } = useSiteMetrics(siteBId)

  const siteA = sites.find((s) => s.id === siteAId)
  const siteB = sites.find((s) => s.id === siteBId)

  const rows = useMemo(() => {
    return Object.entries(METRICS).map(([key, cfg]) => {
      const latA   = getLatest(dataA?.[key])
      const latB   = getLatest(dataB?.[key])
      const pctA   = getPctChange(dataA?.[key])
      const pctB   = getPctChange(dataB?.[key])
      const delta  = latA != null && latB != null ? latA - latB : null
      return { key, cfg, latA, latB, pctA, pctB, delta }
    })
  }, [dataA, dataB])

  const isLoading = loadingA || loadingB
  const bothSelected = siteAId && siteBId

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-700 flex-shrink-0">
        <p className="text-xs text-brand-400 uppercase tracking-wider font-medium">Compare Sites</p>
        <p className="text-xs text-gray-500 mt-0.5">Side-by-side metric analysis</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Site selectors */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Site A', value: siteAId, set: setSiteAId, exclude: siteBId, accent: 'brand' },
            { label: 'Site B', value: siteBId, set: setSiteBId, exclude: siteAId, accent: 'purple' },
          ].map(({ label, value, set, exclude, accent }) => (
            <div key={label}>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1 px-1">
                {label}
              </label>
              <select
                value={value}
                onChange={(e) => set(e.target.value)}
                className={`w-full bg-surface-800 border rounded-lg text-xs text-gray-200
                           px-2 py-1.5 focus:outline-none cursor-pointer truncate
                           ${value
                             ? accent === 'brand'
                               ? 'border-brand-600/60 focus:ring-1 focus:ring-brand-500'
                               : 'border-purple-600/60 focus:ring-1 focus:ring-purple-500'
                             : 'border-surface-600 focus:ring-1 focus:ring-surface-500'}`}
              >
                <option value="">— choose —</option>
                {sites.filter((s) => s.id !== exclude).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {!bothSelected && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-700/60 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Select two sites above<br />to compare metrics side-by-side
            </p>
          </div>
        )}

        {/* Comparison content */}
        {bothSelected && (
          <>
            {/* VS banner */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 text-center bg-brand-900/30 border border-brand-800/40 rounded-lg py-1.5 px-2">
                <p className="text-xs font-semibold text-brand-400 truncate">{siteA?.name ?? 'Site A'}</p>
                {siteA?.site_type && (
                  <p className="text-[10px] text-gray-600 mt-0.5">{siteA.site_type}</p>
                )}
              </div>
              <div className="text-xs font-bold text-gray-500 flex-shrink-0">vs</div>
              <div className="flex-1 text-center bg-purple-900/30 border border-purple-800/40 rounded-lg py-1.5 px-2">
                <p className="text-xs font-semibold text-purple-400 truncate">{siteB?.name ?? 'Site B'}</p>
                {siteB?.site_type && (
                  <p className="text-[10px] text-gray-600 mt-0.5">{siteB.site_type}</p>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map(({ key, cfg, latA, latB, pctA, pctB, delta }) => (
                  <div key={key}
                    className="bg-surface-800/80 border border-surface-700/80 rounded-xl overflow-hidden backdrop-blur-sm">
                    {/* Metric header */}
                    <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cfg.color }} />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        {cfg.label}
                      </span>
                      {delta !== null && (
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
                          <span>Δ</span>
                          <span className={`font-mono font-semibold
                            ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {delta >= 0 ? '+' : ''}{fmt(delta, key)}
                            {cfg.unit ? ` ${cfg.unit}` : ''}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Side-by-side vals */}
                    <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
                      {[
                        { val: latA, pct: pctA, bg: 'bg-brand-900/25 border-brand-800/30', text: 'text-brand-300' },
                        { val: latB, pct: pctB, bg: 'bg-purple-900/25 border-purple-800/30', text: 'text-purple-300' },
                      ].map((side, si) => (
                        <div key={si} className={`p-2.5 rounded-lg border ${side.bg}`}>
                          <div className={`text-sm font-bold tabular-nums ${side.text}`}>
                            {fmt(side.val, key)}
                            {cfg.unit && (
                              <span className="text-[10px] text-gray-600 ml-0.5 font-normal">{cfg.unit}</span>
                            )}
                          </div>
                          {side.pct !== null && (
                            <div className={`text-[10px] mt-0.5 ${side.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {side.pct >= 0 ? '↑' : '↓'} {Math.abs(side.pct).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Mini overlay chart */}
                    <div className="px-3 pb-3">
                      <MiniChart
                        seriesA={dataA?.[key]}
                        seriesB={dataB?.[key]}
                        metricKey={key}
                      />
                      <div className="flex justify-end gap-4 mt-1.5">
                        <span className="flex items-center gap-1 text-[9px] text-gray-600">
                          <span className="inline-block w-5 h-px" style={{ backgroundColor: cfg.color }} />
                          {siteA?.name?.slice(0, 10) ?? 'A'}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-gray-600">
                          <span className="inline-block w-5 border-t border-dashed"
                            style={{ borderColor: `${cfg.color}70` }} />
                          {siteB?.name?.slice(0, 10) ?? 'B'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
