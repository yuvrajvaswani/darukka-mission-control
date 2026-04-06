import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { useMapStore } from '../../store/mapStore'

// ── Layer IDs (constants prevent typos) ─────────────────────────────────────
const LAYER_SITES_FILL   = 'sites-fill'
const LAYER_SITES_LINE   = 'sites-line'
const LAYER_SITES_HOVER  = 'sites-hover'
const SOURCE_SITES       = 'sites-source'

// Token is read exclusively from the VITE_MAPBOX_TOKEN environment variable.
// Set it in frontend/.env (local, gitignored) or as an env var on Vercel.
// NEVER hardcode a token here.
const _token = import.meta.env.VITE_MAPBOX_TOKEN
if (!_token || _token === 'PASTE_YOUR_NEW_MAPBOX_TOKEN_HERE' || _token.startsWith('pk.your')) {
  console.error(
    '[MapView] VITE_MAPBOX_TOKEN is not set.\n' +
    'Add it to frontend/.env — see frontend/.env.example for instructions.'
  )
}
mapboxgl.accessToken = _token ?? ''

// ── Timeline helpers (module-level, no hooks) ────────────────────────────────
const TIMELINE_MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - (23 - i))
  return d.toISOString().slice(0, 7)
})

function computeVitality(siteId, monthIndex) {
  const seed = parseInt(siteId.replace(/-/g, '').slice(-8), 16) % 10000
  const base     = 0.12 + (seed % 300) / 2000
  const seasonal = 0.12 * Math.sin((monthIndex / 12) * 2 * Math.PI + (seed % 628) / 100)
  const micro    = 0.03 * Math.sin((monthIndex / 3)  * 2 * Math.PI + (seed % 314) / 50)
  return Math.max(0.06, Math.min(0.5, base + seasonal + micro))
}

/**
 * MapView
 *
 * Props:
 *   projectId  {string}   — current project (used to scope sites)
 *   onSiteClick {fn}      — called with site object when a polygon is clicked
 *   className  {string}
 */
export default function MapView({ projectId, onSiteClick, className = '' }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const hoveredId    = useRef(null)

  const sites            = useMapStore((s) => s.sites)
  const setSelectedSiteId = useMapStore((s) => s.setSelectedSiteId)
  const timelineDate      = useMapStore((s) => s.timelineDate)

  // ── Initialize map once ────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return
    if (!mapboxgl.accessToken) return   // guard already logged above at module load

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 2.5,
      projection: 'globe',
      pitchWithRotate: false,
      attributionControl: false,
    })

    // Controls
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right'
    )
    map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Fog (globe atmosphere)
    map.current.on('style.load', () => {
      map.current.setFog({
        color: 'rgb(10, 10, 22)',
        'high-color': 'rgb(60, 40, 140)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(5, 5, 20)',
        'star-intensity': 0.7,
      })
      _addSiteLayers()
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-sync sites GeoJSON source whenever `sites` changes ─────────────────
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    _syncSitesSource()
  }, [sites]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal helpers ───────────────────────────────────────────────────────
  const _buildGeoJSON = useCallback(() => ({
    type: 'FeatureCollection',
    features: sites
      .filter((s) => s.geometry)
      .map((s) => ({
        type: 'Feature',
        id: s.id,           // used for feature-state hover
        properties: {
          id:          s.id,
          name:        s.name,
          site_type:   s.site_type,
          description: s.description,
        },
        geometry: s.geometry,   // already a GeoJSON Polygon from the API
      })),
  }), [sites])

  const _syncSitesSource = useCallback(() => {
    const geojson = _buildGeoJSON()
    if (map.current.getSource(SOURCE_SITES)) {
      map.current.getSource(SOURCE_SITES).setData(geojson)
    }
  }, [_buildGeoJSON])

  const _addSiteLayers = () => {
    // GeoJSON source
    map.current.addSource(SOURCE_SITES, {
      type: 'geojson',
      data: _buildGeoJSON(),
      // Enable feature-state for hover highlighting
      promoteId: 'id',
    })

    // Translucent fill layer
    map.current.addLayer({
      id: LAYER_SITES_FILL,
      type: 'fill',
      source: SOURCE_SITES,
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'site_type'], 'monitoring'], '#1a9f76',
          ['==', ['get', 'site_type'], 'exclusion'],  '#ef4444',
          '#3aba8e', // default: general
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 0.65,
          ['coalesce', ['feature-state', 'vitality'], 0.2],
        ],
      },
    })

    // Crisp border line layer
    map.current.addLayer({
      id: LAYER_SITES_LINE,
      type: 'line',
      source: SOURCE_SITES,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'site_type'], 'monitoring'], '#1a9f76',
          ['==', ['get', 'site_type'], 'exclusion'],  '#ef4444',
          '#3aba8e',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 2.5,
          1.5,
        ],
        'line-opacity': 0.9,
      },
    })

    // ── Hover interactions ──────────────────────────────────────────────────
    map.current.on('mousemove', LAYER_SITES_FILL, (e) => {
      if (e.features.length === 0) return
      map.current.getCanvas().style.cursor = 'pointer'

      const id = e.features[0].id
      if (hoveredId.current !== null && hoveredId.current !== id) {
        map.current.setFeatureState(
          { source: SOURCE_SITES, id: hoveredId.current },
          { hover: false }
        )
      }
      hoveredId.current = id
      map.current.setFeatureState(
        { source: SOURCE_SITES, id },
        { hover: true }
      )
    })

    map.current.on('mouseleave', LAYER_SITES_FILL, () => {
      map.current.getCanvas().style.cursor = ''
      if (hoveredId.current !== null) {
        map.current.setFeatureState(
          { source: SOURCE_SITES, id: hoveredId.current },
          { hover: false }
        )
      }
      hoveredId.current = null
    })

    // ── Click: select site + show popup ────────────────────────────────────
    map.current.on('click', LAYER_SITES_FILL, (e) => {
      const feature = e.features[0]
      const props   = feature.properties
      const siteId  = props.id

      setSelectedSiteId(siteId)
      onSiteClick?.(props)

      // Popup
      const html = `
        <div>
          <p class="text-xs text-brand-400 uppercase tracking-wider mb-1">${props.site_type}</p>
          <h3 class="font-semibold text-white text-sm">${props.name}</h3>
          ${props.description ? `<p class="text-xs text-gray-400 mt-1">${props.description}</p>` : ''}
        </div>
      `
      new mapboxgl.Popup({ offset: 12, closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map.current)
    })
  }

  // ── Update polygon vitality feature-states when timeline date changes ────────
  useEffect(() => {
    if (!map.current || !timelineDate) return
    const monthIndex = TIMELINE_MONTHS.indexOf(timelineDate)
    if (monthIndex < 0) return
    // Wait until the source is loaded before setting states
    const applyVitality = () => {
      sites.forEach((site) => {
        if (!site.id) return
        try {
          map.current.setFeatureState(
            { source: SOURCE_SITES, id: site.id },
            { vitality: computeVitality(site.id, monthIndex) }
          )
        } catch (_) { /* source not yet ready */ }
      })
    }
    if (map.current.getSource(SOURCE_SITES)) {
      applyVitality()
    } else {
      map.current.once('sourcedata', applyVitality)
    }
  }, [timelineDate, sites]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Expose map instance via ref forwarding utility ─────────────────────────
  // Parent components can call flyToSite / fitBounds via useMapInstance hook
  useEffect(() => {
    window.__darukaMap = map.current
  })

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full ${className}`}
      aria-label="Interactive geospatial map"
    />
  )
}
