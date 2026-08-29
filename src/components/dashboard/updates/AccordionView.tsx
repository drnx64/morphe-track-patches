import { useState, useCallback } from 'react'
import { useAppContext } from '../../../context/AppContext'
import { resolveAppName } from '../../../utils/misc'
import { Badge, BADGE_CLASSES } from '../../shared/Badge'
import AppIcon from './AppIcon'
import { useEntries, useUpdateActions, sortApps, AuthorLink, type EntryItem } from './useEntries'
import { CHEVRON_DOWN, CHEVRON_RIGHT } from '../../../utils/svg'

interface AccordionViewProps {
  grouped: Record<string, import('../../../types/bundles').BundleEntry>
  sortedSections: { title: string; names: string[] }[]
}

function getSummaryLine(entry: import('../../../types/bundles').BundleEntry): string {
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

export default function AccordionView({ grouped, sortedSections }: AccordionViewProps) {
  const { state } = useAppContext()
  const allEntries = useEntries(grouped, sortedSections)
  const { handleOpenBundle, handleOpenApp } = useUpdateActions()
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    const all = new Set<string>()
    for (const section of sortedSections) {
      for (const name of section.names) all.add(name)
    }
    return all
  })

  function getDisplayName(bundleName: string, channels: string[]): string {
    const key = channels.find((ch) => state.bundles[`${bundleName}:${ch}`])
    const bundle = key ? state.bundles[`${bundleName}:${key}`] : null
    return bundle?.patches_name || bundleName
  }

  const toggleItem = useCallback((name: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const allOpen = openItems.size === allEntries.length

  const toggleAll = useCallback(() => {
    if (allOpen) {
      setOpenItems(new Set())
    } else {
      setOpenItems(new Set(allEntries.map((e) => e.bundleName)))
    }
  }, [allOpen, allEntries])

  return (
    <div className="acc-list">
      {allEntries.length > 1 && (
        <div className="acc-expand-all">
          <button type="button" className="acc-expand-all-btn" onClick={toggleAll}>
            <span dangerouslySetInnerHTML={{ __html: allOpen ? CHEVRON_DOWN : CHEVRON_RIGHT }} />
            {allOpen ? ' Collapse all' : ' Expand all'}
          </button>
        </div>
      )}
      {allEntries.map(({ bundleName, entry }: EntryItem) => {
        const isOpen = openItems.has(bundleName)
        const badgeClass = entry.badge_type === 'NEW BUNDLE' ? BADGE_CLASSES.NEW_BUNDLE : BADGE_CLASSES.UPDATED_BUNDLE
        const sortedApps = sortApps(entry.apps || [])

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
                  {getDisplayName(bundleName, entry.channels)}
                </span>
                <span className="acc-summary">
                  <AuthorLink bundleName={bundleName} channels={entry.channels} className="acc-author" />
                  {' · '}
                  {getSummaryLine(entry)}
                </span>
              </div>
              <span className="acc-chevron" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CHEVRON_DOWN }} />
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
                      {app.badge_type && <Badge className={appBadgeClass}>{app.badge_type}</Badge>}
                      <AppIcon iconUrl={state.iconCache[app.package] || ''} pkg={app.package} size={26} />
                      <span className="acc-app-name">{resolveAppName(app, state.nameCache)}</span>
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
