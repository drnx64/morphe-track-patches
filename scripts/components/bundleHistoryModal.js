/**
 * BundleHistoryModal — shows version history with bundle avatar and app icons.
 */
import { el } from '../ui.js'
import { openModal } from './modal.js'
import * as store from '../store.js'
import { renderAppIcon } from '../utils/misc.js'
import { escHtml } from '../utils/html.js'
import { VERSION_ARROW } from '../utils/svg.js'

export function openBundleHistoryModal(bundleName) {
  if (!bundleName) return

  const changelog = store.get('changelog') || []
  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const bundleData = bundles[stableKey] || bundles[devKey]
  const displayName = bundleData?.patches_name || bundleName
  const avatarUrl = bundleData?.avatarUrl || ''

  const entries = []
  for (const day of changelog) {
    if (!day.affected_bundles) continue
    const matching = day.affected_bundles.filter((b) => b.bundle === bundleName)
    if (matching.length > 0) {
      entries.push({ date: day.date, lastChecked: day.lastChecked, bundles: matching })
    }
  }
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const content = el('div', { class: 'bundle-history-content' })

  if (entries.length === 0) {
    content.innerHTML = `<div class="empty-state">No version history available for ${escHtml(displayName)}.</div>`
  } else {
    const headerRow = el('div', { class: 'bundle-history-header' })
    headerRow.innerHTML = `
      <div class="bundle-history-avatar-area">
        ${avatarUrl
          ? `<img class="bundle-history-avatar" src="${escHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''
        }
        <div class="bundle-history-avatar-placeholder" ${avatarUrl ? 'style="display:none"' : ''}>
          <span>${displayName.charAt(0).toUpperCase()}</span>
        </div>
      </div>
      <div class="bundle-history-header-info">
        <span class="bundle-history-label">History</span>
        ${bundleData?.version ? `<span class="bundle-history-version">v${bundleData.version}</span>` : ''}
      </div>
    `
    content.appendChild(headerRow)

    const timeline = el('div', { class: 'bundle-history-timeline' })
    for (const entry of entries) {
      const dayEl = el('div', { class: 'bundle-history-day' })
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

      for (const affected of entry.bundles) {
        const bundleRow = el('div', { class: 'bundle-history-entry' })
        const badgeType = affected.badge_type || 'UPDATED'
        const badgeClass = `badge--${badgeType.toLowerCase().replace(/\s+/g, '-')}`
        bundleRow.appendChild(el('span', { class: `badge ${badgeClass}` }, [badgeType]))

        if (affected.channel) {
          bundleRow.appendChild(el('span', { class: `channel-badge ${affected.channel}` }, [affected.channel]))
        }

        if (affected.previous_version && affected.new_version) {
          bundleRow.appendChild(el('span', { class: 'bundle-history-version-change' }, [
            `v${affected.previous_version}`,
            el('span', { class: 'bundle-history-arrow', dangerouslySetInnerHTML: VERSION_ARROW }),
            `v${affected.new_version}`,
          ]))
        } else if (affected.new_version) {
          bundleRow.appendChild(el('span', { class: 'bundle-history-version-change' }, [`v${affected.new_version}`]))
        }

        if (affected.apps?.length > 0) {
          const appsList = el('div', { class: 'bundle-history-apps' })
          for (const app of affected.apps) {
            const appBadge = app.badge_type
              ? `<span class="badge badge--${app.badge_type.toLowerCase().replace(/\s+/g, '-')}">${escHtml(app.badge_type)}</span>`
              : ''
            const iconHtml = renderAppIcon(app, iconCache, 'sm')
            const appRow = el('div', { class: 'bundle-history-app' })
            appRow.innerHTML = `${appBadge} ${iconHtml} <span>${escHtml(app.app_name || app.package)}</span>`
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
