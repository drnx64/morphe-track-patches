import { useMemo, useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { formatFriendlyDate } from '../../utils/format'
import { groupAffectedBundles, isAppPreRelease, resolveAppName, getAppIconUrl } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { ARROW_LEFT, ARROW_RIGHT } from '../../utils/svg'
import PageShell from '../layout/PageShell'
import ScanInfoSection from '../dashboard/ScanInfoSection'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'
import { getCachedIconDataUrl, preloadIconsFromPackages } from '../../services/iconCache'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useLastVisit } from '../../hooks/useLastVisit'
import ChannelBadge from '../shared/ChannelBadge'
import { SkeletonChangelog } from '../shared/Skeleton'
import type { ChangelogEntry } from '../../types/changelog'

export default function ChangelogPage() {
  const { state, dispatch } = useAppContext()
  const { loading } = useDataFetching()
  usePageMeta(
    'Changelog',
    'Historical changelog of Morphe patch bundle updates across stable and dev channels.',
  )
  const { isNew: isNewDay } = useLastVisit()

  const changelog = state.changelog
  const viewMode = state.changelogViewMode
  const PAGE_SIZE = 10
  const [page, setPage] = useState(0)
  const [, setIconTick] = useState(0)

  const totalPages = Math.max(1, Math.ceil(changelog.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)

  const pageItems = useMemo(
    () => changelog.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [changelog, safePage, PAGE_SIZE],
  )

  useEffect(() => {
    if (pageItems.length === 0) return
    const pkgs = new Set<string>()
    for (const day of pageItems) {
      for (const bundle of day.affected_bundles || []) {
        for (const app of bundle.apps || []) {
          if (app.package) pkgs.add(app.package)
        }
      }
    }
    if (pkgs.size === 0) return
    let cancelled = false
    preloadIconsFromPackages([...pkgs], state.iconCache).then(() => {
      if (!cancelled) setIconTick((n) => n + 1)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pageItems, state.iconCache])

  if (loading && changelog.length === 0) {
    return (
      <PageShell>
        <section className="changelog-section" aria-labelledby="changelog-heading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-title" id="changelog-heading" style={{ margin: 0 }}>Historical Updates</h2>
          </div>
          <div className="changelog-list" id="changelog-list-container">
            <div id="skeleton-changelog"><SkeletonChangelog /></div>
          </div>
        </section>
        <ScanInfoSection />
      </PageShell>
    )
  }

  return (
    <>
      <PageShell>
        <section className="changelog-section" aria-labelledby="changelog-heading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-title" id="changelog-heading" style={{ margin: 0 }}>Historical Updates</h2>
            <div className="view-toggle-group" id="changelog-view-toggle">
              <button
                className={`view-toggle-opt${viewMode === 'grid' ? ' active' : ''}`}
                data-view="grid"
                title="Default view"
                onClick={() => dispatch({ type: 'SET_CHANGELOG_VIEW_MODE', payload: 'grid' })}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h2A1.5 1.5 0 0 1 6 2.5v2A1.5 1.5 0 0 1 4.5 6h-2A1.5 1.5 0 0 1 1 4.5v-2zm5 0A1.5 1.5 0 0 1 7.5 1h2A1.5 1.5 0 0 1 11 2.5v2A1.5 1.5 0 0 1 9.5 6h-2A1.5 1.5 0 0 1 6 4.5v-2zm5 0A1.5 1.5 0 0 1 12.5 1h2A1.5 1.5 0 0 1 16 2.5v2A1.5 1.5 0 0 1 14.5 6h-2A1.5 1.5 0 0 1 11 4.5v-2zM1 7.5A1.5 1.5 0 0 1 2.5 6h2A1.5 1.5 0 0 1 6 7.5v2A1.5 1.5 0 0 1 4.5 11h-2A1.5 1.5 0 0 1 1 9.5v-2zm5 0A1.5 1.5 0 0 1 7.5 6h2A1.5 1.5 0 0 1 11 7.5v2A1.5 1.5 0 0 1 9.5 11h-2A1.5 1.5 0 0 1 6 9.5v-2zm5 0A1.5 1.5 0 0 1 12.5 6h2A1.5 1.5 0 0 1 16 7.5v2A1.5 1.5 0 0 1 14.5 11h-2A1.5 1.5 0 0 1 11 9.5v-2zM1 12.5A1.5 1.5 0 0 1 2.5 11h2A1.5 1.5 0 0 1 6 12.5v2A1.5 1.5 0 0 1 4.5 16h-2A1.5 1.5 0 0 1 1 14.5v-2zm5 0A1.5 1.5 0 0 1 7.5 11h2A1.5 1.5 0 0 1 11 12.5v2A1.5 1.5 0 0 1 9.5 16h-2A1.5 1.5 0 0 1 6 14.5v-2zm5 0a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2z" /></svg>
                <span>Cards</span>
              </button>
              <button
                className={`view-toggle-opt${viewMode === 'list' ? ' active' : ''}`}
                data-view="list"
                title="Compact view"
                onClick={() => dispatch({ type: 'SET_CHANGELOG_VIEW_MODE', payload: 'list' })}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" /></svg>
                <span>Compact</span>
              </button>
            </div>
          </div>
          <div className={`changelog-list${viewMode === 'list' ? ' changelog-compact' : ''}`} id="changelog-list-container">
            {pageItems.length === 0 ? (
              <div className="loading-state">No changelog entries found.</div>
            ) : (
              pageItems.map((day, idx) => (
                <DayCard key={day.date} day={day} scanIndex={changelog.length - (safePage * PAGE_SIZE) - idx} isNew={isNewDay(day.date)} />
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="changelog-pagination">
              <button
                className="changelog-page-btn"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                <span dangerouslySetInnerHTML={{ __html: ARROW_LEFT }} /> Previous
              </button>
              <span className="changelog-page-info">
                Page {safePage + 1} of {totalPages}
                <span className="changelog-page-count">({changelog.length} scans)</span>
              </span>
              <button
                className="changelog-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
              >
                Next <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} />
              </button>
            </div>
          )}
        </section>

        <ScanInfoSection />
      </PageShell>

      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}

function DayCard({ day, scanIndex, isNew }: { day: ChangelogEntry; scanIndex: number; isNew: boolean }) {
  const { state } = useAppContext()
  const grouped = groupAffectedBundles(day.affected_bundles || [])

  const sortedBundleNames = Object.keys(grouped).sort((a, b) => {
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

  let dayHtml = ''

  const newBundles: string[] = []
  const updatedWithNewApps: string[] = []
  const updatedBundles: string[] = []

  for (const bName of sortedBundleNames) {
    const bGroup = grouped[bName]
    if (bGroup.badge_type === 'NEW BUNDLE') {
      newBundles.push(bName)
    } else if (bGroup.apps.some((app) => app.badge_type === 'NEW APP')) {
      updatedWithNewApps.push(bName)
    } else {
      updatedBundles.push(bName)
    }
  }

  const sections: { title: string; names: string[] }[] = []
  if (newBundles.length > 0) sections.push({ title: 'New Bundles', names: newBundles })
  if (updatedWithNewApps.length > 0) sections.push({ title: 'Updated Bundles with New Apps', names: updatedWithNewApps })
  if (updatedBundles.length > 0) sections.push({ title: 'Updated Bundles', names: updatedBundles })

  for (const section of sections) {
    dayHtml += `<div class="changelog-section-header">${escHtml(section.title)}</div>`

    for (const bName of section.names) {
      const bGroup = grouped[bName]
      const isNewBundle = bGroup.badge_type === 'NEW BUNDLE'
      const stableKey = `${bName}:stable`
      const devKey = `${bName}:dev`
      const stableB = state.bundles[stableKey]
      const devB = state.bundles[devKey]
      const repoUrl = stableB?.repo_url || devB?.repo_url || `https://github.com/${bName}/revanced-patches`
      const bVersion = stableB?.version || devB?.version || ''
      const versionTag = bVersion ? ` <span class="bundle-version-tag">${escHtml(bVersion)}</span>` : ''

      dayHtml += `<div class="changelog-bundle-group">`

      if (isNewBundle) {
        const authorHtml = getAuthorHtml(repoUrl)
        dayHtml += `<div class="changelog-bundle-header"><span class="badge badge-new-bundle">NEW BUNDLE</span><span>Bundle <a href="/#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${escHtml(bName)} patches</strong></a>${versionTag} (${bGroup.channels.join(', ')}) added by ${authorHtml}</span></div>`
      } else {
        dayHtml += `<div class="changelog-bundle-header"><span class="badge badge-updated">UPDATED</span><span>Bundle <a href="/#bundle=${encodeURIComponent(bName)}" class="changelog-bundle-link"><strong>${escHtml(bName)} patches</strong></a>${versionTag}</span></div>`
      }

      if (bGroup.apps.length > 0) {
        dayHtml += `<ul class="changelog-bundle-apps">`
        const sortedApps = [...bGroup.apps].sort((a, b) => {
          const order: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }
          return (order[a.badge_type!] ?? 1) - (order[b.badge_type!] ?? 1)
        })

        for (const app of sortedApps) {
          const badgeHtml = getAppBadgeHtml(app.badge_type)
          const isPre = isAppPreRelease(bName, app.package, state.bundles)
          const preBadge = isPre ? '<span class="badge badge-pre-release">PRE-RELEASE</span>' : ''
          const promotedBadge = app.promoted_from ? '<span class="badge badge-promoted">MOVED TO STABLE</span>' : ''
          const iconUrl = getAppIconUrl(app, state.iconCache)
          const dataUrl = iconUrl ? getCachedIconDataUrl(iconUrl) : null
          const iconHtml = iconUrl ? `<a href="https://play.google.com/store/apps/details?id=${encodeURIComponent(app.package)}" target="_blank" class="app-icon-link"><img class="app-icon" src="${dataUrl || iconUrl}" alt="" loading="lazy"></a>` : ''
          const channelsJson = escHtml(JSON.stringify(bGroup.channels))
          const patchDiffJson = app.patch_diff ? escHtml(JSON.stringify(app.patch_diff)) : ''
          const summaryAttr = app.summary ? escHtml(app.summary).replace(/'/g, '&apos;') : ''
          const scanBadges = (app.scan_numbers || []).map((sn) => `<span class="badge badge-scan">${sn}</span>`).join(' ')

          dayHtml += `<li class="changelog-item" data-bundle="${escHtml(bName)}" data-package="${escHtml(app.package)}" data-channels='${channelsJson}' data-patch-diff='${patchDiffJson}' data-summary='${summaryAttr}'>`
          dayHtml += `<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">${badgeHtml}${preBadge}${promotedBadge}${iconHtml}<span><strong class="changelog-app-link" role="button" tabindex="0">${escHtml(resolveAppName(app, state.nameCache))}</strong> ${scanBadges}</span></div>`
          dayHtml += `</li>`
        }
        dayHtml += `</ul>`
      }

      dayHtml += `</div>`
    }
  }

  if (!dayHtml) {
    dayHtml = '<div class="loading-state" style="padding: 1rem;">No major changes recorded on this date.</div>'
  }

  const handleDateClick = () => {
    const bundleNames = Object.keys(grouped)
    if (bundleNames.length > 0) {
      const firstBundle = bundleNames[0]
      const channels = grouped[firstBundle].channels
      window.dispatchEvent(new CustomEvent('open-bundle-history', {
        detail: { bundleName: firstBundle, focusDate: day.date, channels },
      }))
    }
  }

  return (
    <div className="changelog-day-card">
      <div
        className="changelog-date-header"
        role="button"
        tabIndex={0}
        onClick={handleDateClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDateClick() } }}
      >
        <span className="changelog-batch-badge">Scan #{scanIndex}</span>
        <span>{formatFriendlyDate(day.date)}</span>
        {isNew && <span className="badge badge-new badge-changelog-new">NEW</span>}
        <span className="changelog-date-arrow" dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} />
      </div>
      <div
        dangerouslySetInnerHTML={{ __html: dayHtml }}
        onClick={(e) => {
          const link = (e.target as HTMLElement).closest('.changelog-bundle-link')
          if (link) {
            e.preventDefault()
            const bundleName = link.querySelector('strong')?.textContent?.trim().replace(/ patches$/, '') || link.textContent?.trim().replace(/ patches$/, '') || ''
            const found = grouped[bundleName]
            const channels = found ? found.channels : []
            window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
            return
          }

          const appLink = (e.target as HTMLElement).closest('.changelog-app-link')
          if (appLink) {
            const item = appLink.closest('.changelog-item') as HTMLElement
            if (!item) return
            const pkg = item.dataset.package
            const bName = item.dataset.bundle
            const channels = JSON.parse(item.dataset.channels || '[]')
            if (!pkg || !bName) return
            const stableKey = `${bName}:stable`
            const devKey = `${bName}:dev`
            let appData = state.bundles[stableKey]?.apps?.find((a) => a.package === pkg)
            if (!appData) appData = state.bundles[devKey]?.apps?.find((a) => a.package === pkg)
            if (appData) {
              window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName: bName, channels } }))
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          const target = e.target as HTMLElement
          if (target.classList.contains('changelog-app-link')) {
            e.preventDefault()
            const item = target.closest('.changelog-item') as HTMLElement
            if (!item) return
            const pkg = item.dataset.package
            const bName = item.dataset.bundle
            const channels = JSON.parse(item.dataset.channels || '[]')
            if (!pkg || !bName) return
            const stableKey = `${bName}:stable`
            const devKey = `${bName}:dev`
            let appData = state.bundles[stableKey]?.apps?.find((a) => a.package === pkg)
            if (!appData) appData = state.bundles[devKey]?.apps?.find((a) => a.package === pkg)
            if (appData) {
              window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName: bName, channels } }))
            }
          } else if (target.classList.contains('changelog-bundle-link')) {
            e.preventDefault()
            const bundleName = target.querySelector('strong')?.textContent?.trim().replace(/ patches$/, '') || target.textContent?.trim().replace(/ patches$/, '') || ''
            const found = grouped[bundleName]
            const channels = found ? found.channels : []
            window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
          }
        }}
      />
    </div>
  )
}

function getAppBadgeHtml(badgeType?: string): string {
  const map: Record<string, string> = {
    'NEW APP': '<span class="badge badge-new">NEW APP</span>',
    'UPDATED APP': '<span class="badge badge-updated">UPDATED APP</span>',
    'REMOVED APP': '<span class="badge badge-removed">REMOVED APP</span>',
    'MAJOR UPDATE': '<span class="badge badge-major-update">MAJOR UPDATE</span>',
  }
  return map[badgeType || ''] || map['NEW APP']
}

function getAuthorHtml(repoUrl: string): string {
  const m = repoUrl.match(/https:\/\/(?:github|gitlab)\.com\/([^/]+)/)
  if (m) {
    return `<a href="https://${repoUrl.includes('gitlab') ? 'gitlab' : 'github'}.com/${m[1]}" target="_blank" class="author-link">@${m[1]}</a>`
  }
  return 'unknown'
}
