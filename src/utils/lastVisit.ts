const KEY = 'morphe_last_visit'

export function getLastVisitDate(): string {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function markVisitNow(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
}

export function isNewSinceLastVisit(date: string): boolean {
  const lastVisit = getLastVisitDate()
  if (!lastVisit || !date) return false
  return date > lastVisit
}

export function isNewScan(lastChecked: string, lastVisitScan: string): boolean {
  if (!lastChecked || !lastVisitScan) return false
  return lastChecked > lastVisitScan
}
