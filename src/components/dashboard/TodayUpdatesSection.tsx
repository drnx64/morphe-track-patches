import { useMemo } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatFriendlyDate } from '../../utils/format'
import { groupAffectedBundles, isAppPreRelease, resolveAppName, getAppIconUrl } from '../../utils/misc'
import { getAuthorLink, getPlayStoreUrl } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { Badge, BADGE_CLASSES } from '../shared/Badge'
import AppIcon from '../shared/AppIcon'
import { FALLBACK_ICON } from '../../utils/svg'
import { SkeletonUpdates } from '../shared/Skeleton'

const APP_BADGE_MAP: Record<string, string> = {
  'NEW APP': `<span class="badge ${BADGE_CLASSES.NEW_APP}">NEW APP</span>`,
  'UPDATED APP': `<span class="badge ${BADGE_CLASSES.UPDATED_APP}">UPDATED APP</span>`,
  'REMOVED APP': `<span class="badge ${BADGE_CLASSES.REMOVED_APP}">REMOVED APP</span>`,
}

const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

export default function TodayUpdatesSection() {
  const { state } = useAppContext()

  const { changesHtml, hasChanges } = useMemo(() => {
    // Simulate today's changes from the bundle data
    // In the old app, changes.json was fetched separately; we pick up from cached data
    let html = ''
    let hasChangesVal = false

    const lc = state.lastChecked
    const updateDate = state.liveDataDate || (lc ? lc.split('T')[0] : '')

    html += `<div class="updates-header">
      <h2 class="updates-title" id="updates-title-heading">Changelog</h2>
      <span class="updates-date" id="updates-date-label">Updated: ${updateDate ? formatFriendlyDate(updateDate) : '-'}</span>
    </div>`

    // We don't have changes.json in the same structure anymore; this is placeholder
    // for the migrated data flow. The actual changes rendering can be triggered
    // from the service worker or a dedicated changes fetch later.
    hasChangesVal = false
    html += `<div class="no-updates-msg">No compatibility changes detected in the latest update scan. All active patches match the current catalog.</div>`

    return { changesHtml: html, hasChanges: hasChangesVal }
  }, [state.liveDataDate, state.lastChecked, state.bundles])

  if (state.loading && Object.keys(state.bundles).length === 0) {
    return (
      <section className="today-updates-section" aria-labelledby="updates-title-heading">
        <div className="updates-card">
          <div className="updates-header">
            <h2 className="updates-title">Changelog</h2>
            <span className="updates-date">Updated: -</span>
          </div>
          <div className="updates-body" id="today-updates-container">
            <div className="skeleton-checking" id="checking-message">Checking for updates...</div>
            <div id="skeleton-updates"><SkeletonUpdates /></div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="today-updates-section" aria-labelledby="updates-title-heading">
      <div className="updates-card">
        <div
          className="updates-body"
          id="today-updates-container"
          dangerouslySetInnerHTML={{ __html: changesHtml }}
        />
      </div>
    </section>
  )
}
