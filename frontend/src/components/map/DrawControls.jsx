import { useEffect, useRef, useCallback } from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useMapStore } from '../../store/mapStore'

/**
 * DrawControls
 *
 * Attaches a MapboxDraw instance to the map exposed on window.__darukaMap.
 * This component renders no DOM of its own — it only manages side-effects.
 *
 * Props:
 *   mapReady  {boolean}  — parent signals that the map style has loaded
 */
export default function DrawControls({ mapReady }) {
  const draw = useRef(null)
  const setPendingGeometry = useMapStore((s) => s.setPendingGeometry)
  const setDrawMode        = useMapStore((s) => s.setDrawMode)

  const _attachDraw = useCallback(() => {
    const map = window.__darukaMap
    if (!map || draw.current) return

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      // We render our own toolbar (DrawToolbar), so hide native controls
      controls: { polygon: false, trash: false },
      // Custom styles — dark green palette
      styles: [
        // Active polygon fill
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#1a9f76',
            'fill-outline-color': '#1a9f76',
            'fill-opacity': 0.15,
          },
        },
        // Active polygon stroke
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3aba8e', 'line-width': 2, 'line-dasharray': [3, 2] },
        },
        // Vertex points
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#3aba8e',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        },
        // Mid-point
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: {
            'circle-radius': 3.5,
            'circle-color': '#3aba8e',
          },
        },
        // Static (after drawn)
        {
          id: 'gl-draw-polygon-fill-static',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
          paint: { 'fill-color': '#1a9f76', 'fill-opacity': 0.2 },
        },
        {
          id: 'gl-draw-polygon-stroke-static',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3aba8e', 'line-width': 2 },
        },
      ],
    })

    map.addControl(draw.current, 'top-left')

    // ── Events ─────────────────────────────────────────────────────────────
    map.on('draw.create', (e) => {
      const feature  = e.features[0]
      const geometry = feature.geometry   // GeoJSON Polygon
      setPendingGeometry(geometry)
      // Delete from draw layer immediately — visual is handled by the sites source
      draw.current.delete(feature.id)
      draw.current.changeMode('simple_select')
    })

    map.on('draw.modechange', (e) => {
      if (e.mode === 'draw_polygon') {
        setDrawMode('drawing')
      } else if (e.mode === 'simple_select') {
        // Only reset to idle if we aren't mid-save
        const state = useMapStore.getState()
        if (state.drawMode === 'drawing') setDrawMode('idle')
      }
    })
  }, [setPendingGeometry, setDrawMode])

  useEffect(() => {
    if (!mapReady) return
    // Small delay lets the map fully load after style.load fires
    const t = setTimeout(_attachDraw, 200)
    return () => clearTimeout(t)
  }, [mapReady, _attachDraw])

  useEffect(() => {
    return () => {
      const map = window.__darukaMap
      if (map && draw.current) {
        try { map.removeControl(draw.current) } catch { /* ignore */ }
        draw.current = null
      }
    }
  }, [])

  return null
}

// ── Utility: exposed so DrawToolbar can trigger modes without props drilling ─
export function triggerDraw() {
  const map = window.__darukaMap
  const controls = map?._controls
  const d = controls?.find((c) => c instanceof MapboxDraw)
  d?.changeMode('draw_polygon')
}

export function triggerDelete() {
  const map = window.__darukaMap
  const controls = map?._controls
  const d = controls?.find((c) => c instanceof MapboxDraw)
  d?.trash()
}
