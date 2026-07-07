import type { BundleData, AppData } from './bundles'
import type { AffectedBundle } from './changes'

export interface StatsData {
  total_bundles: number
  total_apps: number
  new_apps_today: number
  new_bundles_today: number
}

export interface CoreData {
  date: string
  last_run: string
  lastChecked: string
}

export interface LiveData {
  date?: string
  last_run?: string
  lastChecked?: string
  stats?: StatsData
  changes?: { affected_bundles?: AffectedBundle[] }
  bundles?: Record<string, BundleData>
}

export interface FetchAllDataResponse {
  date: string
  last_run: string
  lastChecked: string
  stats: StatsData
  changes: Record<string, unknown>
  bundles: Record<string, BundleData>
}

export interface IconCacheData {
  [packageName: string]: string
}

export interface NameCacheData {
  [packageName: string]: string
}

export interface ReleaseCacheData {
  [repoUrl: string]: {
    releases: {
      tag: string
      body: string
      dateReleased: string
      prerelease: boolean
    }[]
  }
}
