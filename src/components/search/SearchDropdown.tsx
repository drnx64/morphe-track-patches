import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { fuzzySearchItems } from '../../services/fuzzySearch'
import { getAppIconUrl, resolveAppName } from '../../utils/misc'
import { getCachedIconDataUrl } from '../../services/iconCache'
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
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

  const grouped: Record<string, BundleEntry> = {}
  for (const b of Object.values(state.bundles)) {
    if (!grouped[b.bundle]) {
      grouped[b.bundle] = { bundle: b.bundle, channels: [b.channel], repo_url: b.repo_url, patches_name: b.patches_name, version: b.version || '', apps: [...(b.apps || [])] }
    } else {
      if (b.version && !grouped[b.bundle].version) grouped[b.bundle].version = b.version
      if (b.patches_name && !grouped[b.bundle].patches_name) grouped[b.bundle].patches_name = b.patches_name
      if (!grouped[b.bundle].channels.includes(b.channel)) grouped[b.bundle].channels.push(b.channel)
      for (const a of b.apps || []) {
        if (!grouped[b.bundle].apps.find((x) => x.package === a.package)) {
          grouped[b.bundle].apps.push(a)
        }
      }
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!visible) return
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('#search-dropdown') && !target.closest('#search-input')) {
        setVisible(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [visible])

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
      setActiveIndex(-1)
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
    const matchedBundles = fuzzySearchItems(q, allBundles, (item) => item.bundleName + ' ' + (item.entry.patches_name || ''), 5)

    const res: SearchResult[] = [
      ...matchedApps.map((m) => ({ type: 'app' as const, app: m.app, bundleName: m.bundleName })),
      ...matchedBundles.map((m) => ({ type: 'bundle' as const, bundleName: m.bundleName, bundleEntry: m.entry })),
    ]
    setResults(res)
    setVisible(res.length > 0)
    setActiveIndex(-1)
  }, [query, state.nameCache])

  const handleSelect = useCallback((result: SearchResult) => {
    setVisible(false)
    document.dispatchEvent(new CustomEvent('search-dropdown-close'))
    if (result.type === 'app' && result.app && result.bundleName) {
      window.dispatchEvent(new CustomEvent('open-app', {
        detail: { app: result.app, bundleName: result.bundleName, channels: grouped[result.bundleName]?.channels || [] }
      }))
    } else if (result.type === 'bundle' && result.bundleName) {
      navigate(`/bundle/${encodeURIComponent(result.bundleName)}`)
    }
  }, [navigate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!visible || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + results.length) % results.length)
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setVisible(false)
        document.dispatchEvent(new CustomEvent('search-dropdown-close'))
        break
    }
  }, [visible, results, activeIndex, handleSelect])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!visible) return null

  return (
    <div
      className="search-dropdown visible"
      id="search-dropdown"
      ref={listRef}
      role="listbox"
      aria-label="Search results"
      onKeyDown={handleKeyDown}
    >
      {results.map((r, i) => {
        const isActive = i === activeIndex
        if (r.type === 'app' && r.app) {
          const name = resolveAppName(r.app, state.nameCache)
          const iconUrl = getAppIconUrl(r.app, state.iconCache)
          const dataUrl = iconUrl ? getCachedIconDataUrl(iconUrl) : undefined
          const patchCount = r.app.patches?.length ?? 0
          return (
            <div
              key={`app-${i}`}
              className={`search-result${isActive ? ' active' : ''}`}
              data-type="app"
              role="option"
              aria-selected={isActive}
              onClick={() => handleSelect(r)}
            >
              {dataUrl ? (
                <img className="search-result-icon" src={dataUrl} alt="" loading="lazy" onError={(e) => { if (e.currentTarget.src !== FALLBACK_ICON) e.currentTarget.src = FALLBACK_ICON }} />
              ) : iconUrl ? (
                <img className="search-result-icon" src={iconUrl} alt="" loading="lazy" onError={(e) => { if (e.currentTarget.src !== FALLBACK_ICON) e.currentTarget.src = FALLBACK_ICON }} />
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
          const displayName = grouped[r.bundleName]?.patches_name || r.bundleName
          return (
            <div
              key={`bundle-${i}`}
              className={`search-result search-result-bundle-row${isActive ? ' active' : ''}`}
              data-type="bundle"
              role="option"
              aria-selected={isActive}
              onClick={() => handleSelect(r)}
            >
              <span className="search-result-icon search-result-icon-bundle">B</span>
              <div className="search-result-info">
                <span className="search-result-name">{displayName}</span>
                <span className="search-result-pkg">{r.bundleName} · {appCount} app{appCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
