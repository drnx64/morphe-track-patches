import { useMemo } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatTime, getTimeAgo } from '../../utils/format'

export default function StatsSection() {
  const { state } = useAppContext()

  const lastChecked = state.lastChecked
  const data = state.bundles
  const bundles = Object.values(data)
  const totalApps = useMemo(() => {
    const seen = new Set<string>()
    for (const b of Object.values(data)) {
      for (const app of b.apps || []) seen.add(app.package)
    }
    return seen.size
  }, [data])

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
