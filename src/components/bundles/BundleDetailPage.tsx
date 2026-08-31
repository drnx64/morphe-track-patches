import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { resolveAppName, isAppPreRelease, getStaleness } from '../../utils/misc'
import { getRepoInfo, getAddMorpheUrl } from '../../utils/url'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON, ARROW_ICON } from '../../utils/svg'
import ChannelBadge from '../shared/ChannelBadge'
import AppIcon from '../shared/AppIcon'
import VersionChip from '../shared/VersionChip'
import { Badge, BADGE_CLASSES } from '../shared/Badge'
import PageShell from '../layout/PageShell'
import AppDetailModal from '../modals/AppDetailModal'

export default function BundleDetailPage() {
  useDataFetching()
  const { bundleName } = useParams<{ bundleName: string }>()
  const navigate = useNavigate()
  const { state } = useAppContext()

  if (!bundleName) {
    return <PageShell><div className="dashboard-container"><p>Bundle not found.</p></div></PageShell>
  }

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const stableBundle = state.bundles[stableKey]
  const devBundle = state.bundles[devKey]

  if (!stableBundle && !devBundle) {
    return (
      <PageShell>
        <div className="dashboard-container">
          <p>Bundle "{bundleName}" not found.</p>
          <button className="back-link" onClick={() => navigate('/bundles')}>Back to Bundles</button>
        </div>
      </PageShell>
    )
  }

  const repoUrl = stableBundle?.repo_url || devBundle?.repo_url || `https://github.com/${bundleName}/revanced-patches`
  const repoInfo = getRepoInfo(repoUrl)
  const addMorpheUrl = getAddMorpheUrl(repoUrl)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const channels: string[] = []
  if (stableBundle) channels.push('stable')
  if (devBundle) channels.push('dev')

  const allApps: Array<{ package: string; app_name: string; icon_url?: string; patches?: any[] }> = []
  if (stableBundle?.apps) {
    for (const a of stableBundle.apps) {
      if (!allApps.some((x) => x.package === a.package)) allApps.push(a)
    }
  }
  if (devBundle?.apps) {
    for (const a of devBundle.apps) {
      if (!allApps.some((x) => x.package === a.package)) allApps.push(a)
    }
  }
  allApps.sort((a, b) => resolveAppName(a, state.nameCache).localeCompare(resolveAppName(b, state.nameCache)))

  const displayVersion = stableBundle?.version || devBundle?.version || ''
  const patchesName = stableBundle?.patches_name || devBundle?.patches_name || bundleName

  return (
    <PageShell>
      <div className="bundle-detail-page">
        <div className="bundle-detail-header">
          <button className="back-link" onClick={() => navigate('/bundles')}>
            <span dangerouslySetInnerHTML={{ __html: ARROW_ICON }} /> Bundles
          </button>
          <h1 className="bundle-detail-title">{patchesName}</h1>
          <div className="bundle-detail-meta">
            <span>Channels: {channels.join(', ')}</span>
            <span>Version: {displayVersion || 'unknown'}</span>
            {(() => {
              const rd = stableBundle?.release_date || devBundle?.release_date
              const s = rd ? getStaleness(rd) : null
              return s ? <span className={`staleness-badge staleness--${s.level}`} title={`Released ${rd}`}>{s.label}</span> : null
            })()}
          </div>
          <div className="bundle-detail-badges">
            {channels.map((ch) => (
              <ChannelBadge key={ch} channel={ch} />
            ))}
          </div>
          <div className="bundle-detail-actions">
            <a className="add-morphe-btn" href={addMorpheUrl} target="_blank" rel="noopener">Add to Morphe</a>
            <a className="modal-play-btn" href={repoUrl} target="_blank" rel="noopener" dangerouslySetInnerHTML={{ __html: iconSvg + ' Repository' }} />
            <button
              className="history-btn"
              title="View changelog history"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-bundle-history', { detail: { bundleName } }))
              }}
              dangerouslySetInnerHTML={{ __html: HISTORY_ICON }}
            />
          </div>
        </div>

        <div className="bundle-detail-apps">
          <div className="modal-patches-header">
            <span className="modal-patches-title">Apps</span>
            <span className="modal-patches-count">{allApps.length} app{allApps.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="bundle-detail-apps-list">
            {allApps.length === 0 ? (
              <div className="modal-no-patches">No apps available in this bundle.</div>
            ) : (
              allApps.map((app) => (
                <BundleDetailAppCard
                  key={app.package}
                  app={app}
                  bundleName={bundleName}
                  channels={channels}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <AppDetailModal />
    </PageShell>
  )
}

function BundleDetailAppCard({
  app,
  bundleName,
  channels,
}: {
  app: { package: string; app_name: string; icon_url?: string; patches?: { name: string; compatible_versions?: string[] }[] }
  bundleName: string
  channels: string[]
}) {
  const { state } = useAppContext()
  const navigate = useNavigate()
  const isPre = isAppPreRelease(bundleName, app.package, state.bundles)
  const patchCount = app.patches?.length ?? 0

  const allVersions = new Set<string>()
  for (const p of app.patches || []) {
    if (p.compatible_versions) {
      for (const v of p.compatible_versions) allVersions.add(v)
    }
  }
  const versionArr = [...allVersions].sort()

  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent('open-app', { detail: { app, bundleName, channels } }),
    )
  }

  return (
    <div
      className="app-mini-card"
      role="button"
      tabIndex={0}
      aria-label={`View patches for ${resolveAppName(app, state.nameCache)}`}
      data-package={app.package}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
    >
      <div className="app-mini-card-main">
        <AppIcon iconUrl={app.icon_url || state.iconCache[app.package]} />
        <div className="app-mini-card-info">
          <span className="app-mini-name">{resolveAppName(app, state.nameCache)}</span>
          {isPre && <Badge className={BADGE_CLASSES.PRE_RELEASE}>Pre-Release</Badge>}
          <span className="app-mini-pkg">{app.package}</span>
        </div>
        <div className="app-mini-stats">
          <span className="app-mini-patch-count">{patchCount} patch{patchCount !== 1 ? 'es' : ''}</span>
          <span className="app-mini-arrow" dangerouslySetInnerHTML={{ __html: ARROW_ICON }} />
        </div>
      </div>
      <div className="app-mini-versions">
        {versionArr.length === 0 ? (
          <VersionChip version="Any version" any />
        ) : (
          <>
            {versionArr.slice(0, 3).map((v) => <VersionChip key={v} version={v} />)}
            {versionArr.length > 3 && <VersionChip version={`+${versionArr.length - 3}`} any />}
          </>
        )}
      </div>
    </div>
  )
}
