import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    matchFn: (path) => path === '/dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Projects',
    matchFn: (path) => path.startsWith('/projects'),
    path: '/dashboard',
    icon: (
      <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    matchFn: (path) => path === '/settings',
    path: '/settings',
    icon: (
      <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-800/95 border-r border-surface-700/80
                      flex flex-col h-screen sticky top-0 z-20 backdrop-blur-sm">

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-surface-700/60 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700
                        flex items-center justify-center shadow-lg shadow-brand-900/50 flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Darukaa</p>
          <p className="text-[10px] text-gray-500 leading-tight">Mission Control</p>
        </div>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-2 mb-2">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.matchFn(location.pathname)
          return (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              title={!item.path ? 'Coming soon' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm
                          transition-all duration-150
                ${active
                  ? 'bg-brand-700/30 text-brand-300 font-semibold shadow-sm'
                  : item.path
                    ? 'text-gray-400 hover:bg-surface-700/60 hover:text-gray-200'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
            >
              <span className={`flex-shrink-0 ${active ? 'text-brand-400' : ''}`}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {!item.path && (
                <span className="ml-auto text-[9px] font-semibold text-gray-600
                                 border border-surface-600/80 rounded px-1 py-0.5 flex-shrink-0">
                  SOON
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-4 space-y-2 flex-shrink-0">
        {/* Upgrade card */}
        <div className="rounded-xl bg-gradient-to-br from-brand-900/70 to-surface-700/40
                        border border-brand-700/40 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="w-3 h-3 text-brand-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <p className="text-xs font-semibold text-brand-300">Upgrade to Pro</p>
          </div>
          <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
            Unlock AI reports &amp; advanced analytics
          </p>
          <button className="w-full py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500
                             text-white text-xs font-semibold transition-colors duration-150
                             shadow-sm shadow-brand-900/50">
            Upgrade Plan
          </button>
        </div>

        {/* User row */}
        <div className="group flex items-center gap-2 px-2.5 py-2 rounded-xl
                        hover:bg-surface-700/60 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800
                          flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(user?.full_name ?? user?.email ?? '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white font-medium truncate leading-tight">
              {user?.full_name ?? user?.email}
            </p>
            <p className="text-[10px] text-gray-500 truncate leading-tight">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="w-6 h-6 rounded-lg flex items-center justify-center
                       opacity-0 group-hover:opacity-100
                       text-gray-500 hover:text-rose-400 hover:bg-rose-900/20
                       transition-all duration-150 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
