import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import { sitesApi } from '../api/sites'

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate       = useNavigate()
  const [project, setProject] = useState(null)
  const [sites, setSites]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([projectsApi.get(projectId), sitesApi.list(projectId)])
      .then(([{ data: proj }, { data: s }]) => { setProject(proj); setSites(s) })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false))
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-900">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
        <button
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Projects
        </button>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.description && (
              <p className="text-gray-400 text-sm mt-1">{project.description}</p>
            )}
          </div>
          <button
            className="btn-primary flex-shrink-0"
            onClick={() => navigate(`/projects/${projectId}/map`)}
          >
            Open Map
          </button>
        </div>

        {/* Sites grid */}
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Sites ({sites.length})
        </h2>
        {sites.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-sm">No sites yet — open the map to draw your first polygon.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <div key={site.id} className="card hover:border-surface-500 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    site.site_type === 'monitoring' ? 'bg-brand-500' :
                    site.site_type === 'exclusion'  ? 'bg-red-500' : 'bg-sky-500'
                  }`} />
                  <h3 className="font-medium text-white text-sm truncate">{site.name}</h3>
                </div>
                {site.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{site.description}</p>
                )}
                <p className="text-xs text-gray-600 capitalize">{site.site_type}</p>
                {site.centroid_lat != null && (
                  <p className="text-xs text-gray-600 font-mono mt-1">
                    {site.centroid_lat.toFixed(4)}, {site.centroid_lon.toFixed(4)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
