/**
 * BundleHistoryModal — shows version history for a bundle from changelog.json.
 */
import { el } from '../ui.js'
import { openModal } from './modal.js'
import * as store from '../store.js'
import { escHtml } from '../utils/html.js'

/**
 * Open the bundle history modal.
 * @param {string} bundleName
 */
export function openBundleHistoryModal(bundleName) {
  if (!bundleName) return

  const changelog = store.get('changelog') || []
  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}

  // Get bundle display info
  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const bundleData = bundles[stableKey] || bundles[devKey]
  const displayName = bundleData?.patches_name || bundleName

  // Filter changelog entries that include this bundle
  const entries = []
  for (const day of changelog) {
    if (!day.affected_bundles) continue
    const matching = day.affected_bundles.filter((b) => b.bundle === bundleName)
    if (matching.length > 0) {
      entries.push({
        date: day.date,
        lastChecked: day.lastChecked,
        bundles: matching,
      })
    }
  }

  // Sort by date descending
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const content = el('div', { class: 'bundle-history-content' })

  if (entries.length === 0) {
    content.innerHTML = `<div class="empty-state">No version history available for ${escHtml(displayName)}.</div>`
  } else {
    // Version badge
    if (bundleData?.version) {
      const versionBanner = el('div', { class: 'bundle-history-current' }, [
        el('span', { class: 'bundle-history-label' }, ['Current version']),
        el('span', { class: 'bundle-history-version' }, [`v${bundleData.version}`]),
      ])
      content.appendChild(versionBanner)
    }

    // Timeline
    const timeline = el('div', { class: 'bundle-history-timeline' })

    for (const entry of entries) {
      const dayEl = el('div', { class: 'bundle-history-day' })

      // Date header
      const dateObj = entry.date ? new Date(entry.date + 'T00:00:00Z') : null
      const dateStr = dateObj
        ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : 'Unknown date'

      const dayHeader = el('div', { class: 'bundle-history-day-header' }, [
        el('span', { class: 'bundle-history-date' }, [dateStr]),
      ])

      if (entry.lastChecked) {
        const checkedDate = new Date(entry.lastChecked)
        const timeStr = checkedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
        dayHeader.appendChild(el('span', { class: 'bundle-history-time' }, [timeStr + ' UTC']))
      }

      dayEl.appendChild(dayHeader)

      // Affected bundles for this day
      for (const affected of entry.bundles) {
        const bundleRow = el('div', { class: 'bundle-history-entry' })

        // Bundle-level badge
        const badgeType = affected.badge_type || 'UPDATED'
        const badgeClass = `badge--${badgeType.toLowerCase().replace(/\s+/g, '-')}`
        bundleRow.appendChild(el('span', { class: `badge ${badgeClass}` }, [badgeType]))

        // Channel
        if (affected.channel) {
          bundleRow.appendChild(el('span', { class: `channel-badge ${affected.channel}` }, [affected.channel]))
        }

        // Version info
        if (affected.previous_version && affected.new_version) {
          bundleRow.appendChild(el('span', { class: 'bundle-history-version-change' }, [
            `v${affected.previous_version}`,
            el('span', { class: 'bundle-history-arrow' }, [' → ']),
            `v${affected.new_version}`,
          ]))
        } else if (affected.new_version) {
          bundleRow.appendChild(el('span', { class: 'bundle-history-version-change' }, [`v${affected.new_version}`]))
        }

        // Apps
        if (affected.apps?.length > 0) {
          const appsList = el('div', { class: 'bundle-history-apps' })
          for (const app of affected.apps) {
            const appBadge = app.badge_type
              ? `<span class="badge badge--${app.badge_type.toLowerCase().replace(/\s+/g, '-')}">${escHtml(app.badge_type)}</span>`
              : ''
            const appRow = el('div', { class: 'bundle-history-app' })
            appRow.innerHTML = `${appBadge} <span>${escHtml(app.app_name || app.package)}</span>`
            appsList.appendChild(appRow)
          }
          bundleRow.appendChild(appsList)
        }

        dayEl.appendChild(bundleRow)
      }

      timeline.appendChild(dayEl)
    }

    content.appendChild(timeline)
  }

  openModal({
    title: `${displayName} — History`,
    content,
    className: 'bundle-history-modal',
    maxWidth: 600,
  })
}
