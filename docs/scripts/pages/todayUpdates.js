/**
 * Today's Updates section — shows affected bundles from today's changes.
 * Hierarchy: NEW BUNDLE → bundles with NEW APPs → bundles with UPDATED APPs.
 * Shows version comparison tags (v1.0.1 → v1.0.2).
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { groupAffectedBundles, resolveAppName, getAppIconUrl, renderAppIcon } from '../utils/misc.js'
import { getAuthorLink } from '../utils/url.js'
import { escHtml } from '../utils/html.js'

const HIERARCHY_ORDER = { 'NEW BUNDLE': 0, 'UPDATED': 1 }

export function renderTodayUpdates() {
  const section = el('section', { class: 'today-updates-section', 'aria-labelledby': 'today-heading' })
  section.appendChild(el('h2', { class: 'section-title', id: 'today-heading' }, ["Today's Updates"]))

  const changes = store.get('changes')
  const affectedBundles = changes?.affected_bundles

  if (!affectedBundles || affectedBundles.length === 0) {
    section.appendChild(el('div', { class: 'empty-state' }, ['No updates detected yet today.']))
    return section
  }

  const grouped = groupAffectedBundles(affectedBundles)
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  // Sort entries by hierarchy
  const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => {
    const aPriority = HIERARCHY_ORDER[a.badge_type] ?? 99
    const bPriority = HIERARCHY_ORDER[b.badge_type] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority

    // Within same tier, sort by whether they have NEW APPs
    const aNewApps = a.apps.some((app) => app.badge_type === 'NEW APP')
    const bNewApps = b.apps.some((app) => app.badge_type === 'NEW APP')
    if (aNewApps && !bNewApps) return -1
    if (!aNewApps && bNewApps) return 1

    return 0
  })

  for (const [bundleName, entry] of sortedEntries) {
    const bundleEl = el('div', { class: 'today-bundle-entry' })

    // Bundle header with badge + version tag
    const headerParts = [
      el('span', { class: `badge badge--${(entry.badge_type || 'updated').toLowerCase().replace(/\s+/g, '-')}` }, [entry.badge_type || 'UPDATED']),
      el('span', { class: 'today-bundle-name' }, [entry.patches_name || bundleName]),
      el('span', { class: 'bundle-author', dangerouslySetInnerHTML: getAuthorLink(entry.repo_url) }),
    ]

    // Version comparison tag (from pipeline: previous_version / new_version)
    if (entry.previous_version && entry.new_version && entry.previous_version !== entry.new_version) {
      headerParts.push(el('span', { class: 'today-version-tag' }, [
        `v${entry.previous_version}`,
        el('span', { class: 'today-version-arrow' }, [' → ']),
        `v${entry.new_version}`,
      ]))
    } else if (entry.new_version) {
      headerParts.push(el('span', { class: 'today-version-tag' }, [`v${entry.new_version}`]))
    }

    // Version bump badge
    if (entry.extra_badges?.includes('VERSION BUMP')) {
      headerParts.push(el('span', { class: 'badge badge--version-bump' }, ['VERSION BUMP']))
    }

    const header = el('div', { class: 'today-bundle-header' }, headerParts)
    bundleEl.appendChild(header)

    for (const app of entry.apps || []) {
      const appEl = el('div', { class: 'today-app-entry' })

      const iconHtml = renderAppIcon(app, iconCache, 'sm')

      const badgeClass = app.badge_type ? `badge--${app.badge_type.toLowerCase().replace(/\s+/g, '-')}` : ''
      const badgeHtml = app.badge_type ? `<span class="badge ${badgeClass}">${escHtml(app.badge_type)}</span>` : ''

      // App name + version diff
      const appName = resolveAppName(app, nameCache)
      let versionHtml = ''
      if (app.previous_version && app.new_version && app.previous_version !== app.new_version) {
        versionHtml = `<span class="today-app-version-diff">v${escHtml(app.previous_version)} → v${escHtml(app.new_version)}</span>`
      } else if (app.new_version) {
        versionHtml = `<span class="today-app-version-diff">v${escHtml(app.new_version)}</span>`
      }

      appEl.innerHTML = `
        <div class="today-app-main">
          ${badgeHtml}
          ${iconHtml}
          <span class="today-app-name">${escHtml(appName)}</span>
          ${versionHtml}
        </div>
      `

      // Click to open app detail
      appEl.style.cursor = 'pointer'
      appEl.setAttribute('role', 'button')
      appEl.setAttribute('tabindex', '0')
      appEl.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('open-app', {
          detail: { app, bundleName, channels: entry.channels },
        }))
      })
      appEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('open-app', {
            detail: { app, bundleName, channels: entry.channels },
          }))
        }
      })

      bundleEl.appendChild(appEl)
    }

    section.appendChild(bundleEl)
  }

  return section
}
