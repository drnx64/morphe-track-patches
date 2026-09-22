/**
 * Today's Updates section — collapsible, shows affected bundles from today's changes.
 * Hierarchy: NEW BUNDLE → bundles with NEW APPs → bundles with UPDATED APPs.
 * Shows version comparison tags (v1.0.1 → v1.0.2).
 * Collapse state persisted in localStorage.
 * Includes a summary peek row visible when collapsed.
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { groupAffectedBundles, resolveAppName, getAppIconUrl, renderAppIcon } from '../utils/misc.js'
import { getAuthorLink } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { CHEVRON_DOWN, VERSION_ARROW, CHEVRON_RIGHT } from '../utils/svg.js'

const HIERARCHY_ORDER = { 'NEW BUNDLE': 0, 'UPDATED': 1 }
const STORAGE_KEY = 'morphe_updates_collapsed'

export function renderTodayUpdates() {
  const section = el('section', { class: 'today-updates-section', 'aria-labelledby': 'today-heading' })

  const isCollapsed = localStorage.getItem(STORAGE_KEY) !== 'false'

  const headingRow = el('div', { class: 'today-updates-heading-row' })
  headingRow.appendChild(el('h2', { class: 'section-title', id: 'today-heading' }, ["Today's Updates"]))

  const toggleBtn = el('button', {
    class: 'today-updates-toggle',
    'aria-label': 'Toggle today\'s updates',
    'aria-expanded': String(!isCollapsed),
  })
  toggleBtn.innerHTML = `<span class="today-updates-toggle-icon">${CHEVRON_DOWN}</span>`
  headingRow.appendChild(toggleBtn)
  section.appendChild(headingRow)

  const body = el('div', { class: 'today-updates-body' })

  const changes = store.get('changes')
  const affectedBundles = changes?.affected_bundles

  const grouped = affectedBundles && affectedBundles.length > 0 ? groupAffectedBundles(affectedBundles) : {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  // Summary peek row — visible when collapsed, hidden when expanded
  const summaryEl = el('div', { class: 'today-updates-summary', 'aria-hidden': 'true' })
  if (affectedBundles && affectedBundles.length > 0) {
    const entries = Object.values(grouped)
    const newBundleCount = entries.filter((e) => e.badge_type === 'NEW BUNDLE').length
    const updatedBundleCount = entries.filter((e) => e.badge_type !== 'NEW BUNDLE').length
    const totalApps = entries.reduce((sum, e) => sum + (e.apps?.length || 0), 0)

    const parts = []
    if (newBundleCount > 0) parts.push(`${newBundleCount} new bundle${newBundleCount !== 1 ? 's' : ''}`)
    if (updatedBundleCount > 0) parts.push(`${updatedBundleCount} updated`)
    if (totalApps > 0) parts.push(`${totalApps} app${totalApps !== 1 ? 's' : ''}`)

    const summaryLeft = el('div', { class: 'today-updates-summary-left' })
    summaryLeft.innerHTML = `<span class="today-updates-summary-text">${parts.join(' &middot; ')}</span>`

    const summaryRight = el('div', { class: 'today-updates-summary-right' })
    const totalCount = newBundleCount + updatedBundleCount
    summaryRight.innerHTML = `<span class="today-updates-summary-count">${totalCount}</span><span class="today-updates-summary-chevron">${CHEVRON_DOWN}</span>`

    summaryEl.appendChild(summaryLeft)
    summaryEl.appendChild(summaryRight)
  } else {
    summaryEl.innerHTML = '<span class="today-updates-summary-text today-updates-summary-text--empty">No updates detected yet today.</span>'
  }
  section.appendChild(summaryEl)
  summaryEl.addEventListener('click', () => {
    if (section.classList.contains('collapsed')) {
      toggleBtn.click()
    }
  })

  if (!affectedBundles || affectedBundles.length === 0) {
    applyCollapsed(section, body, summaryEl, isCollapsed)
    setupToggle(section, body, summaryEl, toggleBtn)
    return section
  }

  const sortedEntries = Object.entries(grouped).sort(([, a], [, b]) => {
    const aPriority = HIERARCHY_ORDER[a.badge_type] ?? 99
    const bPriority = HIERARCHY_ORDER[b.badge_type] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority

    const aNewApps = a.apps.some((app) => app.badge_type === 'NEW APP')
    const bNewApps = b.apps.some((app) => app.badge_type === 'NEW APP')
    if (aNewApps && !bNewApps) return -1
    if (!aNewApps && bNewApps) return 1

    return 0
  })

  function buildBundleEl(bundleName, entry) {
    const bundleEl = el('div', { class: 'today-bundle-entry' })

    const headerParts = [
      el('span', { class: `badge badge--${(entry.badge_type || 'updated').toLowerCase().replace(/\s+/g, '-')}` }, [entry.badge_type || 'UPDATED']),
      el('span', { class: 'today-bundle-name' }, [entry.patches_name || bundleName]),
      el('span', { class: 'bundle-author', dangerouslySetInnerHTML: getAuthorLink(entry.repo_url) }),
    ]

    if (entry.previous_version && entry.new_version && entry.previous_version !== entry.new_version) {
      headerParts.push(el('span', { class: 'today-version-tag' }, [
        `v${entry.previous_version}`,
        el('span', { class: 'today-version-arrow', dangerouslySetInnerHTML: VERSION_ARROW }),
        `v${entry.new_version}`,
      ]))
    } else if (entry.new_version) {
      headerParts.push(el('span', { class: 'today-version-tag' }, [`v${entry.new_version}`]))
    }

    if (entry.extra_badges?.includes('VERSION BUMP')) {
      headerParts.push(el('span', { class: 'badge badge--version-bump' }, ['VERSION BUMP']))
    }

    const header = el('div', { class: 'today-bundle-header' }, headerParts)
    bundleEl.appendChild(header)

    for (const app of entry.apps || []) {
      if (app.badge_type === 'REMOVED APP') continue

      const appEl = el('div', { class: 'today-app-entry' })

      const iconHtml = renderAppIcon(app, iconCache, 'sm')

      const badgeClass = app.badge_type ? `badge--${app.badge_type.toLowerCase().replace(/\s+/g, '-')}` : ''
      const badgeHtml = app.badge_type ? `<span class="badge ${badgeClass}">${escHtml(app.badge_type)}</span>` : ''

      const appName = resolveAppName(app, nameCache)
      let versionHtml = ''
      if (app.previous_version && app.new_version && app.previous_version !== app.new_version) {
        versionHtml = `<span class="today-app-version-diff">v${escHtml(app.previous_version)} ${VERSION_ARROW} v${escHtml(app.new_version)}</span>`
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

    return bundleEl
  }

  // Split into left (new bundles + updated with new apps) and right (updated with only updated apps)
  const leftEntries = []
  const rightEntries = []

  for (const [bundleName, entry] of sortedEntries) {
    const isNewBundle = entry.badge_type === 'NEW BUNDLE'
    const hasNewApps = entry.apps?.some((app) => app.badge_type === 'NEW APP')
    if (isNewBundle || hasNewApps) {
      leftEntries.push([bundleName, entry])
    } else {
      rightEntries.push([bundleName, entry])
    }
  }

  if (rightEntries.length > 0 && leftEntries.length > 0) {
    const leftCol = el('div', { class: 'today-column today-column--left' })
    const rightCol = el('div', { class: 'today-column today-column--right' })

    for (const [bName, bEntry] of leftEntries) {
      leftCol.appendChild(buildBundleEl(bName, bEntry))
    }
    for (const [bName, bEntry] of rightEntries) {
      rightCol.appendChild(buildBundleEl(bName, bEntry))
    }

    body.appendChild(leftCol)
    body.appendChild(rightCol)
  } else {
    for (const [bName, bEntry] of sortedEntries) {
      body.appendChild(buildBundleEl(bName, bEntry))
    }
  }

  section.appendChild(body)
  applyCollapsed(section, body, summaryEl, isCollapsed)
  setupToggle(section, body, summaryEl, toggleBtn)

  return section
}

function applyCollapsed(section, body, summaryEl, isCollapsed) {
  if (isCollapsed) {
    section.classList.add('collapsed')
    body.style.maxHeight = '0'
    body.style.overflow = 'hidden'
    summaryEl.classList.remove('today-updates-summary--hidden')
    summaryEl.style.maxHeight = summaryEl.scrollHeight + 'px'
    summaryEl.style.overflow = ''
  } else {
    section.classList.remove('collapsed')
    body.style.maxHeight = ''
    body.style.overflow = ''
    summaryEl.classList.add('today-updates-summary--hidden')
  }
}

function setupToggle(section, body, summaryEl, toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const isNowCollapsed = section.classList.toggle('collapsed')
    localStorage.setItem(STORAGE_KEY, String(isNowCollapsed))
    toggleBtn.setAttribute('aria-expanded', String(!isNowCollapsed))

    if (isNowCollapsed) {
      // Collapse body
      body.style.maxHeight = body.scrollHeight + 'px'
      requestAnimationFrame(() => {
        body.style.maxHeight = '0'
        body.style.overflow = 'hidden'
      })
      // Show summary
      summaryEl.classList.remove('today-updates-summary--hidden')
      summaryEl.style.maxHeight = summaryEl.scrollHeight + 'px'
      summaryEl.style.overflow = ''
    } else {
      // Expand body
      body.style.maxHeight = body.scrollHeight + 'px'
      body.style.overflow = ''
      setTimeout(() => {
        body.style.maxHeight = ''
      }, 300)
      // Hide summary
      summaryEl.classList.add('today-updates-summary--hidden')
    }
  })
}
