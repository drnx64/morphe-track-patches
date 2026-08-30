import { useState, useCallback, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import SearchBar from '../search/SearchBar'
import SearchDropdown from '../search/SearchDropdown'
import AnnouncementBell from '../shared/AnnouncementBell'

const NAV_TABS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Apps', end: true },
  { to: '/changelog', label: 'Changelog' },
  { to: '/bundles', label: 'Bundles' },
  { to: '/diff', label: 'Bundle Diff' },
]

const TIER_LABELS: Record<string, string> = {
  low: 'Low-end',
  mid: 'Midrange',
  high: 'High-end',
}

export default function Header() {
  const location = useLocation()
  const { state, dispatch } = useAppContext()
  const isAppsPage = location.pathname === '/' || location.pathname === ''
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTierToast = useCallback((enabled: boolean, tier: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    const device = TIER_LABELS[tier] || 'Unknown'
    setToast(`${device} device detected — turning ${enabled ? 'ON' : 'OFF'} reduced motion`)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const handleToggleReducedMotion = useCallback(() => {
    const next = !state.reducedMotion
    dispatch({ type: 'SET_REDUCED_MOTION', payload: next })
    showTierToast(next, state.deviceTier)
  }, [state.reducedMotion, state.deviceTier, dispatch, showTierToast])

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-top-row">
          <div className="header-title-group">
            <h1
              id="main-title"
              className="header-title-clickable"
              onDoubleClick={handleToggleReducedMotion}
              title="Double-click to toggle reduced motion"
            >
              Morphe Tracker
            </h1>
            <p className="subtitle">Patch monitoring &amp; changelog dashboard</p>
          </div>
          <div className="header-right-row">
            <AnnouncementBell />
            {!isAppsPage && (
              <div className="header-search-row">
                <SearchBar />
              </div>
            )}
          </div>
        </div>
        <nav className="app-nav" aria-label="Main navigation">
          {NAV_TABS.map((tab) => {
            const active = tab.end
              ? location.pathname === tab.to
              : location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`)
            return (
              <Link key={tab.to} to={tab.to} className={`nav-tab${active ? ' active' : ''}`}>
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <SearchDropdown />
      {toast && (
        <div className="toast-notification" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </header>
  )
}
