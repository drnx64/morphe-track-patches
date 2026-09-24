/**
 * Miscellaneous utilities — version comparison, bundle grouping, sorting, etc.
 */
import { escHtml } from './html.js'
import { resolveAvatarUrl } from './url.js'
import { getCachedAvatarDataUrl } from '../services/iconCache.js'

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = i < pa.length ? pa[i] : 0
    const nb = i < pb.length ? pb[i] : 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

export function isAppPreRelease(bundleName, pkgName, bundlesData) {
  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const inStable = bundlesData[stableKey]?.apps?.some((a) => a.package === pkgName)
  const inDev = bundlesData[devKey]?.apps?.some((a) => a.package === pkgName)
  return !!inDev && !inStable
}

export function groupAffectedBundles(affectedBundles) {
  const appPrecedence = { 'NEW APP': 0, 'MAJOR UPDATE': 1, 'UPDATED APP': 2, 'REMOVED APP': 3 }
  const grouped = {}

  for (const b of affectedBundles) {
    const bName = b.bundle
    if (!grouped[bName]) {
      grouped[bName] = { bundle: bName, channels: [], apps: [], badge_type: b.badge_type, version: b.version || '', repo_url: b.repo_url || '', patches_name: b.patches_name || '', extra_badges: b.extra_badges || [], previous_version: b.previous_version || '', new_version: b.new_version || '', avatarUrl: getDisplayAvatar(b.repo_url || '', b.avatarUrl || '') }
    }
    if (!grouped[bName].channels.includes(b.channel)) {
      grouped[bName].channels.push(b.channel)
    }
    if (b.extra_badges) {
      for (const eb of b.extra_badges) {
        if (!grouped[bName].extra_badges.includes(eb)) {
          grouped[bName].extra_badges.push(eb)
        }
      }
    }
    for (const app of b.apps || []) {
      const existing = grouped[bName].apps.find((a) => a.package === app.package)
      if (!existing) {
        grouped[bName].apps.push({ ...app, scan_numbers: app.scan_numbers ? [...app.scan_numbers] : [] })
      } else {
        if ((appPrecedence[app.badge_type] ?? 99) < (appPrecedence[existing.badge_type] ?? 99)) {
          existing.badge_type = app.badge_type
        }
        if (app.patch_diff) {
          existing.patch_diff = app.patch_diff
        }
        if (app.scan_numbers) {
          for (const sn of app.scan_numbers) {
            if (!existing.scan_numbers?.includes(sn)) {
              if (!existing.scan_numbers) existing.scan_numbers = []
              existing.scan_numbers.push(sn)
            }
          }
        }
      }
    }
    if (b.badge_type === 'NEW BUNDLE') {
      grouped[bName].badge_type = 'NEW BUNDLE'
    } else if (b.badge_type === 'REMOVED BUNDLE' && grouped[bName].badge_type === 'REMOVED BUNDLE') {
      // all channels removed — keep as removed
    } else if (b.badge_type === 'REMOVED BUNDLE') {
      // mixed: some channel removed, another active — don't override active badge
    } else if (grouped[bName].badge_type === 'REMOVED BUNDLE') {
      // active channel update overrides removed badge
      grouped[bName].badge_type = b.badge_type
    }
  }

  return grouped
}

export function getNextScanTime() {
  const now = new Date()
  const utcHour = now.getUTCHours()
  const slot = Math.floor(utcHour / 3) * 3
  let nextHour = slot + 3
  if (now.getUTCMinutes() < 1 && utcHour === slot) {
    nextHour = slot
  }
  const next = new Date(now)
  if (nextHour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 1, 0, 0)
  } else {
    next.setUTCHours(nextHour, 1, 0, 0)
  }
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 1, 0, 0)
  }
  return next
}

export function getScanBatch() {
  return Math.floor(new Date().getUTCHours() / 3) + 1
}

export function sortBundleNames(list) {
  const orderList = ['morphe', 'piko', 'rookieenough', 'hoo-dles', 'paresh-maheshwari', 'brosssh', 'patcheddit']
  return [...list].sort((a, b) => {
    const aIndex = orderList.indexOf(a.bundle)
    const bIndex = orderList.indexOf(b.bundle)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    const aStars = a.stars ?? 0
    const bStars = b.stars ?? 0
    if (bStars !== aStars) return bStars - aStars
    const aCount = a.apps?.length ?? 0
    const bCount = b.apps?.length ?? 0
    if (bCount !== aCount) return bCount - aCount
    return a.bundle.localeCompare(b.bundle)
  })
}

export function resolveAppName(app, nameCache) {
  const n = nameCache[app.package]
  if (typeof n === 'string' && n) return n
  return app.app_name
}

export function scoreAppSearch(query, name, pkg) {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const n = name.toLowerCase()
  const p = pkg.toLowerCase()
  let score = 0
  if (n === q || p === q) score += 1000
  if (n.startsWith(q)) score += 800
  if (p.startsWith(q)) score += 700
  if (n.split(/[\s.\-]+/).some((w) => w.startsWith(q))) score += 450
  if (p.split(/[\s.\-]+/).some((w) => w.startsWith(q))) score += 350
  if (n.includes(q)) score += 250
  if (p.includes(q)) score += 150
  return score
}

export function getAppIconUrl(app, iconCache) {
  if (!app) return ''
  const fromCache = app.package ? iconCache[app.package] : ''
  return fromCache && typeof fromCache === 'string' ? fromCache : ''
}

/**
 * Avatar URL for display: repo_cache map → bundle field → IndexedDB data URL.
 * Prefers warm base64/WebP cache; falls back to remote URL.
 * @param {string} repoUrl
 * @param {string} [fallback]
 * @returns {string}
 */
export function getDisplayAvatar(repoUrl, fallback = '') {
  const url = resolveAvatarUrl(repoUrl, fallback)
  if (!url) return ''
  return getCachedAvatarDataUrl(url) || url
}

export function renderAppIcon(app, iconCache, size = 'default') {
  const iconUrl = getAppIconUrl(app, iconCache)
  const sizeClass = size === 'sm' ? ' app-icon--sm' : ''
  if (iconUrl) {
    return `<img class="app-icon${sizeClass} app-icon--loading" src="${escHtml(iconUrl)}" alt="" loading="lazy" onload="this.classList.remove('app-icon--loading')" onerror="this.classList.remove('app-icon--loading');this.style.display='none'">`
  }
  const name = app.app_name || app.package || '?'
  return `<div class="app-icon app-icon--fallback${sizeClass}">${name.charAt(0).toUpperCase()}</div>`
}

export function levenshteinDistance(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

export function suggestFuzzy(query, appList, maxSuggestions = 3) {
  if (!query || appList.length === 0) return []
  const q = query.toLowerCase()
  const scored = appList.map((app) => {
    const name = app.name.toLowerCase()
    const pkg = app.package.toLowerCase()
    let distance = levenshteinDistance(q, name)
    if (distance > q.length) distance = levenshteinDistance(q, pkg)
    return { app, distance }
  })
  scored.sort((a, b) => a.distance - b.distance)
  const threshold = Math.max(2, Math.floor(q.length * 0.4))
  return scored
    .filter((s) => s.distance <= threshold)
    .slice(0, maxSuggestions)
    .map((s) => s.app)
}

let versionsCache = null

export function getStoredVersions() {
  if (!versionsCache) {
    try {
      versionsCache = JSON.parse(localStorage.getItem('morphe_versions') || '{}')
    } catch {
      versionsCache = {}
    }
  }
  return versionsCache
}

export function setStoredVersion(bundle, version) {
  const stored = getStoredVersions()
  if (stored[bundle] === version) return
  stored[bundle] = version
  try {
    localStorage.setItem('morphe_versions', JSON.stringify(stored))
  } catch {
    // ignore
  }
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return null
  const now = new Date()
  return Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24))
}

export function getStaleness(dateStr) {
  const d = daysSince(dateStr)
  if (d === null) return null
  if (d <= 7) return { days: d, level: 'fresh', label: `${d}d` }
  if (d <= 14) return { days: d, level: 'moderate', label: `${d}d` }
  return { days: d, level: 'stale', label: `${d}d` }
}

export function buildAppIndex(bundlesData, nameCache, iconCache) {
  const map = new Map()
  for (const key of Object.keys(bundlesData)) {
    const bundle = bundlesData[key]
    const bundleName = key.replace(/:(stable|dev)$/, '')
    const repoUrl = bundle.repo_url || `https://github.com/${bundleName}/revanced-patches`
    for (const app of bundle.apps || []) {
      let entry = map.get(app.package)
      if (!entry) {
        entry = {
          package: app.package,
          name: resolveAppName(app, nameCache),
          iconUrl: getAppIconUrl(app, iconCache),
          bundles: [],
          patchesNames: [],
        }
        map.set(app.package, entry)
      }
      if (bundle.patches_name && !entry.patchesNames.includes(bundle.patches_name)) {
        entry.patchesNames.push(bundle.patches_name)
      }
      let ref = entry.bundles.find((b) => b.bundleName === bundleName && b.repoUrl === repoUrl)
      if (!ref) {
        ref = { bundleName, repoUrl, version: '', channels: [], patchesName: bundle.patches_name }
        entry.bundles.push(ref)
      }
      if (!ref.channels.includes(bundle.channel)) ref.channels.push(bundle.channel)
      if (bundle.version && !ref.version) ref.version = bundle.version
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Copy text to clipboard and briefly flash the element.
 * @param {string} text
 * @param {HTMLElement} [el]
 */
export async function copyToClipboard(text, el) {
  try {
    await navigator.clipboard.writeText(text)
    if (el) {
      el.classList.add('copied-flash')
      setTimeout(() => el.classList.remove('copied-flash'), 600)
    }
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    if (el) {
      el.classList.add('copied-flash')
      setTimeout(() => el.classList.remove('copied-flash'), 600)
    }
  }
}

