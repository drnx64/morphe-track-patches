import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, getAppIconUrl } from '../../utils/misc'
import { idbGet, idbSet } from '../../services/indexedDB'
import { fetchChangelog, fetchReleaseCache } from '../../services/fetchData'
import { stripVersionHeader, parseReleaseNotes, renderReleaseSections } from '../../services/releaseParser'
import { formatFriendlyDate } from '../../utils/format'
import { getPlayStoreUrl, getRepoInfo, getAddMorpheUrl } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { CACHE_KEYS } from '../../types/utils'
import Modal from '../shared/Modal'
import AppIcon from '../shared/AppIcon'
import ChannelBadge from '../shared/ChannelBadge'
import VersionChip from '../shared/VersionChip'
import type { AppData, PatchData, PatchDiff } from '../../types/bundles'
import type { ReleaseCacheData } from '../../types/api'

interface HistoryEntry {
  date: string
  bundleName: string
  badgeType: string
  version: string
}

export default function AppDetailModal() {
  const { state } = useAppContext()
  const [open, setOpen] = useState(false)
  const [app, setApp] = useState<AppData | null>(null)
  const [bundleName, setBundleName] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [currentChannel, setCurrentChannel] = useState<'stable' | 'dev'>('stable')
  const [appHistory, setAppHistory] = useState<HistoryEntry[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [releaseCache, setReleaseCache] = useState<ReleaseCacheData | null>(null)
  const [patchDiff, setPatchDiff] = useState<PatchDiff | null>(null)
  const [patchDiffExpanded, setPatchDiffExpanded] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setApp(detail.app)
      setBundleName(detail.bundleName)
      setChannels(detail.channels || [])
      setCurrentChannel('stable')
      setHistoryExpanded(false)
      setOpen(true)
    }
    window.addEventListener('open-app', handler)
    return () => window.removeEventListener('open-app', handler)
  }, [])

  useEffect(() => {
    if (!app?.patch_diff) { setPatchDiff(null); return }
    setPatchDiff(app.patch_diff)
  }, [app])

  useEffect(() => {
    if (!open || !app) return
    const pkg = app.package
    const load = async () => {
      const [cachedCL, cachedRC] = await Promise.all([
        idbGet<any[]>(CACHE_KEYS.CHANGELOG),
        idbGet<ReleaseCacheData>(CACHE_KEYS.RELEASE_CACHE),
      ])
      if (cachedCL) setAppHistory(filterAppHistory(cachedCL, pkg))
      if (cachedRC) setReleaseCache(cachedRC)

      const [freshCL, freshRC] = await Promise.all([
        fetchChangelog(),
        fetchReleaseCache(),
      ])
      if (freshCL) {
        setAppHistory(filterAppHistory(freshCL, pkg))
        idbSet(CACHE_KEYS.CHANGELOG, freshCL)
      }
      if (freshRC && Object.keys(freshRC).length > 0) {
        setReleaseCache(freshRC)
        idbSet(CACHE_KEYS.RELEASE_CACHE, freshRC)
      }
    }
    load()
  }, [open, app])

  const close = useCallback(() => setOpen(false), [])

  if (!app) return null

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const stableBundle = state.bundles[stableKey]
  const devBundle = state.bundles[devKey]
  const stableAppData = stableBundle?.apps?.find((a) => a.package === app.package)
  const devAppData = devBundle?.apps?.find((a) => a.package === app.package)

  const hasStable = !!stableAppData
  const hasDev = !!devAppData
  const defaultChannel: 'stable' | 'dev' = !hasStable && hasDev ? 'dev' : 'stable'

  const showChannel = currentChannel === 'stable' ? stableAppData : devAppData
  const showPatches = showChannel?.patches || []

  const repoUrl = stableBundle?.repo_url || devBundle?.repo_url || `https://github.com/${bundleName}/revanced-patches`
  const addMorpheUrl = getAddMorpheUrl(repoUrl)

  const allVersions = new Set<string>()
  for (const p of showPatches) {
    if (p.compatible_versions) {
      for (const v of p.compatible_versions) allVersions.add(v)
    }
  }
  const versionArr = [...allVersions].sort()

  const modalContent = (
    <>
      <div className="modal-header">
        <div className="modal-header-top">
          <div className="modal-app-identity">
            <h3 className="modal-app-name" id="modal-app-name">
              <AppIcon iconUrl={getAppIconUrl(app, state.iconCache)} sizeClass="app-icon app-icon-modal" />
              {escHtml(resolveAppName(app, state.nameCache))}
            </h3>
            <div className="modal-meta-row">
              <a
                className="modal-pkg-link"
                id="modal-pkg-link"
                href={getPlayStoreUrl(app.package)}
                target="_blank"
                rel="noopener"
              >
                {app.package}
              </a>
              <span className="modal-bundle-info" id="modal-bundle-info">in {bundleName}</span>
            </div>
            <div className="modal-channel-row" id="modal-channel-row">
              {channels.map((ch) => (
                <ChannelBadge key={ch} channel={ch} />
              ))}
            </div>
          </div>
          <div className="modal-header-actions">
            <a className="modal-play-btn" href={getPlayStoreUrl(app.package)} target="_blank" rel="noopener">
              Play Store
            </a>
            <button className="modal-close" id="modal-close-btn" aria-label="Close modal" onClick={close}>
              &times;
            </button>
          </div>
        </div>
        <div className="modal-versions-section">
          <span className="versions-label">Versions:</span>
          <div className="versions-row" id="modal-versions-row">
            {versionArr.length === 0 ? (
              <VersionChip version="Any version" any />
            ) : (
              versionArr.map((v) => <VersionChip key={v} version={v} />)
            )}
          </div>
        </div>
        {hasStable && hasDev && (
          <div className="modal-channel-toggle" id="modal-channel-toggle">
            <button
              className={`channel-toggle-btn${currentChannel === 'stable' ? ' active' : ''}`}
              data-channel="stable"
              onClick={() => setCurrentChannel('stable')}
            >
              Stable
            </button>
            <button
              className={`channel-toggle-btn${currentChannel === 'dev' ? ' active' : ''}`}
              data-channel="dev"
              onClick={() => setCurrentChannel('dev')}
            >
              Dev
            </button>
          </div>
        )}
      </div>

      <div className="modal-body">
        <div className="bundle-modal-actions">
          <a className="add-morphe-btn" href={addMorpheUrl} target="_blank" rel="noopener">Add to Morphe</a>
        </div>

        {patchDiff && (
          <div className="app-diff-section">
            <div
              className="app-diff-header"
              role="button"
              tabIndex={0}
              onClick={() => setPatchDiffExpanded(!patchDiffExpanded)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPatchDiffExpanded(!patchDiffExpanded) } }}
            >
              <span className="app-diff-title">Changes in this update</span>
              <span className={`app-history-toggle${patchDiffExpanded ? ' expanded' : ''}`}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
                </svg>
              </span>
            </div>
            {patchDiffExpanded && (
              <div className="app-diff-body">
                {renderPatchDiff(patchDiff)}
              </div>
            )}
          </div>
        )}

        <div className="modal-patches-header">
          <span className="modal-patches-title">Patches</span>
          <span className="modal-patches-count" id="modal-patches-count">
            {showPatches.length} patch{showPatches.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <div className="modal-patches-list" id="modal-patches-list">
          {showPatches.length === 0 ? (
            <div className="modal-no-patches">No patch details available for this app.</div>
          ) : (
            showPatches.map((patch, idx) => (
              <PatchItem
                key={`${patch.name}-${idx}`}
                patch={patch}
                idx={idx}
                isDev={currentChannel === 'dev'}
              />
            ))
          )}
        </div>

        {appHistory.length > 0 && (
          <div className="app-history-section">
            <div
              className="app-history-header"
              role="button"
              tabIndex={0}
              onClick={() => setHistoryExpanded(!historyExpanded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setHistoryExpanded(!historyExpanded)
                }
              }}
            >
              <span className="app-history-title">Changelog History</span>
              <span className="app-history-count">{appHistory.length} update{appHistory.length !== 1 ? 's' : ''}</span>
              <span className={`app-history-toggle${historyExpanded ? ' expanded' : ''}`}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                  <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
                </svg>
              </span>
            </div>
            {historyExpanded && (
              <div className="app-history-list">
                {appHistory.map((entry, di) => (
                  <AppHistoryItem
                    key={di}
                    entry={entry}
                    releaseCache={releaseCache}
                    appName={resolveAppName(app, state.nameCache)}
                    appPackage={app.package}
                    bundles={state.bundles}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  return (
    <Modal id="app-detail-modal" open={open} onClose={close} ariaLabel={resolveAppName(app, state.nameCache)}>
      {modalContent}
    </Modal>
  )
}

function PatchItem({ patch, idx, isDev }: { patch: PatchData; idx: number; isDev: boolean }) {
  const [expanded, setExpanded] = useState(true)
  const isOff = patch.use === false
  const desc = patch.description || ''
  const hasOptions = patch.options && patch.options.length > 0
  const isExpandable = desc.length > 0 || hasOptions

  return (
    <div className={`modal-patch-item${expanded && isExpandable ? ' expanded' : ''}`} id={`modal-patch-${idx}`}>
      <div
        className="modal-patch-header"
        role={isExpandable ? 'button' : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        onClick={() => isExpandable && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (isExpandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <div className="modal-patch-title-row">
          <span className={`patch-name${isExpandable ? ' patch-name--clickable' : ''}`}>
            {escHtml(patch.name)}
          </span>
          {isDev && patch.isDevOnly && <span className="badge badge-dev">DEV</span>}
          {isDev && patch.isNew && <span className="badge badge-new-patch">NEW</span>}
          {isOff && <span className="patch-off-badge">Off by default</span>}
        </div>
        {isExpandable && (
          <span className="modal-patch-toggle-icon">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
            </svg>
          </span>
        )}
      </div>
      {isExpandable && expanded && (
        <div className="modal-patch-body">
          {desc && <p className="modal-patch-desc">{escHtml(desc)}</p>}
          {hasOptions && (
            <div className="modal-patch-options">
              {patch.options!.map((opt) => (
                <div key={opt.key} className="modal-patch-option">
                  <span className="patch-option-key">{escHtml(opt.key)}</span>
                  {opt.description && (
                    <span className="patch-option-desc">{escHtml(opt.description)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AppHistoryItem({
  entry,
  releaseCache,
  appName,
  appPackage,
  bundles,
}: {
  entry: HistoryEntry
  releaseCache: ReleaseCacheData | null
  appName: string
  appPackage: string
  bundles: Record<string, any>
}) {
  const BADGE_CLS: Record<string, string> = {
    'NEW APP': 'badge badge-new',
    'UPDATED APP': 'badge badge-updated',
    'REMOVED APP': 'badge badge-removed',
  }

  const [notesHtml, setNotesHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!releaseCache) return
    const stableKey = `${entry.bundleName}:stable`
    const devKey = `${entry.bundleName}:dev`
    const b = bundles[stableKey] || bundles[devKey]
    const repoUrl: string = b?.repo_url || ''
    if (!repoUrl || !releaseCache[repoUrl]) {
      setNotesHtml(null)
      return
    }
    const releases = releaseCache[repoUrl].releases
    if (!releases?.length) {
      setNotesHtml(null)
      return
    }
    const match = releases.find((r) => {
      const tag = r.tag.toLowerCase().replace(/^v/, '')
      const ver = entry.version.toLowerCase().replace(/^v/, '')
      return tag === ver
    }) || releases[0]
    if (!match?.body) {
      setNotesHtml(null)
      return
    }
    const clean = stripVersionHeader(match.body)
    const parsed = parseReleaseNotes(clean)
    const matchApp = (text: string): boolean => {
      const lower = text.toLowerCase()
      const pkgEsc = appPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${pkgEsc}\\b`, 'i').test(lower)) return true
      const nameLower = appName.toLowerCase()
      const nameWords = nameLower.split(/\s+/)
      if (nameWords.length >= 2) {
        const multiWordPat = nameWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')
        if (new RegExp(multiWordPat, 'i').test(lower)) return true
      }
      for (const word of nameWords) {
        if (word.length >= 5 && new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) return true
      }
      return false
    }
    const relevant = parsed.filter((s) => {
      if (s.mode === 'markdown') {
        const md = s.markdown || ''
        return matchApp(md)
      }
      return s.entries.some((e) => {
        const scope = e.scope || ''
        const desc = e.description || ''
        return matchApp(scope) || matchApp(desc)
      })
    })
    if (relevant.length > 0) {
      setNotesHtml(renderReleaseSections(relevant))
    } else {
      setNotesHtml(null)
    }
  }, [releaseCache, entry, appName, appPackage, bundles])

  return (
    <div className="app-history-day">
      <div className="app-history-date">{formatFriendlyDate(entry.date)}</div>
      <div className="app-history-entry">
        <span className={BADGE_CLS[entry.badgeType] || 'badge badge-updated'}>
          {entry.badgeType || 'UPDATED'}
        </span>
        {entry.version && <span className="badge badge-version">{escHtml(entry.version)}</span>}
        <span className="app-history-bundle">{escHtml(entry.bundleName)}</span>
      </div>
      {notesHtml ? (
        <div className="app-history-notes" dangerouslySetInnerHTML={{ __html: notesHtml }} />
      ) : (
        <div className="app-history-notes app-history-notes--empty">No updates specified.</div>
      )}
    </div>
  )
}

function renderPatchDiff(diff: PatchDiff): string {
  let html = ''
  if (diff.patches_added?.length) {
    html += '<div class="diff-group diff-added"><div class="diff-group-label">Added</div>'
    for (const p of diff.patches_added) {
      const name = typeof p === 'string' ? p : p.name
      html += `<div class="diff-entry">+ ${escHtml(name)}</div>`
    }
    html += '</div>'
  }
  if (diff.patches_removed?.length) {
    html += '<div class="diff-group diff-removed"><div class="diff-group-label">Removed</div>'
    for (const p of diff.patches_removed) {
      const name = typeof p === 'string' ? p : p.name
      html += `<div class="diff-entry">- ${escHtml(name)}</div>`
    }
    html += '</div>'
  }
  if (diff.patches_modified?.length) {
    html += '<div class="diff-group diff-modified"><div class="diff-group-label">Modified</div>'
    for (const p of diff.patches_modified) {
      const name = typeof p === 'string' ? p : p.name
      html += `<div class="diff-entry">~ ${escHtml(name)}</div>`
    }
    html += '</div>'
  }
  return html || '<div class="diff-empty">No patch changes recorded.</div>'
}

function filterAppHistory(changelog: any[], pkg: string): HistoryEntry[] {
  const result: HistoryEntry[] = []
  const seen = new Set<string>()
  for (const day of changelog) {
    for (const b of (day.affected_bundles || [])) {
      for (const app of (b.apps || [])) {
        if (app.package === pkg) {
          const key = `${day.date}|${b.bundle}|${app.badge_type}|${app.package}`
          if (!seen.has(key)) {
            seen.add(key)
            result.push({
              date: day.date,
              bundleName: b.bundle,
              badgeType: app.badge_type,
              version: b.version || '',
            })
          }
        }
      }
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date))
}