import type { AppData, PatchDiff } from './bundles'

export type BadgeType = 'NEW BUNDLE' | 'UPDATED' | 'NEW APP' | 'UPDATED APP' | 'REMOVED APP' | 'RELEASE' | 'MAJOR UPDATE'
export type AppBadgeType = 'NEW APP' | 'UPDATED APP' | 'REMOVED APP' | 'MAJOR UPDATE'

export interface AffectedBundle {
  bundle: string
  channel: string
  badge_type: BadgeType
  version?: string
  apps?: AppData[]
  channels?: string[]
  promoted_from?: boolean
  repo_url?: string
  patches_name?: string
  extra_badges?: string[]
}

export interface ChangeEntry {
  bundle: string
  channels: string[]
  apps: AppData[]
  badge_type: string
  version?: string
  extra_badges?: string[]
}

export { PatchDiff }
