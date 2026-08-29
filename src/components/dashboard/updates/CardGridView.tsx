import { useMemo, useCallback } from 'react'
import { useAppContext } from '../../../context/AppContext'
import { resolveAppName } from '../../../utils/misc'
import { getRepoInfo } from '../../../utils/url'
import { Badge, BADGE_CLASSES } from '../../shared/Badge'
import AppIcon from './AppIcon'
import type { BundleEntry } from '../../../types/bundles'

const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

interface CardGridViewProps {
  grouped: Record<string, BundleEntry>
  sortedSections: { title: string; names: string[] }[]
}

function AuthorLink({ repoUrl }: { repoUrl?: string }) {
  if (!repoUrl) return <span className="grid-author">unknown</span>
  const { isGitLab, path } = getRepoInfo(repoUrl)
  const author = path.split('/')[0]
  const href = isGitLab ? `https://gitlab.com/${author}` : `https://github.com/${author}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="grid-author">
      @{author}
    </a>
  )
}

export default function CardGridView({ grouped, sortedSections }: CardGridViewProps) {
  const { state } = useAppContext()

  const handleOpenBundle = useCallback((bundleName: string, channels: string[]) => {
    window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
  }, [])

  const handleOpenApp = useCallback((pkg: string, bundleName: string, channels: string[]) => {
    const stableKey = `${bundleName}:stable`
    const devKey = `${bundleName}:dev`
    let appData = state.bundles[stableKey]?.apps?.find((a) => a.package === pkg)
    if (!appData) appData = state.bundles[devKey]?.apps?.find((a) => a.package === pkg)
    if (appData) {
      window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName, channels } }))
    }
  }, [state.bundles])

  const allEntries = useMemo(() => {
    const entries: { bundleName: string; entry: BundleEntry }[] = []
    for (const section of sortedSections) {
      for (const name of section.names) {
        if (grouped[name]) entries.push({ bundleName: name, entry: grouped[name] })
      }
    }
    return entries
  }, [grouped, sortedSections])

  return (
    <div className="grid-cards">
      {allEntries.map(({ bundleName, entry }) => {
        const badgeClass = entry.badge_type === 'NEW BUNDLE' ? BADGE_CLASSES.NEW_BUNDLE : BADGE_CLASSES.UPDATED_BUNDLE
        const sortedApps = [...(entry.apps || [])].sort((a, b) => {
          return (SORT_ORDER[a.badge_type!] ?? 99) - (SORT_ORDER[b.badge_type!] ?? 99)
        })

        return (
          <div key={bundleName} className="grid-card">
            <div className="grid-card-head">
              <div className="grid-card-titles">
                <strong
                  className="grid-bundle-link"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenBundle(bundleName, entry.channels)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenBundle(bundleName, entry.channels) } }}
                >
                  {bundleName}
                </strong>
                <AuthorLink repoUrl={entry.repo_url} />
              </div>
              {entry.badge_type && <Badge className={badgeClass}>{entry.badge_type}</Badge>}
            </div>
            <div className="grid-app-list">
              {sortedApps.map((app) => {
                const appBadgeClass = app.badge_type === 'NEW APP' ? BADGE_CLASSES.NEW_APP
                  : app.badge_type === 'UPDATED APP' ? BADGE_CLASSES.UPDATED_APP
                  : app.badge_type === 'REMOVED APP' ? BADGE_CLASSES.REMOVED_APP
                  : ''
                return (
                  <div
                    key={app.package}
                    className="grid-app-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenApp(app.package, bundleName, entry.channels)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenApp(app.package, bundleName, entry.channels) } }}
                  >
                    <AppIcon iconUrl={state.iconCache[app.package] || ''} pkg={app.package} size={32} />
                    <div className="grid-app-meta">
                      <span className="grid-app-name">{resolveAppName(app, state.nameCache)}</span>
                      <span className="grid-app-pkg">{app.package}</span>
                    </div>
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
