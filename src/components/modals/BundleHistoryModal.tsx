import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppContext } from '../../context/AppContext'
import { idbGet, idbSet } from '../../services/indexedDB'
import { fetchAllData, fetchChangelog, fetchReleaseCache } from '../../services/fetchData'
import { stripVersionHeader, parseReleaseNotes, renderReleaseSections } from '../../services/releaseParser'
import { formatFriendlyDate, formatTime } from '../../utils/format'
import { getRepoInfo } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { compareVersions, resolveAppName, getAppIconUrl } from '../../utils/misc'
import { CACHE_KEYS } from '../../types/utils'
import Modal from '../shared/Modal'
import ChannelBadge from '../shared/ChannelBadge'
import { Badge } from '../shared/Badge'
import AppIcon from '../shared/AppIcon'
import type { ChangelogEntry } from '../../types/changelog'
import type { ReleaseCacheData } from '../../types/api'
import type { BundleData } from '../../types/bundles'

export default function BundleHistoryModal() {
  const { state } = useAppContext()
  const [open, setOpen] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const [historyChannel, setHistoryChannel] = useState('')
  const [focusDate, setFocusDate] = useState('')
  const historyListRef = useRef<HTMLDivElement>(null)
  const changelogRef = useRef<any[]>([])
  const releaseCacheRef = useRef<ReleaseCacheData | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setBundleName(detail.bundleName)
      setHistoryChannel('')
      setFocusDate(detail.focusDate || '')
      setOpen(true)
    }
    window.addEventListener('open-bundle-history', handler)
    return () => window.removeEventListener('open-bundle-history', handler)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    Promise.all([
      idbGet<any>(CACHE_KEYS.CHANGELOG),
      idbGet<ReleaseCacheData>(CACHE_KEYS.RELEASE_CACHE),
    ]).then(([cl, rc]) => {
      if (cl) changelogRef.current = cl
      if (rc) releaseCacheRef.current = rc
    })

    Promise.all([
      fetchChangelog(),
      fetchReleaseCache(),
    ]).then(([cl, rc]) => {
      if (cl) {
        changelogRef.current = cl
        idbSet(CACHE_KEYS.CHANGELOG, cl)
      }
      if (rc && Object.keys(rc).length > 0) {
        releaseCacheRef.current = rc
        idbSet(CACHE_KEYS.RELEASE_CACHE, rc)
      }
    })
  }, [open])

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const stableBundle = state.bundles[stableKey]
  const devBundle = state.bundles[devKey]

  const hasStable = stableBundle?.version ? true : false
  const hasDev = devBundle?.version ? true : false

  let defaultChannel = historyChannel
  if (!defaultChannel) {
    if (hasStable && hasDev) {
      const sd = stableBundle.release_date || ''
      const dd = devBundle.release_date || ''
      if (sd && dd) {
        defaultChannel = sd >= dd ? 'stable' : 'dev'
      } else if (stableBundle.version && devBundle.version) {
        defaultChannel = compareVersions(stableBundle.version, devBundle.version) >= 0 ? 'stable' : 'dev'
      }
    }
    if (!defaultChannel) defaultChannel = hasDev ? 'dev' : 'stable'
  }

  const currentBundle = defaultChannel === 'dev' ? devBundle : stableBundle
  const repoUrl = currentBundle?.repo_url || ''

  const entriesMap: Record<string, { date: string; bundles: any[] }> = {}

  if (changelogRef.current) {
    for (const day of changelogRef.current as any[]) {
      const matching = (day.affected_bundles || []).filter((b: any) => b.bundle === bundleName)
      if (matching.length > 0) {
        if (!entriesMap[day.date]) entriesMap[day.date] = { date: day.date, bundles: [] }
        entriesMap[day.date].bundles.push(...matching)
      }
    }
  }

  if (releaseCacheRef.current?.[repoUrl]?.releases) {
    for (const rl of releaseCacheRef.current[repoUrl].releases) {
      if (!rl.dateReleased) continue
      const dateKey = rl.dateReleased.split('T')[0]
      if (!entriesMap[dateKey]) entriesMap[dateKey] = { date: dateKey, bundles: [] }
      entriesMap[dateKey].bundles.push({
        badge_type: 'RELEASE',
        channel: rl.prerelease ? 'dev' : 'stable',
        version: rl.tag,
        body: rl.body,
        isCurrent: rl.tag === (currentBundle?.release_tag || ''),
      })
    }
  }

  const entries = Object.values(entriesMap).sort((a, b) => b.date.localeCompare(a.date))

  useEffect(() => {
    if (!open || !focusDate || !historyListRef.current) return
    const timer = setTimeout(() => {
      const el = historyListRef.current?.querySelector(`[data-focus-date="${focusDate}"]`)
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('changelog-day-card--focused')
        setTimeout(() => el.classList.remove('changelog-day-card--focused'), 2000)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [open, focusDate])

  const repoInfo = getRepoInfo(repoUrl)
  const releasesUrl = repoInfo.path
    ? (repoInfo.isGitLab
        ? `https://gitlab.com/${repoInfo.path}/-/releases`
        : `https://github.com/${repoInfo.path}/releases`)
    : ''

  return (
    <Modal id="bundle-history-modal" open={open} onClose={close} wide ariaLabel={`${bundleName} history`}>
      <div className="modal-header">
        <div className="modal-header-top">
          <div className="modal-app-identity">
            <h3 className="modal-app-name" id="bundle-history-title">{bundleName} patches</h3>
            <div className="modal-meta-row">
              <span className="modal-bundle-info" id="bundle-history-subtitle">Releases &amp; update history</span>
            </div>
          </div>
          <div className="modal-header-actions">
            <button className="modal-close" id="bundle-history-close-btn" aria-label="Close history modal" onClick={close}>&times;</button>
          </div>
        </div>
      </div>

      <div className="modal-body">
        <div className="bundle-history-list" id="bundle-history-list">
          {currentBundle?.version && (
            <div className="bundle-release-card">
              {hasStable && hasDev && (
                <div className="history-channel-toggle">
                  <button
                    className={`channel-toggle-btn${defaultChannel === 'stable' ? ' active' : ''}`}
                    data-hchannel="stable"
                    onClick={() => setHistoryChannel('stable')}
                  >
                    Stable
                  </button>
                  <button
                    className={`channel-toggle-btn${defaultChannel === 'dev' ? ' active' : ''}`}
                    data-hchannel="dev"
                    onClick={() => setHistoryChannel('dev')}
                  >
                    Dev
                  </button>
                </div>
              )}

              <div className="bundle-release-header">
                <span className="bundle-release-version">
                  {escHtml(currentBundle.version)}
                  <span className="badge" style={{ background: '#22c55e', color: '#fff', fontSize: '0.65rem', marginLeft: '0.5rem' }}>CURRENT</span>
                </span>
                <span className="bundle-release-badges">
                  {(['stable', 'dev'] as const).filter((ch) => ch === 'stable' ? hasStable : hasDev).map((ch) => (
                    <ChannelBadge key={ch} channel={ch} />
                  ))}
                </span>
              </div>

              {currentBundle.release_date && (
                <div className="bundle-release-date">Released {formatTime(currentBundle.release_date)}</div>
              )}

              <div dangerouslySetInnerHTML={{ __html: renderReleaseBody(currentBundle, repoUrl, releaseCacheRef.current) }} />

              {releasesUrl && (
                <a href={releasesUrl} target="_blank" rel="noopener" className="bundle-release-link">
                  View all releases{repoInfo.isGitLab ? ' on GitLab' : ' on GitHub'} &rarr;
                </a>
              )}
            </div>
          )}

          {entries.length > 0 && (
            <>
              <div className="bundle-history-section-header">Update history</div>
              {entries.map((entry) => (
                <div key={entry.date} className="changelog-day-card" data-focus-date={entry.date}>
                  <div className="changelog-date-header">{formatFriendlyDate(entry.date)}</div>
                  {entry.bundles.map((b: any, i: number) => (
                    <div key={i}>
                      {b.badge_type === 'RELEASE' ? (
                        <>
                          <div className="changelog-bundle-header">
                            {b.isCurrent ? (
                              <span className="badge" style={{ background: '#22c55e', color: '#fff' }}>CURRENT</span>
                            ) : (
                              <span className="badge badge-updated">RELEASE</span>
                            )}
                            <span className="badge-version">{escHtml(b.version)}</span>
                            <ChannelBadge channel={b.channel} />
                          </div>
                          {b.body && <div dangerouslySetInnerHTML={{ __html: renderReleaseBodyFromText(b.body) }} />}
                        </>
                      ) : (
                        <>
                          <div className="changelog-bundle-header">
                            {b.badge_type === 'NEW BUNDLE' ? (
                              <span className="badge badge-new-bundle">NEW BUNDLE</span>
                            ) : (
                              <span className="badge badge-updated">UPDATED</span>
                            )}
                            <span>Channel: {b.channels || b.channel || ''}</span>
                          </div>
                          {b.apps && b.apps.length > 0 && (
                            <ul className="changelog-bundle-apps">
                              {b.apps.map((app: any, ai: number) => {
                                const abMap: Record<string, string> = {
                                  'NEW APP': '<span class="badge badge-new">NEW APP</span>',
                                  'UPDATED APP': '<span class="badge badge-updated">UPDATED APP</span>',
                                  'REMOVED APP': '<span class="badge badge-removed">REMOVED APP</span>',
                                }
                                return (
                                  <li key={ai} className="changelog-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span dangerouslySetInnerHTML={{ __html: abMap[app.badge_type] || abMap['NEW APP'] }} />
                                      <AppIcon iconUrl={getAppIconUrl(app, state.iconCache)} />
                                      <span>
                                        <strong
                                          className="changelog-app-link"
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => window.dispatchEvent(new CustomEvent('open-app', { detail: { app, bundleName, channels: b.channels || [b.channel] } }))}
                                        >
                                          {escHtml(resolveAppName(app, state.nameCache))}
                                        </strong>
                                      </span>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function renderReleaseBody(bundle: BundleData | undefined, repoUrl: string, releaseCache: ReleaseCacheData | null): string {
  if (!bundle) return ''
  let body = bundle.release_notes || ''
  if (!body && releaseCache && repoUrl) {
    const repoRels = releaseCache[repoUrl]
    if (repoRels?.releases?.length) {
      const matchTag = (bundle.release_tag || bundle.version || '').toLowerCase().replace(/^v/, '')
      for (const rl of repoRels.releases) {
        const tagClean = (rl.tag || '').toLowerCase().replace(/^v/, '')
        if (tagClean === matchTag) { body = rl.body; break }
      }
      if (!body) body = repoRels.releases[0].body || ''
    }
  }
  if (!body) return ''
  const clean = stripVersionHeader(body)
  const parsed = parseReleaseNotes(clean)
  if (parsed.length > 0) {
    return `<div class="bundle-release-desc" style="margin-top:0.5rem">${renderReleaseSections(parsed)}</div>`
  }
  return '<div class="bundle-release-desc bundle-release-desc--empty" style="margin-top:0.5rem">No details.</div>'
}

function renderReleaseBodyFromText(body: string): string {
  const clean = stripVersionHeader(body)
  const parsed = parseReleaseNotes(clean)
  if (parsed.length > 0) {
    return `<div class="bundle-release-desc">${renderReleaseSections(parsed)}</div>`
  }
  return '<div class="bundle-release-desc bundle-release-desc--empty">No details.</div>'
}
