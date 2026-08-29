import type { ChangelogEntry } from '../types/changelog'

const MAX_CHANGELOG_DAYS = 7

export function limitChangelogDays(entries: ChangelogEntry[]): ChangelogEntry[] {
  if (entries.length <= MAX_CHANGELOG_DAYS) return entries

  const sorted = [...entries].sort((a, b) => {
    const dateA = a.date || a.lastChecked?.split('T')[0] || ''
    const dateB = b.date || b.lastChecked?.split('T')[0] || ''
    return dateB.localeCompare(dateA)
  })

  return sorted.slice(0, MAX_CHANGELOG_DAYS)
}
