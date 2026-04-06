import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

function Section({ title, description, children }) {
  return (
    <div className="bg-surface-800/70 border border-surface-600/60 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-700/60">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm text-gray-200 font-medium">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
        ${checked ? 'bg-brand-600' : 'bg-surface-600'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow
                        transition-transform duration-200
                        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function Settings() {
  const { user } = useAuth()

  // Profile
  const [displayName, setDisplayName] = useState(user?.full_name ?? '')
  const [saved, setSaved] = useState(false)

  // Notifications
  const [emailAlerts, setEmailAlerts]     = useState(true)
  const [weeklyDigest, setWeeklyDigest]   = useState(false)
  const [insightPush, setInsightPush]     = useState(true)

  // Map defaults
  const [defaultLayer, setDefaultLayer]   = useState('satellite')
  const [show3D, setShow3D]               = useState(true)
  const [autoPlay, setAutoPlay]           = useState(false)

  const handleSaveProfile = (e) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <Section title="Profile" description="Your display name shown across the platform">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="label">Display Name</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={120}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email ?? ''} disabled />
            <p className="text-xs text-gray-600 mt-1">Email cannot be changed here</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </button>
            {saved && (
              <span className="text-xs text-emerald-400 animate-fade-in">Saved ✓</span>
            )}
          </div>
        </form>
      </Section>

      {/* ── Notifications ───────────────────────────────────────────── */}
      <Section title="Notifications" description="Choose what alerts you receive">
        <Field
          label="Email Alerts"
          hint="Get notified when a site crosses critical thresholds"
        >
          <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
        </Field>
        <Field
          label="Weekly Digest"
          hint="Summary of all project trends every Monday"
        >
          <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
        </Field>
        <Field
          label="AI Insight Notifications"
          hint="Push alerts when new insights are generated"
        >
          <Toggle checked={insightPush} onChange={setInsightPush} />
        </Field>
      </Section>

      {/* ── Map Preferences ─────────────────────────────────────────── */}
      <Section title="Map Preferences" description="Default behaviour when opening the map explorer">
        <Field label="Default Base Layer" hint="The map style loaded on first open">
          <select
            className="input py-1.5 text-xs w-36"
            value={defaultLayer}
            onChange={(e) => setDefaultLayer(e.target.value)}
          >
            <option value="satellite">Satellite</option>
            <option value="streets">Streets</option>
            <option value="outdoors">Outdoors</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field
          label="3D Terrain"
          hint="Enable globe projection and terrain exaggeration"
        >
          <Toggle checked={show3D} onChange={setShow3D} />
        </Field>
        <Field
          label="Auto-play Timeline"
          hint="Start the timeline slider automatically on map load"
        >
          <Toggle checked={autoPlay} onChange={setAutoPlay} />
        </Field>
      </Section>

      {/* ── Danger zone ─────────────────────────────────────────────── */}
      <Section title="Danger Zone" description="Irreversible actions — proceed with care">
        <Field
          label="Delete Account"
          hint="Permanently remove your account and all associated projects"
        >
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg
                       border border-rose-700/60 text-rose-400
                       hover:bg-rose-900/30 hover:border-rose-600
                       transition-colors duration-150"
            onClick={() => window.alert('Contact support to delete your account.')}
          >
            Delete Account
          </button>
        </Field>
      </Section>
    </div>
  )
}
