const VERBOSE = true

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

export function fetchAllData() {
  const ts = Date.now()
  log('fetchAllData starting...')
  return Promise.all([
    fetchJson<CoreResponse>(`/data/core.json?_t=${ts}`, {}),
    fetchJson<StatsData>(`/data/stats.json?_t=${ts}`, {} as StatsData),
    fetchJson<{ affected_bundles?: AffectedBundle[] }>(`/data/changes.json?_t=${ts}`, {}),
    fetchJson<Record<string, BundleData>>(`/data/bundles.json?_t=${ts}`, {}),
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

import type { ReleaseCacheData, StatsData } from '../types/api'
import type { BundleData } from '../types/bundles'
import type { AffectedBundle } from '../types/changes'

export function fetchReleaseCache() {
  return fetchJson<ReleaseCacheData>('/data/state/release_cache.json', {} as ReleaseCacheData)
}
