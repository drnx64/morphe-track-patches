import { useMemo, useCallback, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatFriendlyDate, getTimeAgo } from '../../utils/format'
import { groupAffectedBundles } from '../../utils/misc'
import { preloadIconsFromPackages } from '../../services/iconCache'
import { SkeletonUpdates } from '../shared/Skeleton'
import ViewToggle from './updates/ViewToggle'
import TimelineView from './updates/TimelineView'
import AccordionView from './updates/AccordionView'
import CardGridView from './updates/CardGridView'

function isNewScan(lastChecked: string, lastVisitScan: string): boolean {
  if (!lastChecked || !lastVisitScan) return false
  return lastChecked > lastVisitScan
}

export default function TodayUpdatesSection() {
  const { state, dispatch } = useAppContext()

  useEffect(() => {
    if (!state.changes?.affected_bundles?.length) return
    const pkgs = new Set<string>()
    for (const ab of state.changes.affected_bundles) {
      for (const a of ab.apps || []) {
        if (a.package) pkgs.add(a.package)
      }
    }
    if (pkgs.size === 0) return
    preloadIconsFromPackages([...pkgs], state.iconCache)
  }, [state.changes, state.iconCache])

  const grouped = useMemo(() => {
    if (!state.changes?.affected_bundles?.length) return null
    return groupAffectedBundles(state.changes.affected_bundles)
  }, [state.changes])

  const sortedSections = useMemo(() => {
    if (!grouped) return []
    const sortedNames = Object.keys(grouped).sort((a, b) => {
      const aIsNew = grouped[a].badge_type === 'NEW BUNDLE'
      const bIsNew = grouped[b].badge_type === 'NEW BUNDLE'
      if (aIsNew && !bIsNew) return -1
      if (!aIsNew && bIsNew) return 1
      const aHasNew = grouped[a].apps.some((app) => app.badge_type === 'NEW APP')
      const bHasNew = grouped[b].apps.some((app) => app.badge_type === 'NEW APP')
      if (aHasNew && !bHasNew) return -1
      if (!aHasNew && bHasNew) return 1
      return a.localeCompare(b)
    })

    const newBundles: string[] = []
    const updatedWithNewApps: string[] = []
    const updatedBundles: string[] = []

    for (const bName of sortedNames) {
      const entry = grouped[bName]
      if (entry.badge_type === 'NEW BUNDLE') {
        newBundles.push(bName)
      } else if (entry.apps.some((app) => app.badge_type === 'NEW APP')) {
        updatedWithNewApps.push(bName)
      } else {
        updatedBundles.push(bName)
      }
    }

    const sections: { title: string; names: string[] }[] = []
    if (newBundles.length > 0) sections.push({ title: 'New Bundles', names: newBundles })
    if (updatedWithNewApps.length > 0) sections.push({ title: 'Updated with New Apps', names: updatedWithNewApps })
    if (updatedBundles.length > 0) sections.push({ title: 'Updated Bundles', names: updatedBundles })
    return sections
  }, [grouped])

  const updateDate = state.liveDataDate || (state.lastChecked ? state.lastChecked.split('T')[0] : '')
  const dateStr = updateDate ? formatFriendlyDate(updateDate) : '-'
  const hasChanges = !!grouped && sortedSections.length > 0
  const showNewScan = isNewScan(state.lastChecked, state.lastVisitScan)
  const lastScanAgo = state.lastChecked ? getTimeAgo(state.lastChecked) : ''

  const handleDismissNewScan = useCallback(() => {
    if (state.lastChecked) {
      dispatch({ type: 'SET_LAST_VISIT_SCAN', payload: state.lastChecked })
    }
  }, [state.lastChecked, dispatch])

  // Loading state: data not fetched yet
  if (state.changes === null) {
    return (
      <section className="today-updates-section" aria-labelledby="updates-title-heading">
        <div className="updates-card">
          <div className="updates-header">
            <h2 className="updates-title">Today's Updates</h2>
            <span className="updates-date">Updated: -</span>
          </div>
          <div className="updates-body">
            <div className="updates-loading-state">
              <div className="updates-spinner" />
              <span className="updates-loading-text">Checking for updates...</span>
            </div>
            <SkeletonUpdates />
          </div>
        </div>
      </section>
    )
  }

  // Empty state: data fetched but no changes
  if (!hasChanges) {
    return (
      <section className="today-updates-section" aria-labelledby="updates-title-heading">
        <div className="updates-card">
          <div className="updates-header">
            <div className="updates-header-left">
              <div className="updates-title-row">
                <h2 className="updates-title">Today's Updates</h2>
                {showNewScan && (
                  <button type="button" className="updates-new-scan-badge" onClick={handleDismissNewScan} title="Click to dismiss">
                    <div className="updates-new-scan-dot" />
                    <span>NEW SCAN</span>
                    {lastScanAgo && <span className="updates-new-scan-ago">{lastScanAgo}</span>}
                  </button>
                )}
              </div>
            </div>
            <span className="updates-date">Updated: {dateStr}</span>
          </div>
          <div className="updates-body">
            <div className="no-updates-msg">No compatibility changes detected in the latest update scan. All active patches match the current catalog.</div>
          </div>
        </div>
      </section>
    )
  }

  // Data loaded with changes
  return (
    <section className="today-updates-section" aria-labelledby="updates-title-heading">
      <div className="updates-card">
        <div className="updates-header">
          <div className="updates-header-left">
            <div className="updates-title-row">
              <h2 className="updates-title">Today's Updates</h2>
              {showNewScan && (
                <button type="button" className="updates-new-scan-badge" onClick={handleDismissNewScan} title="Click to dismiss">
                  <div className="updates-new-scan-dot" />
                  <span>NEW SCAN</span>
                  {lastScanAgo && <span className="updates-new-scan-ago">{lastScanAgo}</span>}
                </button>
              )}
            </div>
          </div>
          <span className="updates-date">Updated: {dateStr}</span>
        </div>
        <ViewToggle />
        <div className="updates-body">
          {state.updatesViewMode === 'timeline' && (
            <TimelineView grouped={grouped} sortedSections={sortedSections} />
          )}
          {state.updatesViewMode === 'accordion' && (
            <AccordionView grouped={grouped} sortedSections={sortedSections} />
          )}
          {state.updatesViewMode === 'grid' && (
            <CardGridView grouped={grouped} sortedSections={sortedSections} />
          )}
        </div>
      </div>
    </section>
  )
}
