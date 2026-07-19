import { useMemo, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatFriendlyDate } from '../../utils/format'
import { getAppIconUrl, groupAffectedBundles, resolveAppName } from '../../utils/misc'
import { getCachedIconDataUrl } from '../../services/iconCache'
import { getAuthorLink } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { FALLBACK_ICON } from '../../utils/svg'
import { BADGE_CLASSES } from '../shared/Badge'
import { SkeletonUpdates } from '../shared/Skeleton'

const APP_BADGE_MAP: Record<string, string> = {
  'NEW APP': `<span class="badge ${BADGE_CLASSES.NEW_APP}">NEW APP</span>`,
  'UPDATED APP': `<span class="badge ${BADGE_CLASSES.UPDATED_APP}">UPDATED APP</span>`,
  'REMOVED APP': `<span class="badge ${BADGE_CLASSES.REMOVED_APP}">REMOVED APP</span>`,
}

const BUNDLE_BADGE_MAP: Record<string, string> = {
  'NEW BUNDLE': `<span class="badge ${BADGE_CLASSES.NEW_BUNDLE}">NEW BUNDLE</span>`,
  'UPDATED': `<span class="badge ${BADGE_CLASSES.UPDATED_BUNDLE}">UPDATED</span>`,
}

const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

function getBundleRepoUrl(bundleName: string, bundles: Record<string, any>): string {
  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  return bundles[stableKey]?.repo_url || bundles[devKey]?.repo_url || ''
}

function renderChanges(changes: { affected_bundles?: any[] } | null, bundles: Record<string, any>, iconCache: Record<string, string>, nameCache: Record<string, string>, liveDataDate: string, lastChecked: string): { html: string; hasChanges: boolean } {
  const updateDate = liveDataDate || (lastChecked ? lastChecked.split('T')[0] : '')
  const dateStr = updateDate ? formatFriendlyDate(updateDate) : '-'

  if (!changes?.affected_bundles?.length) {
    return {
      html: `<div class="updates-header">
        <h2 class="updates-title" id="updates-title-heading">Changelog</h2>
        <span class="updates-date" id="updates-date-label">Updated: ${dateStr}</span>
      </div>
      <div class="no-updates-msg">No compatibility changes detected in the latest update scan. All active patches match the current catalog.</div>`,
      hasChanges: false,
    }
  }

  const grouped = groupAffectedBundles(changes.affected_bundles)

  let html = `<div class="updates-header">
    <h2 class="updates-title" id="updates-title-heading">Changelog</h2>
    <span class="updates-date" id="updates-date-label">Updated: ${dateStr}</span>
  </div>`

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

  for (const section of sections) {
    html += `<div class="updates-section-header">${escHtml(section.title)}</div>`

    for (const bundleName of section.names) {
      const entry = grouped[bundleName]
      const repoUrl = getBundleRepoUrl(bundleName, bundles)
      const bundleBadge = entry.badge_type ? (BUNDLE_BADGE_MAP[entry.badge_type] || '') : ''
      const channelsJson = escHtml(JSON.stringify(entry.channels))

      html += `<div class="update-bundle-group">`
      html += `<div class="update-row update-bundle-header-row">
        ${bundleBadge}
        <strong class="cl-bundle-link" role="button" tabindex="0" data-bundle="${escHtml(bundleName)}" data-channels='${channelsJson}'>${escHtml(bundleName)}</strong>
        ${getAuthorLink(repoUrl)}
      </div>`

      html += `<div class="update-bundle-apps">`
      const sortedApps = [...(entry.apps || [])].sort((a, b) => {
        const aOrder = SORT_ORDER[a.badge_type!] ?? 99
        const bOrder = SORT_ORDER[b.badge_type!] ?? 99
        return aOrder - bOrder
      })

      for (const app of sortedApps) {
        const appBadge = app.badge_type ? (APP_BADGE_MAP[app.badge_type] || '') : ''
        const appName = resolveAppName(app, nameCache)
        const iconUrl = getAppIconUrl(app, iconCache)
        const dataUrl = iconUrl ? getCachedIconDataUrl(iconUrl) : null
        const promotedBadge = app.promoted_from ? '<span class="badge badge-promoted">MOVED TO STABLE</span>' : ''

        html += `<div class="update-row update-app-row">
          ${appBadge}${promotedBadge}
          ${iconUrl ? `<img class="app-icon" src="${dataUrl || iconUrl}" alt="" onerror="this.src='${FALLBACK_ICON}'">` : ''}
          <strong class="cl-app-link" role="button" tabindex="0" data-package="${escHtml(app.package)}" data-bundle="${escHtml(bundleName)}" data-channels='${channelsJson}'>${escHtml(appName)}</strong>
        </div>`
      }

      html += `</div></div>`
    }
  }

  return { html, hasChanges: true }
}

export default function TodayUpdatesSection() {
  const { state } = useAppContext()

  const changesHtml = useMemo(() =>
    renderChanges(state.changes, state.bundles, state.iconCache, state.nameCache, state.liveDataDate, state.lastChecked).html,
    [state.changes, state.bundles, state.iconCache, state.nameCache, state.liveDataDate, state.lastChecked]
  )

  const handleClick = useCallback((e: React.MouseEvent) => {
    const bundleLink = (e.target as HTMLElement).closest('.cl-bundle-link')
    if (bundleLink && bundleLink instanceof HTMLElement) {
      const bundleName = bundleLink.dataset.bundle
      const channels = bundleLink.dataset.channels ? JSON.parse(bundleLink.dataset.channels) : []
      if (bundleName) {
        window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
      }
      return
    }

    const appLink = (e.target as HTMLElement).closest('.cl-app-link')
    if (appLink && appLink instanceof HTMLElement) {
      const pkg = appLink.dataset.package
      const bName = appLink.dataset.bundle
      const channels = appLink.dataset.channels ? JSON.parse(appLink.dataset.channels) : []
      if (pkg && bName) {
        const stableKey = `${bName}:stable`
        const devKey = `${bName}:dev`
        let appData = state.bundles[stableKey]?.apps?.find((a: any) => a.package === pkg)
        if (!appData) appData = state.bundles[devKey]?.apps?.find((a: any) => a.package === pkg)
        if (appData) {
          window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName: bName, channels } }))
        }
      }
      return
    }
  }, [state.bundles])

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
          onClick={handleClick}
        />
      </div>
    </section>
  )
}