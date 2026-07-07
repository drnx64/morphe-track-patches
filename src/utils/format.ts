export function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export function padNum(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '-'
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const monthIndex = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${months[monthIndex]} ${day}, ${parts[0]}`
    }
  }
  return dateStr
}

export function formatTime(isoStr: string): string {
  if (!isoStr) return '-'
  try {
    const d = new Date(isoStr)
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    }).format(d)
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d)
    return `${date} at ${time}`
  } catch {
    return isoStr
  }
}

export function getTimeAgo(isoStr: string): string {
  if (!isoStr) return '-'
  try {
    const then = new Date(isoStr)
    const now = new Date()
    const diffMs = now.getTime() - then.getTime()
    if (diffMs < 0) return 'just now'
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHrs = Math.floor(diffMin / 60)
    const remainMin = diffMin % 60
    if (diffHrs < 24) return `${diffHrs}h ${remainMin}m ago`
    const diffDays = Math.floor(diffHrs / 24)
    return `${diffDays}d ago`
  } catch {
    return '-'
  }
}
