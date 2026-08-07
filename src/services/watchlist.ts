const KEY = 'morphe_watchlist'

export function getWatchlist(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isWatched(pkg: string): boolean {
  return getWatchlist().includes(pkg)
}

export function toggleWatched(pkg: string): boolean {
  const list = getWatchlist()
  const idx = list.indexOf(pkg)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(pkg)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  return list.includes(pkg)
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function ensureNotificationPermission(): void {
  if (!isNotificationSupported()) return
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

interface NotifyApp {
  package: string
  badge_type?: string
  name?: string
}

interface NotifyChanges {
  affected_bundles?: { apps?: NotifyApp[] }[]
}

export function notifyWatchedUpdates(changes: NotifyChanges | null): void {
  if (!changes?.affected_bundles?.length) return
  if (!isNotificationSupported() || Notification.permission !== 'granted') return
  const watched = new Set(getWatchlist())
  if (watched.size === 0) return
  const updated: string[] = []
  for (const bundle of changes.affected_bundles) {
    for (const app of bundle.apps || []) {
      if (
        watched.has(app.package) &&
        (app.badge_type === 'NEW APP' || app.badge_type === 'UPDATED APP')
      ) {
        updated.push(app.name || app.package)
      }
    }
  }
  if (updated.length === 0) return
  try {
    new Notification('Morphe Patch Tracker', {
      body: `${updated.length} watched app${updated.length !== 1 ? 's' : ''} updated: ${updated.slice(0, 3).join(', ')}${updated.length > 3 ? '…' : ''}`,
      tag: 'morphe-watch-updates',
    })
  } catch {
    /* ignore */
  }
}