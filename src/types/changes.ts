import type { AppData, PatchDiff } from './bundles'

export type BadgeType = 'NEW BUNDLE' | 'UPDATED' | 'NEW APP' | 'UPDATED APP' | 'REMOVED APP' | 'RELEASE'

export interface AffectedBundle {
  bundle: string
  channel: string
  badge_type: BadgeType
  version?: string
  apps?: AppData[]
  channels?: string[]
  promoted_from?: boolean
}

export interface ChangeEntry {
  bundle: string
  channels: string[]
  apps: AppData[]
  badge_type: string
  version?: string
}

export { PatchDiff }
