import { Link, useLocation } from 'react-router-dom'
import SearchBar from '../search/SearchBar'
import SearchDropdown from '../search/SearchDropdown'

export default function Header() {
  const location = useLocation()
  const isDashboard = location.pathname === '/'

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-top-row">
          <div className="header-title-group">
            <h1 id="main-title">Morphe Tracker</h1>
            <p className="subtitle">Patch monitoring &amp; changelog dashboard</p>
          </div>
          <nav className="main-nav">
            <Link to="/" className={`nav-link${isDashboard ? ' active' : ''}`} id="nav-dashboard">
              Dashboard
            </Link>
            <Link to="/changelog.html" className={`nav-link${!isDashboard ? ' active' : ''}`} id="nav-changelog">
              Changelog History
            </Link>
          </nav>
        </div>
        {isDashboard && (
          <div className="header-search-row">
            <SearchBar />
          </div>
        )}
      </div>
      <SearchDropdown />
    </header>
  )
}
