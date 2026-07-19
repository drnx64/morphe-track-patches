import type { BundleData, BundleEntry, AppData } from '../types/bundles'
import type { AffectedBundle } from '../types/changes'

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = i < pa.length ? pa[i] : 0
    const nb = i < pb.length ? pb[i] : 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export function isAppPreRelease(
  bundleName: string,
  pkgName: string,
  bundlesData: Record<string, BundleData>,
): boolean {
  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const inStable = bundlesData[stableKey]?.apps?.some((a) => a.package === pkgName)
  const inDev = bundlesData[devKey]?.apps?.some((a) => a.package === pkgName)
  return !!inDev && !inStable
}

export function groupAffectedBundles(affectedBundles: AffectedBundle[]): Record<string, BundleEntry> {
  const appPrecedence: Record<string, number> = { 'NEW APP': 0, 'UPDATED APP': 1, 'REMOVED APP': 2 }
  const grouped: Record<string, BundleEntry> = {}

  for (const b of affectedBundles) {
    const bName = b.bundle
    if (!grouped[bName]) {
      grouped[bName] = { bundle: bName, channels: [], apps: [], badge_type: b.badge_type, version: '', repo_url: '' }
    }
    if (!grouped[bName].channels.includes(b.channel)) {
      grouped[bName].channels.push(b.channel)
    }
    for (const app of b.apps || []) {
      const existing = grouped[bName].apps.find((a) => a.package === app.package)
      if (!existing) {
        grouped[bName].apps.push({ ...app, scan_numbers: app.scan_numbers ? [...app.scan_numbers] : [] })
      } else {
        if ((appPrecedence[app.badge_type!] ?? 99) < (appPrecedence[existing.badge_type!] ?? 99)) {
          existing.badge_type = app.badge_type
        }
        if (app.scan_numbers) {
          for (const sn of app.scan_numbers) {
            if (!existing.scan_numbers?.includes(sn)) {
              if (!existing.scan_numbers) existing.scan_numbers = []
              existing.scan_numbers.push(sn)
            }
          }
        }
      }
    }
    if (b.badge_type === 'NEW BUNDLE') {
      grouped[bName].badge_type = 'NEW BUNDLE'
    }
  }

  return grouped
}

export function getNextScanTime(): Date {
  const now = new Date()
  const utcHour = now.getUTCHours()
  const slot = Math.floor(utcHour / 3) * 3
  let nextHour = slot + 3
  if (now.getUTCMinutes() < 1 && utcHour === slot) {
    nextHour = slot
  }
  const next = new Date(now)
  if (nextHour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 1, 0, 0)
  } else {
    next.setUTCHours(nextHour, 1, 0, 0)
  }
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 1, 0, 0)
  }
  return next
}

export function getScanBatch(): number {
  return Math.floor(new Date().getUTCHours() / 3) + 1
}

export function sortBundleNames(list: BundleEntry[]): BundleEntry[] {
  const orderList = ['morphe', 'piko', 'rookieenough', 'hoo-dles', 'paresh-maheshwari', 'brosssh', 'patcheddit']
  return [...list].sort((a, b) => {
    const aIndex = orderList.indexOf(a.bundle)
    const bIndex = orderList.indexOf(b.bundle)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    const aCount = a.apps?.length ?? 0
    const bCount = b.apps?.length ?? 0
    if (bCount !== aCount) return bCount - aCount
    return a.bundle.localeCompare(b.bundle)
  })
}

export function resolveAppName(
  app: { package: string; app_name: string },
  nameCache: Record<string, string>,
): string {
  const n = nameCache[app.package]
  if (typeof n === 'string' && n) return n
  return app.app_name
}

export function getAppIconUrl(
  app: { icon_url?: string; package?: string },
  iconCache: Record<string, string>,
): string {
  if (!app) return ''
  const url = app.icon_url || (app.package ? iconCache[app.package] : '') || ''
  return typeof url === 'string' ? url : ''
}

export function daysSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return null
  const now = new Date()
  return Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24))
}

export interface StalenessInfo {
  days: number
  level: 'fresh' | 'moderate' | 'stale'
  label: string
}

export function getStaleness(dateStr: string | undefined | null): StalenessInfo | null {
  const d = daysSince(dateStr)
  if (d === null) return null
  if (d <= 7) return { days: d, level: 'fresh', label: `${d}d` }
  if (d <= 14) return { days: d, level: 'moderate', label: `${d}d` }
  return { days: d, level: 'stale', label: `${d}d` }
}
