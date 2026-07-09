import { useAppContext } from '../../context/AppContext'
import { formatTime, getTimeAgo } from '../../utils/format'
import { useEffect, useState } from 'react'
import { fetchLastChecked } from '../../services/fetchData'

export default function StatsSection() {
  const { state } = useAppContext()
  const [lastCheckedOverride, setLastCheckedOverride] = useState('')

  useEffect(() => {
    fetchLastChecked().then((lc) => {
      if (lc) setLastCheckedOverride(lc)
    })
  }, [])

  const lastChecked = lastCheckedOverride || state.lastChecked
  const data = state.bundles
  const bundles = Object.values(data)
  const totalApps = bundles.reduce((sum, b) => sum + (b.apps?.length || 0), 0)

  return (
    <section className="stats-section" aria-labelledby="stats-heading">
      <h2 className="sr-only" id="stats-heading">Quick Statistics</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Bundles</span>
          <span className="stat-value" id="stat-total-bundles">{bundles.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Apps</span>
          <span className="stat-value" id="stat-total-apps">{totalApps}</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">New Apps Today</span>
          <span className="stat-value" id="stat-new-apps-today">{state.stats?.new_apps_today ?? '-'}</span>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">New Bundles Today</span>
          <span className="stat-value" id="stat-new-bundles-today">{state.stats?.new_bundles_today ?? '-'}</span>
        </div>
      </div>
      <div className="last-updated-row">
        <span className={`scan-pulse${state.liveDataDate === new Date().toISOString().split('T')[0] ? ' scan-pulse--fresh' : ''}`} id="scan-freshness-dot" />
        <span>Last checked: <strong id="val-last-checked">{formatTime(lastChecked)}</strong></span>
        <span className="last-updated-ago" id="val-last-checked-ago">({getTimeAgo(lastChecked)})</span>
      </div>
    </section>
  )
}
