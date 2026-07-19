import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, getAppIconUrl } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { FALLBACK_ICON } from '../../utils/svg'
import Footer from '../layout/Footer'
import type { PatchData } from '../../types/bundles'

const SEARCH_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>'
const GRID_ICON = '<svg viewBox="0 0 16 16" width="48" height="48" fill="currentColor" opacity="0.12"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h2A1.5 1.5 0 0 1 6 2.5v2A1.5 1.5 0 0 1 4.5 6h-2A1.5 1.5 0 0 1 1 4.5v-2zm5 0A1.5 1.5 0 0 1 7.5 1h2A1.5 1.5 0 0 1 11 2.5v2A1.5 1.5 0 0 1 9.5 6h-2A1.5 1.5 0 0 1 6 4.5v-2zm5 0A1.5 1.5 0 0 1 12.5 1h2A1.5 1.5 0 0 1 16 2.5v2A1.5 1.5 0 0 1 14.5 6h-2A1.5 1.5 0 0 1 11 4.5v-2zM1 7.5A1.5 1.5 0 0 1 2.5 6h2A1.5 1.5 0 0 1 6 7.5v2A1.5 1.5 0 0 1 4.5 11h-2A1.5 1.5 0 0 1 1 9.5v-2zm5 0A1.5 1.5 0 0 1 7.5 6h2A1.5 1.5 0 0 1 11 7.5v2A1.5 1.5 0 0 1 9.5 11h-2A1.5 1.5 0 0 1 6 9.5v-2zm5 0A1.5 1.5 0 0 1 12.5 6h2A1.5 1.5 0 0 1 16 7.5v2A1.5 1.5 0 0 1 14.5 11h-2A1.5 1.5 0 0 1 11 9.5v-2zM1 12.5A1.5 1.5 0 0 1 2.5 11h2A1.5 1.5 0 0 1 6 12.5v2A1.5 1.5 0 0 1 4.5 16h-2A1.5 1.5 0 0 1 1 14.5v-2zm5 0A1.5 1.5 0 0 1 7.5 11h2A1.5 1.5 0 0 1 11 12.5v2A1.5 1.5 0 0 1 9.5 16h-2A1.5 1.5 0 0 1 6 14.5v-2zm5 0a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2z"/></svg>'

interface BundleAppInfo {
  bundleName: string
  channel: string
  bundleVersion: string
  appVersion: string
  patches: PatchData[]
  releaseDate: string
}

function getAppVersion(patches: PatchData[]): string {
  const versions = new Set<string>()
  for (const p of patches) {
    for (const v of p.compatible_versions || []) {
      if (v) versions.add(v)
    }
  }
  return versions.size > 0 ? [...versions].join(', ') : ''
}

export default function DiffPage() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPkg, setSelectedPkg] = useState('')

  useEffect(() => {
    dispatch({ type: 'CLEAR_LOADING_LOG' })
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[diff] fetching app data...' })

    const ts = Date.now()
    function fetchJson<T>(url: string, fallback: T): Promise<T> {
      return fetch(url).then((r) => (r.ok ? r.json() as T : fallback)).catch(() => fallback)
    }

    let done = 0
    const TOTAL = 8
    function tick() {
      done++
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: Math.round((done / TOTAL) * 100) })
      if (done >= TOTAL) {
        dispatch({ type: 'SET_LOADING_LOG', payload: '────────────────────────────' })
        dispatch({ type: 'SET_LOADING_LOG', payload: '✓ done — app comparison ready' })
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/core.json...' })
    fetchJson<{ date?: string }>(`/data/core.json?_t=${ts}`, {}).then(() => {
      dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ core metadata loaded' })
      tick()
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/stats.json...' })
    fetchJson<Record<string, unknown>>(`/data/stats.json?_t=${ts}`, {}).then(() => {
      dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ statistics loaded' })
      tick()
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/changes.json...' })
    fetchJson<{ affected_bundles?: unknown[] }>(`/data/changes.json?_t=${ts}`, {}).then(() => {
      dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ changes loaded' })
      tick()
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/bundles.json...' })
    fetchJson<Record<string, import('../../types/bundles').BundleData>>(`/data/bundles.json?_t=${ts}`, {}).then((data) => {
      const bundles = data || {}
      dispatch({ type: 'SET_BUNDLES', payload: bundles })
      const count = Object.keys(bundles).length
      dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${count} bundles loaded` })
      dispatch({ type: 'SET_LOADING_LOG', payload: 'Processing bundle data...' })
      tick()
      setTimeout(() => { dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ bundles processed' }); tick() }, 50)
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/state/name_cache.json...' })
    fetchJson<Record<string, string>>('/data/state/name_cache.json', {}).then((names) => {
      if (names && Object.keys(names).length > 0) {
        dispatch({ type: 'SET_NAME_CACHE', payload: names })
        dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${Object.keys(names).length} app names loaded` })
      } else {
        dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ name cache empty' })
      }
      tick()
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Fetching /data/state/icon_cache.json...' })
    fetchJson<Record<string, string>>('/data/state/icon_cache.json', {}).then((icons) => {
      if (icons && Object.keys(icons).length > 0) {
        dispatch({ type: 'SET_ICON_CACHE', payload: icons })
        dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${Object.keys(icons).length} app icons loaded` })
      } else {
        dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ icon cache empty' })
      }
      tick()
    })

    dispatch({ type: 'SET_LOADING_LOG', payload: 'Building app index...' })
    setTimeout(() => { dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ app index ready' }); tick() }, 100)
  }, [dispatch])

  const allApps = useMemo(() => {
    const map = new Map<string, { name: string; package: string; bundleCount: number; iconUrl: string }>()
    for (const key of Object.keys(state.bundles)) {
      const bundle = state.bundles[key]
      for (const app of bundle.apps || []) {
        const existing = map.get(app.package)
        if (existing) {
          existing.bundleCount++
        } else {
          map.set(app.package, {
            name: resolveAppName(app, state.nameCache),
            package: app.package,
            bundleCount: 1,
            iconUrl: getAppIconUrl(app, state.iconCache),
          })
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [state.bundles, state.nameCache, state.iconCache])

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allApps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.package.toLowerCase().includes(q),
    ).slice(0, 100)
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
          appVersion: getAppVersion(app.patches || []),
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
    setSelectedPkg(pkg)
    setSearchQuery('')
  }

  return (
    <div className="diff-page" id="diff-page">
      <header className="diff-header">
        <div className="diff-title-row">
          <span onClick={() => navigate('/')} className="diff-back-link" dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>' }} />
          <h1 className="diff-title">App Comparison</h1>
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
            autoFocus
          />
          {searchQuery && (
            <span className="diff-search-clear" onClick={() => { setSearchQuery(''); setSelectedPkg('') }} dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>' }} />
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
                  <span className="diff-search-result-count">{a.bundleCount} bundle{a.bundleCount !== 1 ? 's' : ''}</span>
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
      </header>

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

              const dupVer = new Set<number>()
              const vm = new Map<string, number[]>()
              group.forEach((ba, i) => {
                const v = ba.bundleVersion
                if (!v) return
                const list = vm.get(v) || []
                list.push(i)
                vm.set(v, list)
              })
              for (const [, list] of vm) {
                if (list.length > 1) list.forEach((i) => dupVer.add(i))
              }

              const sharedPatches = new Set<string>()
              const pc = new Map<string, number>()
              for (const ba of group) {
                for (const p of ba.patches) {
                  pc.set(p.name, (pc.get(p.name) || 0) + 1)
                }
              }
              for (const [n, c] of pc) {
                if (c > 1) sharedPatches.add(n)
              }

              return (
                <div key={ch} className="diff-channel-group">
                  <h3 className="diff-channel-group-title">{ch === 'stable' ? 'Stable' : 'Dev'} Bundles</h3>
                  <div className="diff-table-scroll">
                    <div className="diff-comparison-table" style={{ gridTemplateColumns: `minmax(140px, auto) repeat(${group.length}, 1fr)` }}>
                      <div className="diff-cell-header diff-cell-label">Bundle</div>
                      {group.map((ba) => (
                        <div key={`${ba.bundleName}`} className="diff-cell-header diff-cell-bundle">
                          <span className="diff-bundle-name">{escHtml(ba.bundleName)}</span>
                        </div>
                      ))}

                      <div className="diff-cell-label">Version</div>
                      {group.map((ba, i) => (
                        <div key={`ver-${ba.bundleName}`} className={`diff-cell-value ${dupVer.has(i) ? 'diff-cell-version-same' : ''}`}>
                          <span className="diff-version-text">{ba.appVersion || '—'}</span>
                        </div>
                      ))}

                      <div className="diff-cell-label">Released</div>
                      {group.map((ba) => (
                        <div key={`rel-${ba.bundleName}`} className="diff-cell-value">
                          <span className="diff-release-text">{ba.releaseDate ? formatFriendlyDate(ba.releaseDate) : '—'}</span>
                        </div>
                      ))}

                      <div className="diff-cell-label">Patches</div>
                      {group.map((ba) => (
                        <div key={`pat-${ba.bundleName}`} className="diff-cell-value">
                          {ba.patches.length > 0 ? (
                            <ul className="diff-patch-list">
                              {ba.patches.map((p) => (
                                <li key={p.name} className={`diff-patch-item${sharedPatches.has(p.name) ? ' diff-patch-item--shared' : ''}`}>{escHtml(p.name)}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="diff-patch-list diff-patch-list--none">None</span>
                          )}
                        </div>
                      ))}
                    </div>
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

      <Footer />
    </div>
  )
}

function formatFriendlyDate(dateStr: string): string {
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return dateStr
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
