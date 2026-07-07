import { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { idbGet, idbSet } from '../../services/indexedDB'
import { fetchChangelog, fetchAllData, fetchIconCache, fetchNameCache } from '../../services/fetchData'
import { preloadIcons } from '../../services/iconCache'
import { formatFriendlyDate } from '../../utils/format'
import { groupAffectedBundles, isAppPreRelease, resolveAppName, getAppIconUrl } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { CACHE_KEYS } from '../../types/utils'
import Header from '../layout/Header'
import Footer from '../layout/Footer'
import ToastNotification from '../layout/ToastNotification'
import ScanInfoSection from '../dashboard/ScanInfoSection'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'
import AppIcon from '../shared/AppIcon'
import { Badge } from '../shared/Badge'
import ChannelBadge from '../shared/ChannelBadge'
import { SkeletonChangelog } from '../shared/Skeleton'
import type { ChangelogEntry } from '../../types/changelog'
import type { BundleData } from '../../types/bundles'

export default function ChangelogPage() {
  const { state, dispatch } = useAppContext()
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('morphe_changelog_view') as 'grid' | 'list') || 'grid',
  )

  useEffect(() => {
    const load = async () => {
      const [cachedCL, cachedLive, cachedIcons, cachedNames] = await Promise.all([
        idbGet<ChangelogEntry[]>(CACHE_KEYS.CHANGELOG),
        idbGet<any>(CACHE_KEYS.LIVE),
        idbGet<Record<string, string>>(CACHE_KEYS.ICONS),
        idbGet<Record<string, string>>(CACHE_KEYS.NAMES),
      ])

      if (cachedCL && cachedLive && cachedIcons) {
        setChangelog(cachedCL)
        dispatch({ type: 'SET_BUNDLES', payload: cachedLive.bundles || {} })
        dispatch({ type: 'SET_ICON_CACHE', payload: cachedIcons })
        if (cachedNames) dispatch({ type: 'SET_NAME_CACHE', payload: cachedNames })
        dispatch({ type: 'SET_METADATA', payload: { liveDataDate: cachedLive.date || '', lastChecked: cachedLive.lastChecked || '' } })
        setLoading(false)
      }

      const [iconData, nameData] = await Promise.all([
        fetchIconCache(),
        fetchNameCache(),
      ])
      dispatch({ type: 'SET_ICON_CACHE', payload: iconData })
      idbSet(CACHE_KEYS.ICONS, iconData)
      preloadIcons(iconData)
      if (nameData) {
        dispatch({ type: 'SET_NAME_CACHE', payload: nameData })
        idbSet(CACHE_KEYS.NAMES, nameData)
      }

      const [clData, liveData] = await Promise.all([
        fetchChangelog(),
        fetchAllData(),
      ])
      const cl = clData as ChangelogEntry[]
      setChangelog(cl)
      dispatch({ type: 'SET_BUNDLES', payload: liveData.bundles || {} })
      dispatch({
        type: 'SET_METADATA',
        payload: { liveDataDate: liveData.date || '', lastChecked: liveData.lastChecked || '' },
      })
      idbSet(CACHE_KEYS.CHANGELOG, cl)
      idbSet(CACHE_KEYS.LIVE, liveData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading && changelog.length === 0) {
    return (
      <>
        <Header />
        <main className="dashboard-container">
          <div className="glow-container">
            <div className="glow-orb main-orb" />
            <div className="glow-orb sub-orb" />
          </div>
          <section className="changelog-section" aria-labelledby="changelog-heading">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 className="section-title" id="changelog-heading" style={{ margin: 0 }}>Historical Updates</h2>
            </div>
            <div className="changelog-list" id="changelog-list-container">
              <div id="skeleton-changelog"><SkeletonChangelog /></div>
            </div>
          </section>
          <ScanInfoSection />
        </main>
        <Footer />
        <AppDetailModal />
        <BundleDetailModal />
        <BundleHistoryModal />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="dashboard-container">
        <div className="glow-container">
          <div className="glow-orb main-orb" />
          <div className="glow-orb sub-orb" />
        </div>

        <section className="changelog-section" aria-labelledby="changelog-heading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="section-title" id="changelog-heading" style={{ margin: 0 }}>Historical Updates</h2>
            <div className="view-toggle-group" id="changelog-view-toggle">
              <button
                className={`view-toggle-opt${viewMode === 'grid' ? ' active' : ''}`}
                data-view="grid"
                title="Default view"
                onClick={() => { setViewMode('grid'); localStorage.setItem('morphe_changelog_view', 'grid') }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h2A1.5 1.5 0 0 1 6 2.5v2A1.5 1.5 0 0 1 4.5 6h-2A1.5 1.5 0 0 1 1 4.5v-2zm5 0A1.5 1.5 0 0 1 7.5 1h2A1.5 1.5 0 0 1 11 2.5v2A1.5 1.5 0 0 1 9.5 6h-2A1.5 1.5 0 0 1 6 4.5v-2zm5 0A1.5 1.5 0 0 1 12.5 1h2A1.5 1.5 0 0 1 16 2.5v2A1.5 1.5 0 0 1 14.5 6h-2A1.5 1.5 0 0 1 11 4.5v-2zM1 7.5A1.5 1.5 0 0 1 2.5 6h2A1.5 1.5 0 0 1 6 7.5v2A1.5 1.5 0 0 1 4.5 11h-2A1.5 1.5 0 0 1 1 9.5v-2zm5 0A1.5 1.5 0 0 1 7.5 6h2A1.5 1.5 0 0 1 11 7.5v2A1.5 1.5 0 0 1 9.5 11h-2A1.5 1.5 0 0 1 6 9.5v-2zm5 0A1.5 1.5 0 0 1 12.5 6h2A1.5 1.5 0 0 1 16 7.5v2A1.5 1.5 0 0 1 14.5 11h-2A1.5 1.5 0 0 1 11 9.5v-2zM1 12.5A1.5 1.5 0 0 1 2.5 11h2A1.5 1.5 0 0 1 6 12.5v2A1.5 1.5 0 0 1 4.5 16h-2A1.5 1.5 0 0 1 1 14.5v-2zm5 0A1.5 1.5 0 0 1 7.5 11h2A1.5 1.5 0 0 1 11 12.5v2A1.5 1.5 0 0 1 9.5 16h-2A1.5 1.5 0 0 1 6 14.5v-2zm5 0a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2z" /></svg>
                <span>Cards</span>
              </button>
              <button
                className={`view-toggle-opt${viewMode === 'list' ? ' active' : ''}`}
                data-view="list"
                title="Compact view"
                onClick={() => { setViewMode('list'); localStorage.setItem('morphe_changelog_view', 'list') }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" /></svg>
                <span>Compact</span>
              </button>
            </div>
          </div>
          <div className={`changelog-list${viewMode === 'list' ? ' changelog-compact' : ''}`} id="changelog-list-container">
            {changelog.length === 0 ? (
              <div className="loading-state">No changelog entries found.</div>
            ) : (
              changelog.map((day) => (
                <DayCard key={day.date} day={day} />
              ))
            )}
          </div>
        </section>

        <ScanInfoSection />
      </main>
      <Footer />
      <ToastNotification />
      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}

function DayCard({ day }: { day: ChangelogEntry }) {
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

  for (const bName of sortedBundleNames) {
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
        const iconHtml = iconUrl ? `<a href="https://play.google.com/store/apps/details?id=${encodeURIComponent(app.package)}" target="_blank" class="app-icon-link"><img class="app-icon" src="${iconUrl}" alt="" loading="lazy"></a>` : ''
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

  if (!dayHtml) {
    dayHtml = '<div class="loading-state" style="padding: 1rem;">No major changes recorded on this date.</div>'
  }

  return (
    <div className="changelog-day-card">
      <div className="changelog-date-header">{formatFriendlyDate(day.date)}</div>
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
      />
    </div>
  )
}

function getAppBadgeHtml(badgeType?: string): string {
  const map: Record<string, string> = {
    'NEW APP': '<span class="badge badge-new">NEW APP</span>',
    'UPDATED APP': '<span class="badge badge-updated">UPDATED APP</span>',
    'REMOVED APP': '<span class="badge badge-removed">REMOVED APP</span>',
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
