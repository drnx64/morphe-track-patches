import { useMemo, useCallback } from 'react'
import { useAppContext } from '../../../context/AppContext'
import { getRepoInfo } from '../../../utils/url'
import type { BundleEntry, AppData } from '../../../types/bundles'

export const SORT_ORDER: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }

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

  const handleOpenApp = useCallback((pkg: string, bundleName: string, channels: string[]) => {
    const appData = appLookup.get(pkg)
    if (appData) {
      window.dispatchEvent(new CustomEvent('open-app', { detail: { app: appData, bundleName, channels } }))
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
