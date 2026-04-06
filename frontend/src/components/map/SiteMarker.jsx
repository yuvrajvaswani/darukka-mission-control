import { useMapStore } from '../../store/mapStore'

const SITE_TYPE_DOTS = {
  monitoring: 'bg-brand-500',
  exclusion:  'bg-red-500',
  general:    'bg-sky-500',
}

/**
 * SiteList
 *
 * A sidebar list of all sites in the current project.
 * Clicking a site zooms the map to it.
 */
export default function SiteList({ onSiteSelect }) {
  const sites          = useMapStore((s) => s.sites)
  const selectedSiteId = useMapStore((s) => s.selectedSiteId)
  const setSelected    = useMapStore((s) => s.setSelectedSiteId)

  const handleClick = (site) => {
    setSelected(site.id)
    onSiteSelect?.(site)

    // Fly to site centroid on the map
    const map = window.__darukaMap
    if (map && site.centroid_lon != null && site.centroid_lat != null) {
      map.flyTo({
        center: [site.centroid_lon, site.centroid_lat],
        zoom: 13,
        duration: 1200,
        essential: true,
      })
    }
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-surface-700 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No sites yet</p>
        <p className="text-xs text-gray-500 mt-1">Draw a polygon on the map to add one</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-surface-700">
      {sites.map((site) => (
        <li key={site.id}>
          <button
            className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-700 transition-colors duration-100
              ${selectedSiteId === site.id ? 'bg-surface-700 border-l-2 border-brand-500' : ''}`}
            onClick={() => handleClick(site)}
          >
            <span
              className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${SITE_TYPE_DOTS[site.site_type] ?? 'bg-gray-500'}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">{site.name}</p>
              {site.description && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{site.description}</p>
              )}
              <p className="text-xs text-gray-600 mt-0.5 capitalize">{site.site_type}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
