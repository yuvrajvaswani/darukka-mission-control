import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Navbar({ projectName }) {
  const { user, signOut } = useAuth()
  const navigate  = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <header className="flex-shrink-0 h-14 bg-surface-800/95 border-b border-surface-700/80
                       flex items-center justify-between px-5 z-20 backdrop-blur-sm">
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 flex-shrink-0 group"
        >
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700
                          flex items-center justify-center shadow-lg shadow-brand-900/50
                          group-hover:shadow-brand-600/40 transition-shadow duration-200">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">Darukaa</span>
        </button>

        {projectName && (
          <>
            <svg className="w-4 h-4 text-surface-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm text-gray-400 truncate max-w-[180px]">{projectName}</span>
          </>
        )}
      </div>

      {/* Right: User menu */}
      <div className="relative flex items-center gap-3 flex-shrink-0">
        {/* Notification bell */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-700
                           text-gray-400 hover:text-gray-200 transition-colors relative">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>

        {/* User avatar dropdown */}
        <button
          onClick={() => setShowMenu((m) => !m)}
          className="flex items-center gap-2.5 pl-3 border-l border-surface-700
                     hover:text-white transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800
                          flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {(user?.full_name ?? user?.email ?? '?')[0].toUpperCase()}
          </div>
          <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[120px]">
            {user?.full_name ?? user?.email}
          </span>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-surface-800 border border-surface-600
                            rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-surface-700">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name ?? 'User'}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={() => { navigate('/dashboard'); setShowMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300
                           hover:bg-surface-700 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </button>
              <button
                onClick={() => { signOut(); setShowMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-400
                           hover:bg-rose-900/20 hover:text-rose-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
