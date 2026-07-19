import { useCallback, memo } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, isAppPreRelease, getAppIconUrl } from '../../utils/misc'
import { escHtml } from '../../utils/html'
import { ARROW_ICON } from '../../utils/svg'
import AppIcon from '../shared/AppIcon'
import VersionChip from '../shared/VersionChip'
import { Badge, BADGE_CLASSES } from '../shared/Badge'
import type { AppData } from '../../types/bundles'

interface AppMiniCardProps {
  app: AppData
  bundleName: string
  bundleChannels: string[]
}

const AppMiniCard = memo(function AppMiniCard({ app, bundleName, bundleChannels }: AppMiniCardProps) {
  const { state } = useAppContext()
  const isPre = isAppPreRelease(bundleName, app.package, state.bundles)

  const patchList = app.patches || []
  const patchCount = patchList.length

  const allVersions = new Set<string>()
  for (const p of patchList) {
    if (p.compatible_versions) {
      for (const v of p.compatible_versions) allVersions.add(v)
    }
  }
  const versionArr = [...allVersions].sort()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      window.dispatchEvent(
        new CustomEvent('open-app', {
          detail: { app, bundleName, channels: bundleChannels },
        }),
      )
    },
    [app, bundleName, bundleChannels],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        window.dispatchEvent(
          new CustomEvent('open-app', {
            detail: { app, bundleName, channels: bundleChannels },
          }),
        )
      }
    },
    [app, bundleName, bundleChannels],
  )

  return (
    <div
      className="app-mini-card"
      role="button"
      tabIndex={0}
      aria-label={`View patches for ${resolveAppName(app, state.nameCache)}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="app-mini-card-main">
        <AppIcon iconUrl={getAppIconUrl(app, state.iconCache)} />
        <div className="app-mini-card-info">
          <span className="app-mini-name">{resolveAppName(app, state.nameCache)}</span>
          {isPre && <Badge className={BADGE_CLASSES.PRE_RELEASE}>Pre-Release</Badge>}
          <span className="app-mini-pkg">{app.package}</span>
        </div>
        <div className="app-mini-stats">
          <span className="app-mini-patch-count">
            {patchCount} patch{patchCount !== 1 ? 'es' : ''}
          </span>
          <span dangerouslySetInnerHTML={{ __html: ARROW_ICON }} className="app-mini-arrow" />
        </div>
      </div>
      <div className="app-mini-versions">
        {versionArr.length === 0 ? (
          <VersionChip version="Any version" any />
        ) : (
          <>
            {versionArr.slice(0, 3).map((v) => (
              <VersionChip key={v} version={v} />
            ))}
            {versionArr.length > 3 && <VersionChip version={`+${versionArr.length - 3}`} any />}
          </>
        )}
      </div>
    </div>
  )
})

export default AppMiniCard
