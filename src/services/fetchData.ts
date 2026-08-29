const VERBOSE = import.meta.env.DEV

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[fetchData]', ...args)
}

function fetchJson<T>(url: string, fallback: T): Promise<T> {
  log(`fetching ${url}...`)
  return fetch(url)
    .then((r) => {
      if (r.ok) {
        log(`OK ${url} (${r.status})`)
        return r.json() as T
      }
      log(`FAIL ${url} (${r.status} ${r.statusText}) — using fallback`)
      return fallback
    })
    .catch((err) => {
      log(`ERROR ${url}: ${(err as Error).message} — using fallback`)
      return fallback
    })
}

interface CoreResponse {
  date?: string
  last_run?: string
  lastChecked?: string
}

export interface BundleIndexEntry {
  bundle: string
  channel: string
  version: string
  repo_url: string
  patches_name?: string
  release_tag?: string
  release_date?: string
  app_count: number
}

export function fetchBundleIndex(): Promise<Record<string, BundleIndexEntry>> {
  return fetchJson<Record<string, BundleIndexEntry>>('/data/bundles/_index.json', {})
}

export async function fetchBundleData(bundleKey: string): Promise<BundleData | null> {
  const filename = bundleKey.replace(':', '_') + '.json'
  return fetchJson<BundleData | null>(`/data/bundles/${filename}`, null)
}

export async function fetchAllBundlesFromIndex(): Promise<Record<string, BundleData>> {
  const index = await fetchBundleIndex()
  const keys = Object.keys(index)
  if (keys.length === 0) return {}

  log(`fetchAllBundlesFromIndex: loading ${keys.length} bundles...`)
  const results = await Promise.all(
    keys.map(async (key) => {
      const data = await fetchBundleData(key)
      return [key, data] as const
    })
  )

  const bundles: Record<string, BundleData> = {}
  for (const [key, data] of results) {
    if (data) bundles[key] = data
  }
  log(`fetchAllBundlesFromIndex: loaded ${Object.keys(bundles).length} bundles`)
  return bundles
}

export function fetchAllData() {
  const ts = Date.now()
  log('fetchAllData starting...')
  return Promise.all([
    fetchJson<CoreResponse>(`/data/core.json?_t=${ts}`, {}),
    fetchJson<StatsData>(`/data/stats.json?_t=${ts}`, {} as StatsData),
    fetchJson<{ affected_bundles?: AffectedBundle[] }>(`/data/changes.json?_t=${ts}`, {}),
    fetchAllBundlesFromIndex(),
  ]).then(([core, stats, changes, bundles]) => {
    log(`fetchAllData done: date=${core?.date}, bundles keys=${Object.keys(bundles).length}`)
    return {
      date: core?.date || '',
      last_run: core?.last_run || '',
      lastChecked: core?.lastChecked || '',
      stats,
      changes,
      bundles,
    }
  })
}

export function fetchCore() {
  return fetchJson<CoreResponse>(`/data/core.json?_t=${Date.now()}`, {})
}

export function fetchStats() {
  return fetchJson<StatsData>(`/data/stats.json?_t=${Date.now()}`, {} as StatsData)
}

export function fetchChanges() {
  return fetchJson<{ affected_bundles?: AffectedBundle[] }>(`/data/changes.json?_t=${Date.now()}`, {})
}

export function fetchBundles() {
  return fetchAllBundlesFromIndex()
}

export function fetchLastChecked() {
  log('fetchLastChecked...')
  return fetch('/data/state/last_run.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { lastChecked?: string } | null) => {
      log(`fetchLastChecked: ${d?.lastChecked ?? null}`)
      return d?.lastChecked ?? null
    })
    .catch((err) => {
      log(`fetchLastChecked ERROR: ${(err as Error).message}`)
      return null
    })
}

export function fetchIconCache() {
  return fetchJson<Record<string, string>>('/data/state/icon_cache.json', {})
}

export function fetchNameCache() {
  return fetchJson<Record<string, string>>('/data/state/name_cache.json', {})
}

export function fetchChangelog() {
  return fetchJson<unknown[]>('/data/changelog.json', [])
}

export async function fetchBundlesIncremental(
  cachedBundles: Record<string, BundleData>,
  cachedIndex: Record<string, BundleIndexEntry> | null,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ bundles: Record<string, BundleData>; index: Record<string, BundleIndexEntry> }> {
  const newIndex = await fetchBundleIndex()
  const newKeys = Object.keys(newIndex)

  const keysToFetch: string[] = []
  for (const key of newKeys) {
    const cached = cachedIndex?.[key]
    const fresh = newIndex[key]
    if (!cached || cached.version !== fresh.version) {
      keysToFetch.push(key)
    }
  }

  log(`fetchBundlesIncremental: ${newKeys.length} total, ${keysToFetch.length} changed`)

  if (keysToFetch.length === 0) {
    log('no bundle changes detected, using cached bundles')
    return { bundles: cachedBundles, index: newIndex }
  }

  const BATCH = 50
  const bundles = { ...cachedBundles }
  for (let i = 0; i < keysToFetch.length; i += BATCH) {
    const batch = keysToFetch.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (key) => {
      const data = await fetchBundleData(key)
      return [key, data] as const
    }))
    for (const [key, data] of results) {
      if (data) bundles[key] = data
    }
    onProgress?.(Math.min(i + BATCH, keysToFetch.length), keysToFetch.length)
  }

  // Remove bundles that no longer exist in the index
  for (const key of Object.keys(bundles)) {
    if (!newIndex[key]) delete bundles[key]
  }

  log(`fetchBundlesIncremental: loaded ${keysToFetch.length} new/changed bundles`)
  return { bundles, index: newIndex }
}

export function fetchBundlesBatched(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Record<string, BundleData>> {
  return fetchBundleIndex().then(async (index) => {
    const keys = Object.keys(index)
    if (keys.length === 0) return {}

    log(`fetchBundlesBatched: loading ${keys.length} bundles...`)
    const BATCH = 50
    const bundles: Record<string, BundleData> = {}
    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(async (key) => {
        const data = await fetchBundleData(key)
        return [key, data] as const
      }))
      for (const [key, data] of results) {
        if (data) bundles[key] = data
      }
      onProgress?.(Math.min(i + BATCH, keys.length), keys.length)
    }
    log(`fetchBundlesBatched: loaded ${Object.keys(bundles).length} bundles`)
    return bundles
  })
}

import type { ReleaseCacheData, StatsData } from '../types/api'
import type { BundleData } from '../types/bundles'
import type { AffectedBundle } from '../types/changes'

export function fetchReleaseCache() {
  return fetchJson<ReleaseCacheData>('/data/state/release_cache.json', {} as ReleaseCacheData)
}
