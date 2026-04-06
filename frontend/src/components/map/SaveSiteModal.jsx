import { useState, useEffect, useRef } from 'react'
import { sitesApi } from '../../api/sites'
import { useMapStore } from '../../store/mapStore'

/**
 * SaveSiteModal
 *
 * Slides up after the user finishes drawing a polygon.
 * Sends the GeoJSON polygon + metadata to the backend.
 *
 * Props:
 *   projectId  {string}
 */
export default function SaveSiteModal({ projectId }) {
  const pendingGeometry = useMapStore((s) => s.pendingGeometry)
  const clearPending    = useMapStore((s) => s.clearPending)
  const addSite         = useMapStore((s) => s.addSite)

  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [type, setType]         = useState('general')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const nameRef                 = useRef(null)

  const isOpen = pendingGeometry !== null

  // Auto-focus name on open
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDesc('')
      setType('general')
      setError(null)
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') clearPending() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clearPending])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)
    try {
      const { data: site } = await sitesApi.create(projectId, {
        name:        name.trim(),
        description: desc.trim() || undefined,
        site_type:   type,
        geometry:    pendingGeometry,
      })
      addSite(site)
      clearPending()
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Failed to save site'
      setError(Array.isArray(msg) ? msg[0]?.msg ?? 'Validation error' : msg)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) clearPending() }}
    >
      {/* Sheet */}
      <div className="w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <div>
            <h2 className="text-base font-semibold text-white">Save New Site</h2>
            <p className="text-xs text-gray-400 mt-0.5">Polygon captured — add details to save</p>
          </div>
          <button
            onClick={clearPending}
            className="p-1.5 rounded-lg hover:bg-surface-700 text-gray-400 hover:text-white transition-colors"
            aria-label="Cancel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Geometry preview badge */}
          <div className="flex items-center gap-2 text-xs text-brand-400 bg-brand-950 border border-brand-800 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            GeoJSON polygon ({pendingGeometry?.coordinates?.[0]?.length - 1 ?? 0} vertices)
          </div>

          {/* Name */}
          <div>
            <label className="label" htmlFor="site-name">Site Name *</label>
            <input
              ref={nameRef}
              id="site-name"
              className="input"
              placeholder="e.g. Northern Wetland Zone"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
            />
          </div>

          {/* Type */}
          <div>
            <label className="label" htmlFor="site-type">Type</label>
            <select
              id="site-type"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="general">General</option>
              <option value="monitoring">Monitoring</option>
              <option value="exclusion">Exclusion Zone</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="label" htmlFor="site-desc">Description</label>
            <textarea
              id="site-desc"
              className="input resize-none"
              rows={3}
              placeholder="Optional notes about this site…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={2000}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 border border-red-800/40">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={clearPending}
              className="btn-ghost flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saving || !name.trim()}
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : 'Save Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
