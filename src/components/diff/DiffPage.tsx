import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { buildAppIndex, scoreAppSearch } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { FALLBACK_ICON, SEARCH_ICON, CLEAR_ICON, GRID_ICON } from '../../utils/svg'
import PageShell from '../layout/PageShell'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'
import type { PatchData } from '../../types/bundles'

interface BundleAppInfo {
  bundleName: string
  channel: string
  bundleVersion: string
  appVersions: string[]
  patches: PatchData[]
  releaseDate: string
}

function getAppVersions(patches: PatchData[]): string[] {
  const versions = new Set<string>()
  for (const p of patches) {
    for (const v of p.compatible_versions || []) {
      if (v) versions.add(v)
    }
  }
  return [...versions]
}

export default function DiffPage() {
  const { state } = useAppContext()
  const { loading } = useDataFetching()
  const [searchParams, setSearchParams] = useSearchParams()
  const appParam = searchParams.get('app') || ''
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPkg, setSelectedPkg] = useState('')
  const lastAppliedParam = useRef<string | null>(null)

  useEffect(() => {
    if (appParam && lastAppliedParam.current !== appParam && Object.keys(state.bundles).length > 0) {
      lastAppliedParam.current = appParam
      setSelectedPkg(appParam)
    }
  }, [appParam, state.bundles])

  const allApps = useMemo(
    () => buildAppIndex(state.bundles, state.nameCache, state.iconCache),
    [state.bundles, state.nameCache, state.iconCache],
  )

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return []
    return allApps
      .map((a) => ({ a, score: scoreAppSearch(searchQuery, a.name, a.package) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name))
      .slice(0, 100)
      .map((x) => x.a)
  }, [allApps, searchQuery])

  const bundleApps = useMemo(() => {
    if (!selectedPkg) return []
    const result: BundleAppInfo[] = []
    for (const key of Object.keys(state.bundles)) {
      const bundle = state.bundles[key]
      const app = (bundle.apps || []).find((a) => a.package === selectedPkg)
      if (app) {
        const bName = key.replace(/:(stable|dev)$/, '')
        result.push({
          bundleName: bName,
          channel: bundle.channel,
          bundleVersion: bundle.version || '',
          appVersions: getAppVersions(app.patches || []),
          patches: app.patches || [],
          releaseDate: bundle.release_date || '',
        })
      }
    }
    result.sort((a, b) => {
      if (a.channel !== b.channel) return a.channel === 'stable' ? -1 : 1
      return a.bundleName.localeCompare(b.bundleName)
    })
    return result
  }, [state.bundles, selectedPkg])

  const selectedAppName = selectedPkg
    ? allApps.find((a) => a.package === selectedPkg)?.name || selectedPkg
    : ''

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setSelectedPkg('')
  }

  const handleSelect = (pkg: string) => {
    lastAppliedParam.current = pkg
    setSelectedPkg(pkg)
    setSearchQuery('')
    const next = new URLSearchParams(searchParams)
    next.set('app', pkg)
    setSearchParams(next, { replace: true })
  }

  const handleClear = () => {
    setSearchQuery('')
    setSelectedPkg('')
    const next = new URLSearchParams(searchParams)
    next.delete('app')
    setSearchParams(next, { replace: true })
  }

  return (
    <>
      <PageShell className="diff-page-shell">
        <section className="diff-page" aria-labelledby="diff-title">
          <div className="diff-header">
            <div className="diff-title-row">
              <h1 className="diff-title" id="diff-title">App Comparison</h1>
              <Link to="/apps" className="diff-back-link" aria-label="Back to apps">
                <span className="diff-back-arrow">&larr;</span>
                <span>Back to Apps</span>
              </Link>
            </div>
            <p className="diff-subtitle">Pick an app to compare its version, patches, and availability across all bundles side by side.</p>

            <div className="diff-mobile-notice">For the best experience, use a desktop browser with a wider screen.</div>

            <div className="diff-search-box">
              <span className="diff-search-icon" dangerouslySetInnerHTML={{ __html: SEARCH_ICON }} />
              <input
                type="text"
                className="diff-search-input"
                placeholder="Search app by name or package..."
                value={searchQuery}
                onChange={handleInputChange}
              />
              {searchQuery && (
                <span className="diff-search-clear" onClick={handleClear} dangerouslySetInnerHTML={{ __html: CLEAR_ICON }} />
              )}
              {searchQuery && !selectedPkg && filteredApps.length > 0 && (
                <div className="diff-search-dropdown">
                  {filteredApps.map((a) => (
                    <div
                      key={a.package}
                      className="diff-search-result"
                      onClick={() => handleSelect(a.package)}
                    >
                      {a.iconUrl ? (
                        <img className="diff-search-result-icon" src={a.iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = FALLBACK_ICON }} />
                      ) : (
                        <span className="diff-search-result-icon diff-search-result-icon-letter">{a.name.charAt(0).toUpperCase()}</span>
                      )}
                      <div className="diff-search-result-info">
                        <span className="diff-search-result-name">{escHtml(a.name)}</span>
                        <span className="diff-search-result-pkg">{a.package}</span>
                      </div>
                      <span className="diff-search-result-count">{a.bundles.length} bundle{a.bundles.length !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchQuery && !selectedPkg && filteredApps.length === 0 && (
                <div className="diff-search-dropdown">
                  <div className="diff-search-empty">No apps match &quot;{escHtml(searchQuery)}&quot;</div>
                </div>
              )}
            </div>
          </div>

          {loading && Object.keys(state.bundles).length === 0 ? (
            <div className="diff-empty">
              <div className="diff-empty-icon" dangerouslySetInnerHTML={{ __html: GRID_ICON }} />
              <p>Loading app data...</p>
            </div>
          ) : (
            <main className="diff-main">
              {!selectedPkg && !searchQuery && (
                <div className="diff-empty">
                  <div className="diff-empty-icon" dangerouslySetInnerHTML={{ __html: GRID_ICON }} />
                  <p>Search for an app above to compare its version and patches across bundles.</p>
                  <p className="diff-empty-hint">{allApps.length} apps tracked across {new Set(Object.keys(state.bundles).map(k => k.replace(/:(stable|dev)$/, ''))).size} bundles.</p>
                </div>
              )}

              {selectedPkg && (
                <>
                  <div className="diff-app-header">
                    <h2 className="diff-app-selected-name">{escHtml(selectedAppName)}</h2>
                    <span className="diff-app-selected-pkg">{selectedPkg}</span>
                    <span className="diff-app-bundle-count">{bundleApps.length} bundle{bundleApps.length !== 1 ? 's' : ''}</span>
                  </div>

                  {bundleApps.length > 0 && ['stable', 'dev'].map((ch) => {
                    const group = bundleApps.filter((ba) => ba.channel === ch)
                    if (group.length === 0) return null

                    const vc = new Map<string, number[]>()
                    group.forEach((ba, i) => {
                      for (const v of ba.appVersions) {
                        const list = vc.get(v) || []
                        list.push(i)
                        vc.set(v, list)
                      }
                    })

                    const pc = new Map<string, number>()
                    for (const ba of group) {
                      for (const p of ba.patches) {
                        pc.set(p.name, (pc.get(p.name) || 0) + 1)
                      }
                    }

                    return (
                      <div key={ch} className="diff-channel-group">
                        <h3 className="diff-channel-group-title">
                          {ch === 'stable' ? 'Stable' : 'Dev'} Bundles
                          <span className="diff-group-count">{group.length}</span>
                        </h3>

                        <div className="diff-legend" aria-hidden="true">
                          <span className="diff-legend-item">
                            <span className="diff-legend-dot diff-level-all" /> in all bundles
                          </span>
                          <span className="diff-legend-item">
                            <span className="diff-legend-dot diff-level-some" /> in some bundles
                          </span>
                          <span className="diff-legend-item">
                            <span className="diff-legend-dot diff-level-unique" /> unique to a bundle
                          </span>
                        </div>

                        <div className="diff-bundle-cards">
                          {group.map((ba) => (
                            <div key={ba.bundleName} className="diff-bundle-card">
                              <div className="diff-bundle-card-header">
                                <span className="diff-bundle-name">{escHtml(ba.bundleName)}</span>
                                <span className={`diff-channel-tag diff-channel-tag--${ch}`}>{ch}</span>
                              </div>

                              <div className="diff-bundle-card-row">
                                <span className="diff-bundle-card-label">Released</span>
                                <span className="diff-release-text">
                                  {ba.releaseDate ? formatFriendlyDate(ba.releaseDate) : '—'}
                                </span>
                              </div>

                              <div className="diff-bundle-card-row diff-bundle-card-row--versions">
                                <span className="diff-bundle-card-label">Versions</span>
                                <div className="diff-version-chips">
                                  {ba.appVersions.length > 0 ? (
                                    ba.appVersions.map((v) => {
                                      const count = vc.get(v)?.length ?? 0
                                      const level = count === group.length ? 'all' : count > 1 ? 'some' : 'unique'
                                      return (
                                        <span
                                          key={v}
                                          className={`diff-version-chip diff-level-${level}`}
                                          title={
                                            level === 'all'
                                              ? `In all ${group.length} bundles`
                                              : level === 'some'
                                                ? `In ${count} of ${group.length} bundles`
                                                : 'Only in this bundle'
                                          }
                                        >
                                          {v}
                                        </span>
                                      )
                                    })
                                  ) : (
                                    <span className="diff-version-text diff-version-text--none">—</span>
                                  )}
                                </div>
                              </div>

                              <div className="diff-bundle-card-row diff-bundle-card-row--patches">
                                <span className="diff-bundle-card-label">Patches</span>
                                <PatchBlock patches={ba.patches} pc={pc} groupSize={group.length} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {bundleApps.length === 0 && (
                    <div className="diff-empty">
                      <p>No bundles found containing this app.</p>
                    </div>
                  )}
                </>
              )}

              {searchQuery && !selectedPkg && filteredApps.length === 0 && (
                <div className="diff-empty">
                  <p>No apps match your search.</p>
                </div>
              )}
            </main>
          )}
        </section>
      </PageShell>
      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}

function formatFriendlyDate(dateStr: string): string {
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return dateStr
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PatchBlock({
  patches,
  pc,
  groupSize,
}: {
  patches: PatchData[]
  pc: Map<string, number>
  groupSize: number
}) {
  const [expanded, setExpanded] = useState(false)
  const total = patches.length
  const core = patches.filter((p) => (pc.get(p.name) || 0) === groupSize).length
  const shared = patches.filter((p) => {
    const c = pc.get(p.name) || 0
    return c > 1 && c < groupSize
  }).length
  const unique = total - core - shared
  const hidden = total - (expanded ? total : 8)

  if (total === 0) {
    return <span className="diff-patch-list diff-patch-list--none">None</span>
  }

  const visible = expanded ? patches : patches.slice(0, 8)

  return (
    <div className="diff-patch-block">
      <div className="diff-patch-summary">
        <span className="diff-patch-total">{total} patches</span>
        {core > 0 && <span className="diff-patch-shared">· {core} in all</span>}
        {shared > 0 && <span className="diff-patch-some">· {shared} in some</span>}
        {unique > 0 && <span className="diff-patch-unique">· {unique} unique</span>}
      </div>
      <ul className="diff-patch-list">
        {visible.map((p) => {
          const c = pc.get(p.name) || 0
          const level = c === groupSize ? 'all' : c > 1 ? 'some' : 'unique'
          return (
            <li key={p.name} className={`diff-patch-item diff-patch-item--${level}`}>
              <span className="diff-patch-dot" aria-hidden="true" />
              {escHtml(p.name)}
              {level === 'some' && <span className="diff-patch-count">({c}/{groupSize})</span>}
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <button className="diff-patch-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show all ${total} patches`}
        </button>
      )}
    </div>
  )
}
