import { useMemo, useCallback, useState } from 'react'
import { useAppContext } from '../../../context/AppContext'
import { resolveAppName } from '../../../utils/misc'
import { getRepoInfo } from '../../../utils/url'
import { Badge, BADGE_CLASSES } from '../../shared/Badge'
import AppIcon from './AppIcon'
import type { BundleEntry } from '../../../types/bundles'

const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

interface AccordionViewProps {
  grouped: Record<string, BundleEntry>
  sortedSections: { title: string; names: string[] }[]
}

function getSummaryLine(entry: BundleEntry): string {
  const counts = { new: 0, updated: 0, removed: 0 }
  for (const app of entry.apps) {
    if (app.badge_type === 'NEW APP') counts.new++
    else if (app.badge_type === 'UPDATED APP') counts.updated++
    else if (app.badge_type === 'REMOVED APP') counts.removed++
  }
  const parts: string[] = []
  if (counts.new) parts.push(`${counts.new} new`)
  if (counts.updated) parts.push(`${counts.updated} updated`)
  if (counts.removed) parts.push(`${counts.removed} removed`)
  return parts.join(', ') || `${entry.apps.length} changes`
}

function AuthorLink({ repoUrl }: { repoUrl?: string }) {
  if (!repoUrl) return <span className="acc-author">unknown</span>
  const { isGitLab, path } = getRepoInfo(repoUrl)
  const author = path.split('/')[0]
  const href = isGitLab ? `https://gitlab.com/${author}` : `https://github.com/${author}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="acc-author">
      @{author}
    </a>
  )
}

export default function AccordionView({ grouped, sortedSections }: AccordionViewProps) {
  const { state } = useAppContext()
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    const all = new Set<string>()
    for (const section of sortedSections) {
      for (const name of section.names) all.add(name)
    }
    return all
  })

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

  const toggleItem = useCallback((name: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

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
    <div className="acc-list">
      {allEntries.map(({ bundleName, entry }) => {
        const isOpen = openItems.has(bundleName)
        const badgeClass = entry.badge_type === 'NEW BUNDLE' ? BADGE_CLASSES.NEW_BUNDLE : BADGE_CLASSES.UPDATED_BUNDLE
        const sortedApps = [...(entry.apps || [])].sort((a, b) => {
          return (SORT_ORDER[a.badge_type!] ?? 99) - (SORT_ORDER[b.badge_type!] ?? 99)
        })

        return (
          <div key={bundleName} className={`acc-item${isOpen ? ' is-open' : ''}`}>
            <button
              className="acc-trigger"
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleItem(bundleName)}
            >
              {entry.badge_type && <Badge className={badgeClass}>{entry.badge_type}</Badge>}
              <div className="acc-titles">
                <span
                  className="acc-bundle-link"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleOpenBundle(bundleName, entry.channels) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleOpenBundle(bundleName, entry.channels) } }}
                >
                  {bundleName}
                </span>
                <span className="acc-summary">
                  <AuthorLink repoUrl={entry.repo_url} />
                  {' · '}
                  {getSummaryLine(entry)}
                </span>
              </div>
              <span className="acc-chevron" aria-hidden="true">▾</span>
            </button>
            <div className="acc-panel">
              <div className="acc-panel-inner">
                {sortedApps.map((app) => {
                  const appBadgeClass = app.badge_type === 'NEW APP' ? BADGE_CLASSES.NEW_APP
                    : app.badge_type === 'UPDATED APP' ? BADGE_CLASSES.UPDATED_APP
                    : app.badge_type === 'REMOVED APP' ? BADGE_CLASSES.REMOVED_APP
                    : ''
                  return (
                    <div
                      key={app.package}
                      className="acc-app-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenApp(app.package, bundleName, entry.channels)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenApp(app.package, bundleName, entry.channels) } }}
                    >
                      <AppIcon iconUrl={state.iconCache[app.package] || ''} pkg={app.package} size={26} />
                      <span className="acc-app-name">{resolveAppName(app, state.nameCache)}</span>
                      {app.badge_type && <Badge className={appBadgeClass}>{app.badge_type}</Badge>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
