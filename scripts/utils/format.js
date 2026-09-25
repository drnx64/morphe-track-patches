/**
 * Date formatting and time utilities.
 */

export function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export function padNum(n) {
  return n < 10 ? '0' + n : '' + n
}

export function formatFriendlyDate(dateStr) {
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

/**
 * Normalize a version string to exactly one leading "v".
 * Handles raw data that sometimes includes "v" already (e.g. "v1.24.2" vs "1.24.2").
 * @param {string} v
 * @returns {string} '' if empty, otherwise 'v...' form
 */
export function formatVersion(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (!s) return ''
  return 'v' + s.replace(/^v+/i, '')
}

export function formatTime(isoStr) {
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

export function getTimeAgo(isoStr) {
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
