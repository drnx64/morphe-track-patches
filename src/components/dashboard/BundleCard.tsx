import { useState, useCallback, memo } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, getAppIconUrl, isAppPreRelease } from '../../utils/misc'
import { getRepoInfo, getAddMorpheUrl } from '../../utils/url'
import { escHtml } from '../../utils/html'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON } from '../../utils/svg'
import ChannelBadge from '../shared/ChannelBadge'
import AppMiniCard from './AppMiniCard'
import type { BundleEntry } from '../../types/bundles'

interface BundleCardProps {
  bundle: BundleEntry
}

const BundleCard = memo(function BundleCard({ bundle }: BundleCardProps) {
  const { state } = useAppContext()
  const [expanded, setExpanded] = useState(false)

  const repoInfo = getRepoInfo(bundle.repo_url)
  const addMorpheUrl = getAddMorpheUrl(bundle.repo_url)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const apps = [...(bundle.apps || [])].sort((x, y) =>
    resolveAppName(x, state.nameCache).localeCompare(resolveAppName(y, state.nameCache)),
  )
  const count = apps.length
  const appsWord = count === 1 ? 'app' : 'apps'

  let updatedBadge = ''
  if (bundle.version) {
    const todayStr = new Date().toISOString().split('T')[0]
    if (state.liveDataDate === todayStr) {
      const stored = JSON.parse(localStorage.getItem('morphe_versions') || '{}')
      const prev = stored[bundle.bundle]
      if (prev && prev !== bundle.version) {
        updatedBadge = '<span class="bundle-updated-badge">Updated</span>'
      }
    }
  }

  const versionTag = bundle.version
    ? `<span class="bundle-version-tag">${escHtml(bundle.version)}</span>`
    : ''

  const handleClick = useCallback(() => {
    if (state.viewMode === 'list') {
      window.location.hash = `bundle=${encodeURIComponent(bundle.bundle)}`
      window.dispatchEvent(
        new CustomEvent('open-bundle', {
          detail: { bundleName: bundle.bundle, channels: bundle.channels, version: bundle.version || '' },
        }),
      )
      return
    }
    setExpanded((prev) => !prev)
    if (bundle.version) {
      const stored = JSON.parse(localStorage.getItem('morphe_versions') || '{}')
      if (stored[bundle.bundle] !== bundle.version) {
        stored[bundle.bundle] = bundle.version
        localStorage.setItem('morphe_versions', JSON.stringify(stored))
      }
    }
  }, [bundle, state.viewMode])

  const handleHistory = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      window.dispatchEvent(
        new CustomEvent('open-bundle-history', { detail: { bundleName: bundle.bundle } }),
      )
    },
    [bundle.bundle],
  )

  return (
    <div
      className={`bundle-card${state.viewMode === 'list' ? ' compact' : ''}${expanded ? ' expanded' : ''}`}
      data-bundle-name={bundle.bundle}
      onClick={handleClick}
    >
      <div className="bundle-card-header">
        <div className="bundle-title-group">
          <div className="bundle-title-row">
            <span className="bundle-name-title" title={bundle.bundle}>
              {bundle.bundle}
            </span>
            <span dangerouslySetInnerHTML={{ __html: updatedBadge }} />
          </div>
          <div className="channel-badges-group">
            {bundle.channels.map((ch) => (
              <ChannelBadge key={ch} channel={ch} />
            ))}
          </div>
          <span dangerouslySetInnerHTML={{ __html: versionTag }} />
        </div>
        <a
          href={bundle.repo_url}
          className="github-repo-icon-link"
          target="_blank"
          rel="noopener"
          title="View Source Repository"
          onClick={(e) => e.stopPropagation()}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
      </div>

      <div className="apps-summary">{count} compatible {appsWord}</div>

      {expanded && (
        <div className="apps-card-drawer" data-drawer>
          {apps.length === 0 ? (
            <div className="no-apps-msg">No app info available.</div>
          ) : (
            apps.map((app) => (
              <AppMiniCard
                key={app.package}
                app={app}
                bundleName={bundle.bundle}
                bundleChannels={bundle.channels}
              />
            ))
          )}
        </div>
      )}

      <div className="bundle-card-actions">
        <a
          href={addMorpheUrl}
          className="add-morphe-btn"
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
        >
          Add to Morphe
        </a>
        <button
          className="history-btn"
          data-bundle={bundle.bundle}
          title="View changelog history"
          onClick={handleHistory}
          dangerouslySetInnerHTML={{ __html: HISTORY_ICON }}
        />
      </div>
    </div>
  )
})

export default BundleCard
