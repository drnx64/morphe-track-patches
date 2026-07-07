import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, isAppPreRelease } from '../../utils/misc'
import { getRepoInfo, getAddMorpheUrl } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON, ARROW_ICON } from '../../utils/svg'
import Modal from '../shared/Modal'
import ChannelBadge from '../shared/ChannelBadge'
import AppIcon from '../shared/AppIcon'
import VersionChip from '../shared/VersionChip'
import { Badge, BADGE_CLASSES } from '../shared/Badge'

export default function BundleDetailModal() {
  const { state } = useAppContext()
  const [open, setOpen] = useState(false)
  const [bundleName, setBundleName] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [version, setVersion] = useState('')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setBundleName(detail.bundleName)
      setChannels(detail.channels || [])
      setVersion(detail.version || '')
      setOpen(true)
    }
    window.addEventListener('open-bundle', handler)
    return () => window.removeEventListener('open-bundle', handler)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const stableBundle = state.bundles[stableKey]
  const devBundle = state.bundles[devKey]

  const repoUrl = stableBundle?.repo_url || devBundle?.repo_url || `https://github.com/${bundleName}/revanced-patches`
  const repoInfo = getRepoInfo(repoUrl)
  const addMorpheUrl = getAddMorpheUrl(repoUrl)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const allChannels = [...channels]
  if (stableBundle && !allChannels.includes('stable')) allChannels.push('stable')
  if (devBundle && !allChannels.includes('dev')) allChannels.push('dev')

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

  const displayVersion = version || stableBundle?.version || devBundle?.version || ''

  return (
    <Modal id="bundle-detail-modal" open={open} onClose={close} ariaLabel={bundleName}>
      <div className="modal-header">
        <div className="modal-header-top">
          <div className="modal-app-identity">
            <h3 className="modal-app-name" id="bundle-modal-name">{bundleName}</h3>
            <div className="modal-meta-row">
              <span className="modal-bundle-info" id="bundle-modal-channels">Channels: {allChannels.join(', ')}</span>
            </div>
            <div className="modal-channel-row" id="bundle-modal-badges">
              {allChannels.map((ch) => (
                <ChannelBadge key={ch} channel={ch} />
              ))}
            </div>
          </div>
          <div className="modal-header-actions">
            <a className="modal-play-btn" id="bundle-modal-repo-link" href={repoUrl} target="_blank" rel="noopener" dangerouslySetInnerHTML={{ __html: iconSvg + ' Repository' }} />
            <button className="modal-close" id="bundle-modal-close-btn" aria-label="Close bundle modal" onClick={close}>&times;</button>
          </div>
        </div>
        <div className="bundle-modal-meta">
          <span className="versions-label">Version:</span>
          <span className="bundle-version-tag" id="bundle-modal-version">{displayVersion || 'unknown'}</span>
        </div>
      </div>

      <div className="modal-body">
        <div className="modal-patches-header">
          <span className="modal-patches-title">Apps</span>
          <span className="modal-patches-count" id="bundle-modal-apps-count">{allApps.length} app{allApps.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="bundle-modal-actions">
          <a className="add-morphe-btn" id="bundle-modal-add-morphe" href={addMorpheUrl} target="_blank" rel="noopener">Add to Morphe</a>
          <button
            className="history-btn"
            id="bundle-modal-history-btn"
            title="View changelog history"
            onClick={(e) => {
              e.stopPropagation()
              close()
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-bundle-history', { detail: { bundleName } }))
              }, 200)
            }}
            dangerouslySetInnerHTML={{ __html: HISTORY_ICON }}
          />
        </div>
        <div className="bundle-modal-apps-list" id="bundle-modal-apps-list">
          {allApps.length === 0 ? (
            <div className="modal-no-patches">No apps available in this bundle.</div>
          ) : (
            allApps.map((app) => (
              <BundleAppCard
                key={app.package}
                app={app}
                bundleName={bundleName}
                channels={allChannels}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

function BundleAppCard({
  app,
  bundleName,
  channels,
}: {
  app: { package: string; app_name: string; icon_url?: string; patches?: { name: string; compatible_versions?: string[] }[] }
  bundleName: string
  channels: string[]
}) {
  const { state } = useAppContext()
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
          <span className="app-mini-name">{escHtml(resolveAppName(app, state.nameCache))}</span>
          {isPre && <Badge className={BADGE_CLASSES.PRE_RELEASE}>Pre-Release</Badge>}
          <span className="app-mini-pkg">{escHtml(app.package)}</span>
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
