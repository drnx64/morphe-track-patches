import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { useProgressiveCount } from '../../hooks/useProgressiveCount'
import { buildAppIndex, scoreAppSearch, type AppIndexEntry } from '../../utils/misc'
import { getAddMorpheUrl, getPlayStoreUrl } from '../../utils/url'
import { FALLBACK_ICON, SEARCH_ICON, CLEAR_ICON } from '../../utils/svg'
import PageShell from '../layout/PageShell'
import Modal from '../shared/Modal'
import ChannelBadge from '../shared/ChannelBadge'
import { SkeletonGrid } from '../shared/Skeleton'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'

export default function AppsPage() {
  const { state } = useAppContext()
  const { loading } = useDataFetching()
  const [search, setSearch] = useState('')
  const [chooserApp, setChooserApp] = useState<AppIndexEntry | null>(null)

  const apps = useMemo(
    () => buildAppIndex(state.bundles, state.nameCache, state.iconCache),
    [state.bundles, state.nameCache, state.iconCache],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return apps
    return apps
      .map((a) => ({ a, score: scoreAppSearch(search, a.name, a.package) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name))
      .map((x) => x.a)
  }, [apps, search])

  const visibleCount = useProgressiveCount(filtered.length)

  const handleAddToMorphe = (app: AppIndexEntry) => {
    if (app.bundles.length >= 2) {
      setChooserApp(app)
    } else {
      const repoUrl = app.bundles[0]?.repoUrl
      if (repoUrl) window.open(getAddMorpheUrl(repoUrl), '_blank', 'noopener')
    }
  }

  return (
    <>
      <PageShell className="apps-page-shell">
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

          {loading && apps.length === 0 ? (
            <div className="apps-grid" id="apps-grid">
              <SkeletonGrid />
            </div>
          ) : filtered.length === 0 ? (
            <div className="loading-state" id="apps-empty">No apps match &quot;{search}&quot;</div>
          ) : (
            <>
              <div className="apps-grid" id="apps-grid">
                {filtered.slice(0, visibleCount).map((app) => (
                  <AppCard key={app.package} app={app} onAdd={() => handleAddToMorphe(app)} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div className="grid-loading-more" aria-hidden="true">Rendering {Math.min(visibleCount, filtered.length)} of {filtered.length} apps…</div>
              )}
            </>
          )}
        </section>
      </PageShell>

      <AppBundleChooser app={chooserApp} onClose={() => setChooserApp(null)} />

      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}

function AppCard({ app, onAdd }: { app: AppIndexEntry; onAdd: () => void }) {
  const playStoreUrl = getPlayStoreUrl(app.package)
  const multi = app.bundles.length >= 2

  return (
    <div className="app-card" data-package={app.package}>
      <div className="app-card-main">
        <a
          className="app-card-icon-link"
          href={playStoreUrl}
          target="_blank"
          rel="noopener"
          aria-label={`Open ${app.name} on Google Play`}
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
        </a>
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
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M3.609 1.814a1.5 1.5 0 0 0-.363 1.316v17.74a1.5 1.5 0 0 0 2.213 1.321l14.99-8.87a1.5 1.5 0 0 0 0-2.598L5.46 1.604a1.5 1.5 0 0 0-1.852.21zM7.2 3.703l6.32 3.693L5.4 17.188v-13.5l1.8.015z"/>
              <path d="M5.4 3.703l1.8.015 11.2 6.545L7.2 20.297V3.703z" opacity=".35"/>
            </svg>
          </a>
        </div>
        <button className="app-card-add" onClick={onAdd}>Add to Morphe</button>
      </div>
    </div>
  )
}

function AppBundleChooser({ app, onClose }: { app: AppIndexEntry | null; onClose: () => void }) {
  if (!app) return null
  const hasMultiple = app.bundles.length >= 2

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
          <button className="modal-close" id="chooser-close-btn" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
      </div>

      <div className="modal-body">
        <div className="modal-patches-header">
          <span className="modal-patches-title">Choose a bundle</span>
          <span className="modal-patches-count" id="chooser-count">{app.bundles.length} available</span>
        </div>
        <div className="chooser-bundle-list" id="chooser-bundle-list">
          {app.bundles.map((b) => (
            <div key={`${b.bundleName}-${b.repoUrl}`} className="chooser-bundle-item">
              <div className="chooser-bundle-info">
                <span className="chooser-bundle-name">{b.bundleName}</span>
                <div className="chooser-bundle-meta">
                  {b.channels.map((ch) => <ChannelBadge key={ch} channel={ch} />)}
                  {b.version && <span className="bundle-version-tag">{b.version}</span>}
                </div>
              </div>
              <a
                className="add-morphe-btn chooser-add-btn"
                href={getAddMorpheUrl(b.repoUrl)}
                target="_blank"
                rel="noopener"
              >
                Add to Morphe
              </a>
            </div>
          ))}
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
