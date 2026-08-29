import { useAppContext } from '../../../context/AppContext'
import { resolveAppName } from '../../../utils/misc'
import { Badge, BADGE_CLASSES } from '../../shared/Badge'
import AppIcon from './AppIcon'
import { useEntries, useUpdateActions, sortApps, AuthorLink } from './useEntries'

interface TimelineViewProps {
  grouped: Record<string, import('../../../types/bundles').BundleEntry>
  sortedSections: { title: string; names: string[] }[]
}

export default function TimelineView({ grouped, sortedSections }: TimelineViewProps) {
  const { state } = useAppContext()
  const allEntries = useEntries(grouped, sortedSections)
  const { handleOpenBundle, handleOpenApp } = useUpdateActions()

  function getDisplayName(bundleName: string, channels: string[]): string {
    const key = channels.find((ch) => state.bundles[`${bundleName}:${ch}`])
    const bundle = key ? state.bundles[`${bundleName}:${key}`] : null
    return bundle?.patches_name || bundleName
  }

  return (
    <div className="tl-track">
      {allEntries.map(({ bundleName, entry }) => {
        const dotColor = entry.badge_type === 'NEW BUNDLE' ? 'var(--color-rare)' : 'var(--color-normal)'
        const badgeClass = entry.badge_type === 'NEW BUNDLE' ? BADGE_CLASSES.NEW_BUNDLE : BADGE_CLASSES.UPDATED_BUNDLE
        const sortedApps = sortApps(entry.apps || [])

        return (
          <div key={bundleName} className="tl-entry" style={{ '--dot-color': dotColor } as React.CSSProperties}>
            <div className="tl-bundle-line">
              {entry.badge_type && <Badge className={badgeClass}>{entry.badge_type}</Badge>}
              <strong
                className="tl-bundle-link"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenBundle(bundleName, entry.channels)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenBundle(bundleName, entry.channels) } }}
              >
                {getDisplayName(bundleName, entry.channels)}
              </strong>
              <AuthorLink bundleName={bundleName} channels={entry.channels} className="tl-author" />
            </div>
            <div className="tl-apps">
              {sortedApps.map((app) => {
                const appBadgeClass = app.badge_type === 'NEW APP' ? BADGE_CLASSES.NEW_APP
                  : app.badge_type === 'UPDATED APP' ? BADGE_CLASSES.UPDATED_APP
                  : app.badge_type === 'REMOVED APP' ? BADGE_CLASSES.REMOVED_APP
                  : ''
                return (
                  <div
                    key={app.package}
                    className="tl-app"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenApp(app.package, bundleName, entry.channels)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenApp(app.package, bundleName, entry.channels) } }}
                  >
                    <AppIcon iconUrl={state.iconCache[app.package] || ''} pkg={app.package} size={26} />
                    <span className="tl-app-name">{resolveAppName(app, state.nameCache)}</span>
                    {app.badge_type && <Badge className={appBadgeClass}>{app.badge_type}</Badge>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
