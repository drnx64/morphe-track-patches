import { useMemo, useCallback } from 'react'
import { useAppContext } from '../../../context/AppContext'
import { getRepoInfo } from '../../../utils/url'
import { VERSION_ARROW } from '../../../utils/svg'
import type { BundleEntry, AppData } from '../../../types/bundles'

export const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'MAJOR UPDATE': 1, 'UPDATED APP': 2, 'REMOVED APP': 3 }

export function sortApps(apps: AppData[]): AppData[] {
  return [...apps].sort((a, b) => (SORT_ORDER[a.badge_type!] ?? 99) - (SORT_ORDER[b.badge_type!] ?? 99))
}

export interface EntryItem {
  bundleName: string
  entry: BundleEntry
}

export function useEntries(
  grouped: Record<string, BundleEntry>,
  sortedSections: { title: string; names: string[] }[],
): EntryItem[] {
  return useMemo(() => {
    const entries: EntryItem[] = []
    for (const section of sortedSections) {
      for (const name of section.names) {
        if (grouped[name]) entries.push({ bundleName: name, entry: grouped[name] })
      }
    }
    return entries
  }, [grouped, sortedSections])
}

export function useUpdateActions() {
  const { state } = useAppContext()

  const appLookup = useMemo(() => {
    const map = new Map<string, AppData>()
    for (const key of Object.keys(state.bundles)) {
      const bundle = state.bundles[key]
      if (bundle?.apps) {
        for (const app of bundle.apps) {
          if (!map.has(app.package)) map.set(app.package, app)
        }
      }
    }
    return map
  }, [state.bundles])

  const handleOpenBundle = useCallback((bundleName: string, channels: string[]) => {
    window.dispatchEvent(new CustomEvent('open-bundle', { detail: { bundleName, channels, version: '' } }))
  }, [])

  const handleOpenApp = useCallback((pkg: string, bundleName: string, channels: string[], changesApp?: AppData) => {
    // Prefer app data from changes (has patch_diff), fallback to catalog lookup
    const appData = changesApp || appLookup.get(pkg)
    if (appData) {
      window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName, channels, fromUpdates: true } }))
    }
  }, [appLookup])

  return { handleOpenBundle, handleOpenApp }
}

interface AuthorLinkProps {
  bundleName: string
  channels: string[]
  className: string
}

export function AuthorLink({ bundleName, channels, className }: AuthorLinkProps) {
  const { state } = useAppContext()
  const key = channels.find((ch) => state.bundles[`${bundleName}:${ch}`])
  const bundle = key ? state.bundles[`${bundleName}:${key}`] : null
  const repoUrl = bundle?.repo_url

  if (!repoUrl) return <span className={className}>{bundleName}</span>
  const { isGitLab, path } = getRepoInfo(repoUrl)
  const author = path.split('/')[0]
  const href = isGitLab ? `https://gitlab.com/${author}` : `https://github.com/${author}`
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      @{author}
    </a>
  )
}

export function VersionArrow({ bundleName, channels, newVersion }: { bundleName: string; channels: string[]; newVersion: string }) {
  const { state } = useAppContext()
  const key = channels.find((ch) => state.bundles[`${bundleName}:${ch}`])
  const oldVersion = key ? state.bundles[`${bundleName}:${key}`]?.version : ''
  if (!newVersion) return null
  return (
    <span className="version-arrow-wrap">
      {oldVersion && oldVersion !== newVersion && (
        <span className="version-arrow-old">{oldVersion}</span>
      )}
      <span className="version-arrow-icon" dangerouslySetInnerHTML={{ __html: VERSION_ARROW }} />
      <span className="version-arrow-text">{newVersion}</span>
    </span>
  )
}
