import type { AffectedBundle } from './changes'

export interface ChangelogEntry {
  date: string
  lastChecked: string
  affected_bundles: AffectedBundle[]
}

export interface DayEntry {
  date: string
  bundles: AffectedBundle[]
}
