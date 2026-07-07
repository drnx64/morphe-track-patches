import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, getAppIconUrl } from '../../utils/misc'
import { getPlayStoreUrl } from '../../utils/url'
import { escHtml } from '../../utils/html'
import Modal from '../shared/Modal'
import AppIcon from '../shared/AppIcon'
import ChannelBadge from '../shared/ChannelBadge'
import VersionChip from '../shared/VersionChip'
import type { AppData, PatchData } from '../../types/bundles'

export default function AppDetailModal() {
  const { state } = useAppContext()
  const [open, setOpen] = useState(false)
  const [app, setApp] = useState<AppData | null>(null)
  const [bundleName, setBundleName] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [currentChannel, setCurrentChannel] = useState<'stable' | 'dev'>('stable')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setApp(detail.app)
      setBundleName(detail.bundleName)
      setChannels(detail.channels || [])
      setCurrentChannel('stable')
      setOpen(true)
    }
    window.addEventListener('open-app', handler)
    return () => window.removeEventListener('open-app', handler)
  }, [])

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
