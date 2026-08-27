import { useMemo, useCallback, useEffect, useState, useRef } from 'react'
import { useAppContext } from '../../context/AppContext'
import { formatFriendlyDate, getTimeAgo } from '../../utils/format'
import { getAppIconUrl, groupAffectedBundles, resolveAppName } from '../../utils/misc'
import { getCachedIconDataUrl, fetchAndCacheIcon, preloadIconsFromPackages } from '../../services/iconCache'
import { getRepoInfo } from '../../utils/url'
import { FALLBACK_ICON } from '../../utils/svg'
import { Badge, BADGE_CLASSES } from '../shared/Badge'
import { SkeletonUpdates } from '../shared/Skeleton'

const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

function getBundleRepoUrl(bundleName: string, bundles: Record<string, any>): string {
  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  return bundles[stableKey]?.repo_url || bundles[devKey]?.repo_url || ''
}

function AuthorLink({ repoUrl }: { repoUrl?: string }) {
  if (!repoUrl) return <span className="author-link">unknown</span>
  const { isGitLab, path } = getRepoInfo(repoUrl)
  const author = path.split('/')[0]
  const href = isGitLab ? `https://gitlab.com/${author}` : `https://github.com/${author}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="author-link">
      @{author}
    </a>
  )
}

function isNewScan(lastChecked: string, lastVisitScan: string): boolean {
  if (!lastChecked || !lastVisitScan) return false
  return lastChecked > lastVisitScan
}

interface AppRowProps {
  app: any
  bundleName: string
  channels: string[]
  iconCache: Record<string, string>
  nameCache: Record<string, string>
  onOpenApp: (pkg: string, bundleName: string, channels: string[]) => void
}

function AppRow({ app, bundleName, channels, iconCache, nameCache, onOpenApp }: AppRowProps) {
  const [iconSrc, setIconSrc] = useState<string | null>(null)
  const [iconLoading, setIconLoading] = useState(true)
  const mountedRef = useRef(true)

  const iconUrl = getAppIconUrl(app, iconCache)
  const appName = resolveAppName(app, nameCache)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!iconUrl) {
      setIconSrc(null)
      setIconLoading(false)
      return
    }

    const cached = getCachedIconDataUrl(iconUrl)
    if (cached) {
      setIconSrc(cached)
      setIconLoading(false)
      return
    }

    setIconLoading(true)
    fetchAndCacheIcon(iconUrl).then((dataUrl) => {
      if (!mountedRef.current) return
      setIconSrc(dataUrl)
      setIconLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setIconSrc(FALLBACK_ICON)
      setIconLoading(false)
    })
  }, [iconUrl])

  const badgeClass = app.badge_type === 'NEW APP' ? BADGE_CLASSES.NEW_APP
    : app.badge_type === 'UPDATED APP' ? BADGE_CLASSES.UPDATED_APP
    : app.badge_type === 'REMOVED APP' ? BADGE_CLASSES.REMOVED_APP
    : ''

  return (
    <div
      className="update-row update-app-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpenApp(app.package, bundleName, channels)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenApp(app.package, bundleName, channels) } }}
    >
      <div className="update-app-left">
        {app.badge_type && <Badge className={badgeClass}>{app.badge_type}</Badge>}
        {app.promoted_from && <Badge className={BADGE_CLASSES.PROMOTED}>MOVED TO STABLE</Badge>}
      </div>
      <div className="update-app-icon-wrap">
        {iconLoading && iconUrl ? (
          <div className="update-icon-spinner" />
        ) : iconSrc ? (
          <img className="app-icon" src={iconSrc} alt="" onError={(e) => { if (e.currentTarget.src !== FALLBACK_ICON) e.currentTarget.src = FALLBACK_ICON }} />
        ) : (
          <img className="app-icon" src={FALLBACK_ICON} alt="" />
        )}
      </div>
      <strong className="cl-app-link">{appName}</strong>
    </div>
  )
}

interface BundleGroupProps {
  bundleName: string
  entry: any
  bundles: Record<string, any>
  iconCache: Record<string, string>
  nameCache: Record<string, string>
  onOpenBundle: (name: string, channels: string[]) => void
  onOpenApp: (pkg: string, bundleName: string, channels: string[]) => void
}

function BundleGroup({ bundleName, entry, bundles, iconCache, nameCache, onOpenBundle, onOpenApp }: BundleGroupProps) {
  const repoUrl = getBundleRepoUrl(bundleName, bundles)

  const badgeClass = entry.badge_type === 'NEW BUNDLE' ? BADGE_CLASSES.NEW_BUNDLE
    : entry.badge_type === 'UPDATED' ? BADGE_CLASSES.UPDATED_BUNDLE
    : ''

  const sortedApps = useMemo(() => {
    return [...(entry.apps || [])].sort((a, b) => {
      const aOrder = SORT_ORDER[a.badge_type!] ?? 99
      const bOrder = SORT_ORDER[b.badge_type!] ?? 99
      return aOrder - bOrder
    })
  }, [entry.apps])

  return (
    <div className="update-bundle-group">
      <div className="update-row update-bundle-header-row">
        {entry.badge_type && <Badge className={badgeClass}>{entry.badge_type}</Badge>}
        <strong
          className="cl-bundle-link"
          role="button"
          tabIndex={0}
          onClick={() => onOpenBundle(bundleName, entry.channels)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenBundle(bundleName, entry.channels) } }}
        >
          {bundleName}
        </strong>
        <AuthorLink repoUrl={repoUrl} />
      </div>
      <div className="update-bundle-apps">
        {sortedApps.map((app) => (
          <AppRow
            key={app.package}
            app={app}
            bundleName={bundleName}
            channels={entry.channels}
            iconCache={iconCache}
            nameCache={nameCache}
            onOpenApp={onOpenApp}
          />
        ))}
      </div>
    </div>
  )
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

  const handleOpenBundle = useCallback((bundleName: string, channels: string[]) => {
    window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
  }, [])

  const handleOpenApp = useCallback((pkg: string, bundleName: string, channels: string[]) => {
    const stableKey = `${bundleName}:stable`
    const devKey = `${bundleName}:dev`
    let appData = state.bundles[stableKey]?.apps?.find((a: any) => a.package === pkg)
    if (!appData) appData = state.bundles[devKey]?.apps?.find((a: any) => a.package === pkg)
    if (appData) {
      window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName, channels } }))
    }
  }, [state.bundles])

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
            <h2 className="updates-title">Changelog</h2>
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
              <h2 className="updates-title">Changelog</h2>
              {showNewScan && (
                <button type="button" className="updates-new-scan-badge" onClick={handleDismissNewScan} title="Click to dismiss">
                  <div className="updates-new-scan-dot" />
                  <span>NEW SCAN</span>
                  {lastScanAgo && <span className="updates-new-scan-ago">{lastScanAgo}</span>}
                </button>
              )}
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
              <h2 className="updates-title">Changelog</h2>
              {showNewScan && (
                <button type="button" className="updates-new-scan-badge" onClick={handleDismissNewScan} title="Click to dismiss">
                  <div className="updates-new-scan-dot" />
                  <span>NEW SCAN</span>
                  {lastScanAgo && <span className="updates-new-scan-ago">{lastScanAgo}</span>}
                </button>
              )}
            </div>
            {!state.iconsReady && (
              <div className="updates-loading-badge">
                <div className="updates-mini-spinner" />
                <span>Loading icons...</span>
              </div>
            )}
          </div>
          <span className="updates-date">Updated: {dateStr}</span>
        </div>
        <div className="updates-body">
          {sortedSections.map((section) => (
            <div key={section.title} className="update-section">
              <div className="updates-section-header">{section.title}</div>
              {section.names.map((bundleName) => {
                const entry = grouped![bundleName]
                return (
                  <BundleGroup
                    key={bundleName}
                    bundleName={bundleName}
                    entry={entry}
                    bundles={state.bundles}
                    iconCache={state.iconCache}
                    nameCache={state.nameCache}
                    onOpenBundle={handleOpenBundle}
                    onOpenApp={handleOpenApp}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
