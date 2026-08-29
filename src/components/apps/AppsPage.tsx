import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { usePageMeta } from '../../hooks/usePageMeta'
import { buildAppIndex, scoreAppSearch, type AppIndexEntry } from '../../utils/misc'
import { getAddMorpheUrl, getPlayStoreUrl } from '../../utils/url'
import { FALLBACK_ICON, SEARCH_ICON, CLEAR_ICON, CHEVRON_DOWN, CLOSE_ICON } from '../../utils/svg'
import PageShell from '../layout/PageShell'
import Modal from '../shared/Modal'
import ChannelBadge from '../shared/ChannelBadge'
import { SkeletonGrid } from '../shared/Skeleton'
import TodayUpdatesSection from '../dashboard/TodayUpdatesSection'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'
import type { AppData } from '../../types/bundles'

function findAppData(
  bundles: Record<string, any>,
  pkg: string,
): { app: AppData; bundleName: string; channels: string[] } | null {
  for (const key of Object.keys(bundles)) {
    const bundle = bundles[key]
    const app = (bundle.apps || []).find((a: any) => a.package === pkg)
    if (app) {
      const bundleName = key.replace(/:(stable|dev)$/, '')
      const channels: string[] = []
      if (bundles[`${bundleName}:stable`]) channels.push('stable')
      if (bundles[`${bundleName}:dev`]) channels.push('dev')
      return { app, bundleName, channels }
    }
  }
  return null
}

export default function AppsPage() {
  const { state } = useAppContext()
  const { loading } = useDataFetching()
  usePageMeta(
    'Apps',
    'Browse every app supported by tracked Morphe patch bundles and add patch sources to Morphe with one tap.',
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [bundleFilter, setBundleFilter] = useState<'all' | 'multi' | 'single'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'bundles-desc' | 'bundles-asc'>('name')
  const [chooserApp, setChooserApp] = useState<AppIndexEntry | null>(null)

  const openAppParam = searchParams.get('open-app') || ''

  useEffect(() => {
    if (!openAppParam || Object.keys(state.bundles).length === 0) return
    const found = findAppData(state.bundles, openAppParam)
    if (found) {
      window.dispatchEvent(
        new CustomEvent('open-app', { detail: { app: found.app, bundleName: found.bundleName, channels: found.channels } }),
      )
    }
    const next = new URLSearchParams(searchParams)
    next.delete('open-app')
    setSearchParams(next, { replace: true })
  }, [openAppParam, state.bundles])

  const apps = useMemo(
    () => buildAppIndex(state.bundles, state.nameCache, state.iconCache),
    [state.bundles, state.nameCache, state.iconCache],
  )

  const filtered = useMemo(() => {
    let list = apps

    if (bundleFilter === 'multi') list = list.filter((a) => a.bundles.length >= 2)
    else if (bundleFilter === 'single') list = list.filter((a) => a.bundles.length === 1)

    if (search.trim()) {
      list = list
        .map((a) => {
          const patchesScore = a.patchesNames.some((pn) => pn.toLowerCase().includes(search.toLowerCase())) ? 500 : 0
          return { a, score: scoreAppSearch(search, a.name, a.package) + patchesScore }
        })
        .filter((x) => x.score > 0)
        .sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name))
        .map((x) => x.a)
    } else {
      list = [...list].sort((x, y) => {
        if (sortBy === 'bundles-desc') return y.bundles.length - x.bundles.length || x.name.localeCompare(y.name)
        if (sortBy === 'bundles-asc') return x.bundles.length - y.bundles.length || x.name.localeCompare(y.name)
        return x.name.localeCompare(y.name)
      })
    }
    return list
  }, [apps, search, bundleFilter, sortBy])

  const [visibleCount, setVisibleCount] = useState(() => Math.min(24, filtered.length))
  const sentinelRef = useRef<HTMLDivElement>(null)
  const filteredLenRef = useRef(filtered.length)
  filteredLenRef.current = filtered.length

  useEffect(() => {
    setVisibleCount(Math.min(24, filtered.length))
  }, [filtered.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + 24, filteredLenRef.current))
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [filtered.length])

  const handleAddToMorphe = (app: AppIndexEntry) => {
    if (app.bundles.length >= 2) {
      setChooserApp(app)
    } else {
      const repoUrl = app.bundles[0]?.repoUrl
      if (repoUrl) window.open(getAddMorpheUrl(repoUrl), '_blank', 'noopener')
    }
  }

  const handleOpenApp = useCallback((app: AppIndexEntry) => {
    const found = findAppData(state.bundles, app.package)
    if (!found) return
    window.dispatchEvent(
      new CustomEvent('open-app', { detail: { app: found.app, bundleName: found.bundleName, channels: found.channels } }),
    )
  }, [state.bundles])

  return (
    <>
      <PageShell className="apps-page-shell">
        <TodayUpdatesSection />
        <section className="apps-section" aria-labelledby="apps-heading">
          <div className="apps-header">
            <div className="apps-header-text">
              <h2 className="section-title" id="apps-heading">Apps</h2>
              <p className="apps-subtitle">
                Every app supported by the tracked patch bundles. Choose a bundle and add it to your Morphe manager.
              </p>
            </div>
            <span className="apps-count">{apps.length} app{apps.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="apps-controls-sticky">
            <div className="apps-search-box">
              <span className="apps-search-icon" dangerouslySetInnerHTML={{ __html: SEARCH_ICON }} />
              <input
                type="text"
                className="apps-search-input"
                placeholder="Search apps by name or package..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <span
                  className="apps-search-clear"
                  onClick={() => setSearch('')}
                  dangerouslySetInnerHTML={{ __html: CLEAR_ICON }}
                />
              )}
            </div>

            <div className="apps-filter-row">
              <div className="apps-filter-group">
                <span className="apps-filter-label">Bundles:</span>
                <button
                  className={`apps-filter-btn${bundleFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setBundleFilter('all')}
                >
                  All
                </button>
                <button
                  className={`apps-filter-btn${bundleFilter === 'multi' ? ' active' : ''}`}
                  onClick={() => setBundleFilter('multi')}
                >
                  Multi-bundle ({apps.filter((a) => a.bundles.length >= 2).length})
                </button>
                <button
                  className={`apps-filter-btn${bundleFilter === 'single' ? ' active' : ''}`}
                  onClick={() => setBundleFilter('single')}
                >
                  Single-bundle ({apps.filter((a) => a.bundles.length === 1).length})
                </button>
              </div>
              <div className="apps-sort-group">
                <label className="apps-filter-label" htmlFor="apps-sort">Sort:</label>
                <select
                  id="apps-sort"
                  className="apps-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="bundles-desc">Most bundles</option>
                  <option value="bundles-asc">Fewest bundles</option>
                </select>
              </div>
            </div>
          </div>

          {loading && apps.length === 0 ? (
            <div className="apps-grid" id="apps-grid">
              <SkeletonGrid />
            </div>
          ) : filtered.length === 0 ? (
            <div className="loading-state" id="apps-empty">No apps match the current filters.</div>
          ) : (
            <>
              <div className="apps-grid" id="apps-grid">
                {filtered.slice(0, visibleCount).map((app) => (
                  <AppCard key={app.package} app={app} onAdd={() => handleAddToMorphe(app)} onOpen={() => handleOpenApp(app)} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} className="apps-load-sentinel" aria-hidden="true" />
              )}
            </>
          )}
        </section>
      </PageShell>

      <AppBundleChooser app={chooserApp} bundles={state.bundles} onClose={() => setChooserApp(null)} />

      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}

function AppCard({ app, onAdd, onOpen }: { app: AppIndexEntry; onAdd: () => void; onOpen: () => void }) {
  const playStoreUrl = getPlayStoreUrl(app.package)
  const multi = app.bundles.length >= 2

  return (
    <div
      className="app-card"
      data-package={app.package}
      role="button"
      tabIndex={0}
      aria-label={`${app.name}, ${app.bundles.length} bundle${app.bundles.length !== 1 ? 's' : ''}, open details`}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="app-card-main">
        <button
          type="button"
          className="app-card-open-btn"
          aria-label={`Open details for ${app.name}`}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
        >
          {app.iconUrl ? (
            <img
              className="app-card-icon"
              src={app.iconUrl}
              alt=""
              loading="lazy"
              onError={(e) => { e.currentTarget.src = FALLBACK_ICON }}
            />
          ) : (
            <span className="app-card-icon app-card-icon-letter">{app.name.charAt(0).toUpperCase()}</span>
          )}
        </button>
        <div className="app-card-info">
          <span className="app-card-name" title={app.name}>{app.name}</span>
          <span className="app-card-pkg" title={app.package}>{app.package}</span>
        </div>
      </div>
      <div className="app-card-meta">
        <span className={`app-card-bundles${multi ? ' app-card-bundles--multi' : ''}`}>
          {app.bundles.length} bundle{app.bundles.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="app-card-actions">
        <div className="app-card-icon-actions">
          <a
            className="app-card-icon-btn"
            href={playStoreUrl}
            target="_blank"
            rel="noopener"
            title="Open on Google Play"
            aria-label={`Open ${app.name} on Google Play`}
            onClick={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M3.609 1.814a1.5 1.5 0 0 0-.363 1.316v17.74a1.5 1.5 0 0 0 2.213 1.321l14.99-8.87a1.5 1.5 0 0 0 0-2.598L5.46 1.604a1.5 1.5 0 0 0-1.852.21zM7.2 3.703l6.32 3.693L5.4 17.188v-13.5l1.8.015z"/>
              <path d="M5.4 3.703l1.8.015 11.2 6.545L7.2 20.297V3.703z" opacity=".35"/>
            </svg>
          </a>
        </div>
        <button className="app-card-add" onClick={(e) => { e.stopPropagation(); onAdd() }}>Add to Morphe</button>
      </div>
    </div>
  )
}

function AppBundleChooser({ app, bundles, onClose }: { app: AppIndexEntry | null; bundles: Record<string, any>; onClose: () => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (app && app.bundles.length === 1) return new Set([app.bundles[0].bundleName])
    return new Set()
  })

  if (!app) return null
  const hasMultiple = app.bundles.length >= 2

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function getPatchesForBundle(bundleName: string, channels: string[]): { name: string; description?: string; use?: boolean }[] {
    for (const ch of channels) {
      const key = `${bundleName}:${ch}`
      const bundle = bundles[key]
      if (!bundle) continue
      const appData = (bundle.apps || []).find((a: any) => a.package === app!.package)
      if (appData?.patches?.length) return appData.patches
    }
    return []
  }

  function getPatchesName(bundleName: string, channels: string[]): string {
    for (const ch of channels) {
      const key = `${bundleName}:${ch}`
      const bundle = bundles[key]
      if (bundle?.patches_name) return bundle.patches_name
    }
    return bundleName
  }

  return (
    <Modal id="app-bundle-chooser" open={!!app} onClose={onClose} ariaLabel={`Add ${app.name} to Morphe`}>
      <div className="modal-header">
        <div className="modal-header-top">
          <div className="modal-app-identity">
            <h3 className="modal-app-name" id="chooser-app-name">{app.name}</h3>
            <div className="modal-meta-row">
              <a
                className="modal-pkg-link"
                href={getPlayStoreUrl(app.package)}
                target="_blank"
                rel="noopener"
              >
                {app.package}
              </a>
            </div>
          </div>
          <button className="modal-close" id="chooser-close-btn" aria-label="Close" onClick={onClose} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
        </div>
      </div>

      <div className="modal-body">
        <div className="modal-patches-header">
          <span className="modal-patches-title">Choose a bundle</span>
          <span className="modal-patches-count" id="chooser-count">{app.bundles.length} available</span>
        </div>
        <div className="chooser-bundle-list" id="chooser-bundle-list">
          {app.bundles.map((b) => {
            const isOpen = expanded.has(b.bundleName)
            const patches = getPatchesForBundle(b.bundleName, b.channels)
            const patchesName = getPatchesName(b.bundleName, b.channels)
            return (
              <div key={`${b.bundleName}-${b.repoUrl}`} className={`chooser-bundle-item${isOpen ? ' is-open' : ''}`}>
                <div
                  className="chooser-bundle-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(b.bundleName)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(b.bundleName) } }}
                >
                  <div className="chooser-bundle-info">
                    <span className="chooser-bundle-name">{patchesName}</span>
                    <div className="chooser-bundle-meta">
                      {b.channels.length > 1 && b.channels.map((ch) => <ChannelBadge key={ch} channel={ch} />)}
                      {b.version && <span className="bundle-version-tag">{b.version}</span>}
                      {patches.length > 0 && <span className="chooser-patch-count">{patches.length} patch{patches.length !== 1 ? 'es' : ''}</span>}
                    </div>
                  </div>
                  <span className={`chooser-bundle-chevron${isOpen ? ' open' : ''}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHEVRON_DOWN }} />
                </div>
                {isOpen && (
                  <div className="chooser-bundle-patches">
                    {patches.length === 0 ? (
                      <div className="chooser-no-patches">No patch details available.</div>
                    ) : (
                      patches.map((p, i) => (
                        <div key={`${p.name}-${i}`} className="chooser-patch-item">
                          <div className="chooser-patch-text">
                            <span className="chooser-patch-name">{p.name}</span>
                            {p.description && <span className="chooser-patch-desc">{p.description}</span>}
                          </div>
                          {p.use === false && <span className="patch-off-badge">Off by default</span>}
                        </div>
                      ))
                    )}
                    <a
                      className="add-morphe-btn chooser-add-btn"
                      href={getAddMorpheUrl(b.repoUrl)}
                      target="_blank"
                      rel="noopener"
                    >
                      Add to Morphe
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {hasMultiple && (
          <div className="chooser-diff-hint" id="chooser-diff-hint">
            <span>What&apos;s the difference of the {app.bundles.length} bundles?</span>
            <Link
              to={`/diff?app=${encodeURIComponent(app.package)}`}
              className="chooser-diff-link"
              onClick={onClose}
            >
              Check it here
            </Link>
          </div>
        )}
      </div>
    </Modal>
  )
}
