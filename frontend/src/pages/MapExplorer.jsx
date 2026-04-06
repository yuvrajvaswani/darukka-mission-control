import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import { projectsApi } from '../api/projects'
import { sitesApi } from '../api/sites'
import { useMapStore } from '../store/mapStore'
import MapView from '../components/map/MapView'
import DrawControls, { triggerDraw } from '../components/map/DrawControls'
import SaveSiteModal from '../components/map/SaveSiteModal'
import SiteList from '../components/map/SiteMarker'
import SiteAnalyticsPanel from '../components/panels/SiteAnalyticsPanel'
import CompareSitesPanel from '../components/panels/CompareSitesPanel'
import TimelineSlider from '../components/charts/TimelineSlider'
import Navbar from '../components/layout/Navbar'

const PANEL = { SITES: 'sites', ANALYTICS: 'analytics', COMPARE: 'compare' }

export default function MapExplorer() {
  const { projectId } = useParams()
  const navigate       = useNavigate()

  const [project, setProject]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [panel, setPanel]       = useState(PANEL.SITES)
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [uploadedLayers, setUploadedLayers] = useState([])
  const uploadInputRef = useRef(null)

  const setSites    = useMapStore((s) => s.setSites)
  const drawMode    = useMapStore((s) => s.drawMode)
  const selectedSiteId = useMapStore((s) => s.selectedSiteId)

  // Load project + sites
  useEffect(() => {
    Promise.all([
      projectsApi.get(projectId),
      sitesApi.list(projectId),
    ])
      .then(([{ data: proj }, { data: sites }]) => {
        setProject(proj)
        setSites(sites)
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))

    return () => {
      // Clean up global map ref on unmount
      window.__darukaMap = undefined
      useMapStore.getState().setSites([])
      useMapStore.getState().setSelectedSiteId(null)
    }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when map style loads
  useEffect(() => {
    const interval = setInterval(() => {
      const map = window.__darukaMap
      if (map?.isStyleLoaded()) {
        setMapReady(true)
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // Auto-switch panel when site is selected
  useEffect(() => {
    if (selectedSiteId) setPanel(PANEL.ANALYTICS)
  }, [selectedSiteId])

  const handleUploadGeoJSON = useCallback((e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result)
        let features = raw.type === 'FeatureCollection' ? raw.features
          : raw.type === 'Feature' ? [raw] : []
        features = features.filter(
          (f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
        )
        if (features.length === 0) return
        const map = window.__darukaMap
        if (!map?.getStyle()) return
        const sourceId = `upload-${Date.now()}`
        const layerId  = `${sourceId}-fill`
        const lineId   = `${sourceId}-line`
        map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
        map.addLayer({ id: layerId, type: 'fill',   source: sourceId,
          paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.35 } })
        map.addLayer({ id: lineId,  type: 'line',   source: sourceId,
          paint: { 'line-color': '#818cf8', 'line-width': 2, 'line-opacity': 0.9 } })
        const pts = features.flatMap((f) => {
          const rings = f.geometry.type === 'Polygon'
            ? f.geometry.coordinates
            : f.geometry.coordinates.flat()
          return rings[0] ?? []
        })
        if (pts.length > 0) {
          const lngs = pts.map((p) => p[0])
          const lats  = pts.map((p) => p[1])
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, duration: 1000 }
          )
        }
        setUploadedLayers((prev) => [
          ...prev,
          { id: sourceId, layerId, lineId,
            name: file.name.replace(/\.geojson?$/i, ''),
            count: features.length },
        ])
      } catch { /* invalid JSON or map not ready */ }
    }
    reader.readAsText(file)
  }, [])

  const dismissLayer = useCallback((layer) => {
    const map = window.__darukaMap
    if (map?.getStyle()) {
      try { map.removeLayer(layer.layerId) } catch { /* ok */ }
      try { map.removeLayer(layer.lineId)  } catch { /* ok */ }
      try { map.removeSource(layer.id)     } catch { /* ok */ }
    }
    setUploadedLayers((prev) => prev.filter((l) => l.id !== layer.id))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-900">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface-900 overflow-hidden">
      <Navbar projectName={project?.name} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside
          className={`
            flex-shrink-0 transition-all duration-200 ease-in-out
            bg-surface-800/95 border-r border-surface-700/80
            flex flex-col overflow-hidden
            ${sidebarOpen ? 'w-80' : 'w-0'}
          `}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar tabs */}
              <div className="flex border-b border-surface-700/80">
                {[
                  { key: PANEL.SITES,     label: 'Sites' },
                  { key: PANEL.ANALYTICS, label: 'Analytics' },
                  { key: PANEL.COMPARE,   label: 'Compare' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPanel(key)}
                    className={`flex-1 py-3 text-xs font-medium transition-colors duration-100 border-b-2
                      ${
                        panel === key
                          ? 'border-brand-500 text-brand-400 bg-brand-950/20'
                          : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-surface-700/40'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-y-auto">
                {panel === PANEL.SITES     && <SiteList />}
                {panel === PANEL.ANALYTICS && <SiteAnalyticsPanel />}
                {panel === PANEL.COMPARE   && <CompareSitesPanel />}
              </div>
            </>
          )}
        </aside>

        {/* ── Map area ───────────────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-hidden">
          <MapView projectId={projectId} />

          {/* DrawControls (no DOM, just effects) */}
          <DrawControls mapReady={mapReady} />

          {/* Toolbar overlay */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            {/* Toggle sidebar */}
            <MapButton
              onClick={() => setSidebarOpen((o) => !o)}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={sidebarOpen ? 'M11 19l-7-7 7-7M18 19l-7-7 7-7' : 'M13 5l7 7-7 7M6 5l7 7-7 7'} />
              </svg>
            </MapButton>
          </div>

          {/* GeoJSON upload input (hidden) */}
          <input
            ref={uploadInputRef}
            type="file"
            accept=".geojson,.json,application/geo+json"
            className="hidden"
            onChange={handleUploadGeoJSON}
          />

          {/* Draw + Upload buttons */}
          <div className="absolute top-4 right-16 flex gap-2 z-10">
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
                         border shadow-xl backdrop-blur-md transition-all duration-150
                         bg-surface-800/95 border-surface-600/80 text-gray-200 hover:bg-surface-700
                         hover:border-brand-600/50"
              title="Upload GeoJSON polygons"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </button>
            <button
              onClick={triggerDraw}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                border shadow-xl backdrop-blur-md transition-all duration-150
                ${drawMode === 'drawing'
                  ? 'bg-brand-600 border-brand-500 text-white shadow-brand-900/50'
                  : 'bg-surface-800/95 border-surface-600/80 text-gray-200 hover:bg-surface-700 hover:border-brand-600/50'}
              `}
              title="Draw polygon site"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 3l14 9-7 2-2 7L5 3z" />
              </svg>
              {drawMode === 'drawing' ? 'Drawing…' : 'Draw Site'}
            </button>
          </div>

          {/* Draw mode hint */}
          {drawMode === 'drawing' && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
              <div className="bg-surface-800/95 border border-surface-600 rounded-full px-4 py-2 text-xs text-gray-300 shadow-xl backdrop-blur-sm">
                Click to add vertices · Double-click to close polygon · <kbd className="font-mono bg-surface-700 px-1 rounded">Esc</kbd> to cancel
              </div>
            </div>
          )}

          {/* Uploaded GeoJSON layer badges */}
          {uploadedLayers.length > 0 && (
            <div className="absolute bottom-20 right-4 z-10 flex flex-col gap-2">
              {uploadedLayers.map((layer) => (
                <div key={layer.id}
                  className="flex items-center gap-2 bg-surface-800/95 border border-indigo-500/30
                             backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg animate-fade-in">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300 max-w-[110px] truncate">{layer.name}</span>
                  <span className="text-xs text-indigo-400 flex-shrink-0">{layer.count} feat.</span>
                  <button
                    onClick={() => dismissLayer(layer)}
                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove layer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Timeline slider */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              <TimelineSlider />
            </div>
          </div>
        </div>
      </div>

      {/* Save site modal (outside map to avoid z-index issues) */}
      <SaveSiteModal projectId={projectId} />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MapButton({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-9 h-9 flex items-center justify-center
                 bg-surface-800/95 border border-surface-600/80 rounded-xl
                 text-gray-400 hover:text-white hover:bg-surface-700
                 shadow-xl shadow-black/30 backdrop-blur-md transition-all duration-100
                 hover:border-brand-600/50"
    >
      {children}
    </button>
  )
}


