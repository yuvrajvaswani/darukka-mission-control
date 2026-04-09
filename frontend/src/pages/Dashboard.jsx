import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { projectsApi } from '../api/projects'
import { sitesApi } from '../api/sites'
import { analyticsApi } from '../api/analytics'

// ── Count-up animation hook ───────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const lastTarget = useRef(-1)
  useEffect(() => {
    if (target === lastTarget.current) return
    lastTarget.current = target
    const started = Date.now()
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - started) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setVal(Math.round(target * eased))
      if (p >= 1) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return val
}

const STATUS_BADGE = {
  active:    'badge-green',
  archived:  'badge-gray',
  completed: 'badge-yellow',
}

// ── Mini inline sparkbar ──────────────────────────────────────────────────────
function Sparkbar({ values = [], color = '#8b5cf6' }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-10 w-16 flex-shrink-0">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm opacity-80 transition-all duration-300"
          style={{
            height: `${Math.max(10, (v / max) * 100)}%`,
            backgroundColor: color,
            opacity: 0.45 + (i / values.length) * 0.55,
          }}
        />
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, change, positive, trend, sparkData, color = '#8b5cf6' }) {
  const animated = useCountUp(value)
  return (
    <div className="relative overflow-hidden bg-surface-800/80 border border-surface-600/70
                    rounded-2xl p-5 backdrop-blur-sm
                    hover:border-brand-700/50 hover:shadow-xl hover:shadow-brand-950/30
                    hover:-translate-y-0.5 transition-all duration-200 group">
      {/* subtle gradient glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      bg-gradient-to-br from-brand-900/20 to-transparent pointer-events-none rounded-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
          <p className="text-3xl font-bold text-white mt-1.5 tabular-nums">{animated}</p>
          {change != null && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium
              ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{positive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%</span>
              <span className="text-gray-600 font-normal">vs last month</span>
            </div>
          )}
          {trend && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              Trend: <span className="text-gray-400">{trend}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}25`, border: `1px solid ${color}40` }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <Sparkbar values={sparkData} color={color} />
        </div>
      </div>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onMap }) {
  const badgeClass = STATUS_BADGE[project.status] ?? 'badge-gray'
  const [insight, setInsight] = useState(null)

  useEffect(() => {
    let cancelled = false
    sitesApi.list(project.id)
      .then(({ data: sites }) => {
        if (cancelled || sites.length === 0) return null
        return analyticsApi.getInsights(sites[0].id, 'carbon')
      })
      .then((res) => {
        if (!cancelled && res?.data?.insights?.length > 0) {
          setInsight(res.data.insights[0])
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [project.id])

  return (
    <div className="group relative overflow-hidden bg-surface-800/70 border border-surface-600/60
                    rounded-2xl p-5 backdrop-blur-sm
                    hover:border-brand-600/50 hover:shadow-lg hover:shadow-brand-950/30
                    hover:-translate-y-0.5 transition-all duration-200">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                      bg-gradient-to-br from-brand-900/15 to-transparent pointer-events-none rounded-2xl" />
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <span className={`${badgeClass} flex-shrink-0`}>{project.status}</span>
      </div>

      {/* AI Insight block */}
      {insight && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-brand-900/30 border border-brand-800/40">
          <div className="flex items-start gap-1.5">
            <svg className="w-3 h-3 text-brand-400 mt-0.5 flex-shrink-0" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-[11px] text-brand-200 leading-relaxed">{insight}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mb-4">
        {new Date(project.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
      </p>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1 text-xs" onClick={onOpen}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Details
        </button>
        <button className="btn-primary flex-1 text-xs" onClick={onMap}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7" />
          </svg>
          Open Map
        </button>
      </div>
    </div>
  )
}

function EmptyState({ onNew, onSeed }) {
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState(null)

  const handleSeed = async () => {
    setSeeding(true)
    setSeedError(null)
    try {
      await onSeed()
    } catch (err) {
      setSeedError(err.response?.data?.detail ?? 'Failed to load sample data')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-700/60 border border-surface-600/40 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <p className="text-gray-300 font-medium">No projects yet</p>
      <p className="text-gray-600 text-sm mt-1 mb-5">Create your first conservation project to get started</p>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <button className="btn-primary" onClick={onNew}>Create Project</button>
        <button
          className="btn-ghost text-sm flex items-center gap-2"
          onClick={handleSeed}
          disabled={seeding}
        >
          {seeding ? (
            <span className="w-3.5 h-3.5 border border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
          {seeding ? 'Loading…' : 'Load sample data'}
        </button>
      </div>
      {seedError && (
        <p className="text-xs text-rose-400 mt-3 bg-rose-900/20 rounded-lg px-3 py-2 border border-rose-800/40 max-w-xs">
          {seedError}
        </p>
      )}
    </div>
  )
}

function ProjectsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-800/60 border border-surface-700 rounded-2xl p-5 animate-pulse">
          <div className="h-4 bg-surface-600 rounded-lg w-3/4 mb-2" />
          <div className="h-3 bg-surface-600 rounded-lg w-1/2 mb-4" />
          <div className="h-8 bg-surface-600 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function CreateProjectModal({ onCreated, onClose }) {
  const [name, setName]     = useState('')
  const [desc, setDesc]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const { data } = await projectsApi.create({ name: name.trim(), description: desc.trim() || undefined })
      onCreated(data)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-surface-800/95 border border-surface-600/80 rounded-2xl shadow-2xl
                      shadow-black/50 animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <h2 className="text-base font-semibold text-white">New Project</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="label">Project Name *</label>
            <input className="input" placeholder="e.g. Amazon Deforestation Watch"
              value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} autoFocus />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} placeholder="Optional description…"
              value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
          </div>
          {error && (
            <p className="text-xs text-rose-400 bg-rose-900/20 rounded-lg px-3 py-2 border border-rose-800/40">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [projects, setProjects]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    projectsApi.list()
      .then(({ data }) => setProjects(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = (project) => {
    setProjects((prev) => [project, ...prev])
    setShowCreate(false)
  }

  const handleSeed = async () => {
    const { data } = await projectsApi.seedDemo()
    setProjects(data)
  }

  const counts = useMemo(() => ({
    total:     projects.length,
    active:    projects.filter((p) => p.status === 'active').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    archived:  projects.filter((p) => p.status === 'archived').length,
  }), [projects])

  // deterministic sparkbar data seeded from project counts
  const spark = (seed, n = 7) =>
    Array.from({ length: n }, (_, i) => Math.max(1, Math.round((seed + i * 1.7 + (i % 3)) * 1.4)))

  const stats = [
    {
      label: 'Total Projects',
      value: counts.total,
      change: 12.0,
      positive: true,
      trend: 'Increasing',
      color: '#8b5cf6',
      sparkData: spark(counts.total * 5 + 3),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Active Projects',
      value: counts.active,
      change: 8.3,
      positive: true,
      trend: 'Stable',
      color: '#10b981',
      sparkData: spark(counts.active * 7 + 2),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      value: counts.completed,
      change: 5.5,
      positive: true,
      trend: 'Increasing',
      color: '#f59e0b',
      sparkData: spark(counts.completed * 9 + 1),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Archived',
      value: counts.archived,
      change: 3.1,
      positive: false,
      trend: 'Decreasing',
      color: '#f43f5e',
      sparkData: spark(counts.archived * 6 + 4),
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">

      {/* ── Welcome header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest">Mission Control</p>
        <h1 className="text-2xl font-bold text-white mt-1">
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ── Projects header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Projects</h2>
          <p className="text-xs text-gray-600 mt-0.5">{projects.length} total</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {loading ? (
        <ProjectsSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState onNew={() => setShowCreate(true)} onSeed={handleSeed} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate(`/projects/${p.id}`)}
              onMap={() => navigate(`/projects/${p.id}/map`)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal onCreated={handleCreated} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
