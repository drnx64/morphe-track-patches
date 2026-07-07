export interface RepoInfo {
  isGitLab: boolean
  path: string
}

export const APP_VERSION = '4'
export const APP_VERSION_KEY = 'morphe_app_version'

export const CACHE_KEYS = {
  LIVE: 'live',
  CHANGELOG: 'changelog',
  RELEASE_CACHE: 'release_cache',
  ICONS: 'icons',
  NAMES: 'names',
} as const

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS]
