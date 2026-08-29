import { Link, useLocation } from 'react-router-dom'
import SearchBar from '../search/SearchBar'
import SearchDropdown from '../search/SearchDropdown'
import AnnouncementBell from '../shared/AnnouncementBell'

const NAV_TABS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Apps', end: true },
  { to: '/changelog', label: 'Changelog' },
  { to: '/bundles', label: 'Bundles' },
  { to: '/diff', label: 'Bundle Diff' },
]

export default function Header() {
  const location = useLocation()
  const isAppsPage = location.pathname === '/' || location.pathname === ''

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-top-row">
          <div className="header-title-group">
            <h1 id="main-title">Morphe Tracker</h1>
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
    </header>
  )
}
