export interface PatchOption {
  key: string
  description?: string
}

export interface PatchData {
  name: string
  description?: string
  use?: boolean
  options?: PatchOption[]
  compatible_versions?: string[]
  isDevOnly?: boolean
  isNew?: boolean
}

export interface AppData {
  app_name: string
  package: string
  icon_url?: string
  patches: PatchData[]
  badge_type?: AppBadgeType
  scan_numbers?: number[]
  patch_diff?: PatchDiff
  summary?: string
  promoted_from?: boolean
}

export type AppBadgeType = 'NEW APP' | 'UPDATED APP' | 'REMOVED APP'

export interface BundleData {
  bundle: string
  channel: 'stable' | 'dev'
  key?: string
  repo_url: string
  version: string
  release_tag?: string
  release_date?: string
  release_notes?: string
  created_at?: string
  apps: AppData[]
  fingerprint?: string
}

export interface BundleEntry {
  bundle: string
  channels: string[]
  repo_url: string
  version: string
  created_at?: string
  apps: AppData[]
  badge_type?: string
}

export interface PatchDiff {
  patches_added: (string | { name: string; description?: string })[]
  patches_removed: (string | { name: string })[]
  patches_modified: (string | { name: string; description?: string; changes?: string[] })[]
}
