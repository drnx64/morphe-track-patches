import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { fuzzySearchItems } from '../../services/fuzzySearch'
import { getAppIconUrl, resolveAppName } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { FALLBACK_ICON } from '../../utils/svg'
import type { BundleEntry, AppData } from '../../types/bundles'

interface SearchResult {
  type: 'app' | 'bundle'
  app?: AppData
  bundleName?: string
  bundleEntry?: BundleEntry
}

export default function SearchDropdown() {
  const { state } = useAppContext()
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  const grouped: Record<string, BundleEntry> = {}
  for (const b of Object.values(state.bundles)) {
    if (!grouped[b.bundle]) {
      grouped[b.bundle] = { bundle: b.bundle, channels: [b.channel], repo_url: b.repo_url, version: b.version || '', apps: [...(b.apps || [])] }
    } else {
      if (b.version && !grouped[b.bundle].version) grouped[b.bundle].version = b.version
      if (!grouped[b.bundle].channels.includes(b.channel)) grouped[b.bundle].channels.push(b.channel)
      for (const a of b.apps || []) {
        if (!grouped[b.bundle].apps.find((x) => x.package === a.package)) {
          grouped[b.bundle].apps.push(a)
        }
      }
    }
  }

  useEffect(() => {
    const update = (e: Event) => {
      const q = (e as CustomEvent).detail || ''
      setQuery(q)
    }
    const close = () => setVisible(false)
    document.addEventListener('search-dropdown-update', update)
    document.addEventListener('search-dropdown-close', close)
    return () => {
      document.removeEventListener('search-dropdown-update', update)
      document.removeEventListener('search-dropdown-close', close)
    }
  }, [])

  useEffect(() => {
    if (!query || !query.trim()) {
      setVisible(false)
      setResults([])
      return
    }
    const q = query.trim()
    const allApps: { app: AppData; bundleName: string }[] = []
    const allBundles: { bundleName: string; appCount: number; channels: string[]; entry: BundleEntry }[] = []

    for (const [name, entry] of Object.entries(grouped)) {
      allBundles.push({ bundleName: name, appCount: entry.apps.length, channels: entry.channels, entry })
      for (const app of entry.apps) {
        allApps.push({ app, bundleName: name })
      }
    }

    const matchedApps = fuzzySearchItems(q, allApps, (item) => resolveAppName(item.app, state.nameCache) + ' ' + item.app.package, 10)
    const matchedBundles = fuzzySearchItems(q, allBundles, (item) => item.bundleName, 5)

    const res: SearchResult[] = [
      ...matchedApps.map((m) => ({ type: 'app' as const, app: m.app, bundleName: m.bundleName })),
      ...matchedBundles.map((m) => ({ type: 'bundle' as const, bundleName: m.bundleName, bundleEntry: m.entry })),
    ]
    setResults(res)
    setVisible(res.length > 0)
  }, [query, state.nameCache])

  const handleSelect = useCallback((result: SearchResult) => {
    setVisible(false)
    document.dispatchEvent(new CustomEvent('search-dropdown-close'))
    if (result.type === 'app' && result.app && result.bundleName) {
      window.dispatchEvent(new CustomEvent('open-app', {
        detail: { app: result.app, bundleName: result.bundleName, channels: grouped[result.bundleName]?.channels || [] }
      }))
    } else if (result.type === 'bundle' && result.bundleName) {
      window.dispatchEvent(new CustomEvent('open-bundle', {
        detail: { bundleName: result.bundleName, channels: grouped[result.bundleName]?.channels || [], version: grouped[result.bundleName]?.version || '' }
      }))
    }
  }, [])

  if (!visible) return null

  return (
    <div className="search-dropdown visible" id="search-dropdown">
      {results.map((r, i) => {
        if (r.type === 'app' && r.app) {
          const name = resolveAppName(r.app, state.nameCache)
          const iconUrl = getAppIconUrl(r.app, state.iconCache)
          const patchCount = r.app.patches?.length ?? 0
          return (
            <div
              key={`app-${i}`}
              className="search-result"
              data-type="app"
              onClick={() => handleSelect(r)}
            >
              {iconUrl ? (
                <img className="search-result-icon" src={iconUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = FALLBACK_ICON }} />
              ) : (
                <span className="search-result-icon search-result-icon-bundle">A</span>
              )}
              <div className="search-result-info">
                <span className="search-result-name">{name}</span>
                <span className="search-result-pkg">{r.app.package}</span>
              </div>
              <div className="search-result-meta">
                <span className="search-result-bundle">{r.bundleName}</span>
                <span className="search-result-patches">{patchCount} patch{patchCount !== 1 ? 'es' : ''}</span>
              </div>
            </div>
          )
        }
        if (r.type === 'bundle' && r.bundleName) {
          const appCount = grouped[r.bundleName]?.apps?.length ?? 0
          return (
            <div
              key={`bundle-${i}`}
              className="search-result search-result-bundle-row"
              data-type="bundle"
              onClick={() => handleSelect(r)}
            >
              <span className="search-result-icon search-result-icon-bundle">B</span>
              <div className="search-result-info">
                <span className="search-result-name">{r.bundleName}</span>
                <span className="search-result-pkg">{appCount} app{appCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
