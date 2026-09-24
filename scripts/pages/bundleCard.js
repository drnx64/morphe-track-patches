/**
 * Bundle card — horizontal row layout, expandable apps list.
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, getStaleness, getStoredVersions, renderAppIcon, getDisplayAvatar } from '../utils/misc.js'
import { getRepoInfo, getAddMorpheUrl, getAuthorLink } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON, CHEVRON_DOWN } from '../utils/svg.js'

export function renderBundleCard(bundle) {
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const repoInfo = getRepoInfo(bundle.repo_url)
  const addMorpheUrl = getAddMorpheUrl(bundle.repo_url)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const apps = [...(bundle.apps || [])].sort((x, y) =>
    resolveAppName(x, nameCache).localeCompare(resolveAppName(y, nameCache)),
  )
  const count = apps.length

  let updatedBadge = ''
  if (bundle.version) {
    const todayStr = new Date().toISOString().split('T')[0]
    const liveDataDate = store.get('liveDataDate') || ''
    if (liveDataDate === todayStr) {
      const stored = getStoredVersions()
      const prev = stored[bundle.bundle]
      if (prev && prev !== bundle.version) {
        updatedBadge = '<span class="bundle-updated-badge">Updated</span>'
      }
    }
  }

  const versionTag = bundle.version
    ? `<span class="bundle-version-tag">v${escHtml(bundle.version)}</span>`
    : ''

  const starsHtml = bundle.stars
    ? `<span class="bundle-stars-badge" title="${bundle.stars} stars">★ ${bundle.stars >= 1000 ? (bundle.stars / 1000).toFixed(1) + 'k' : bundle.stars}</span>`
    : ''

  const archivedHtml = bundle.isArchived
    ? '<span class="bundle-archived-badge" title="This repository is archived">Archived</span>'
    : ''

  const preReleaseHtml = bundle.isPreRelease
    ? '<span class="bundle-pre-release-badge" title="Pre-release version">Pre-release</span>'
    : ''

  const stableKey = `${bundle.bundle}:stable`
  const devKey = `${bundle.bundle}:dev`
  const releaseDate = store.get('bundles')?.[stableKey]?.release_date || store.get('bundles')?.[devKey]?.release_date || ''
  const staleness = getStaleness(releaseDate)
  const stalenessHtml = staleness
    ? `<span class="staleness-badge staleness--${staleness.level}" title="Released ${releaseDate}">${staleness.label}</span>`
    : ''

  const channelBadges = bundle.channels.map((ch) =>
    `<span class="channel-badge ${ch}">${ch}</span>`
  ).join('')

  const avatarUrl = getDisplayAvatar(bundle.repo_url, bundle.avatarUrl)
  const isNewBundle = bundle.badge_type === 'NEW BUNDLE'

  const card = el('div', {
    class: `bundle-card bundle-card--row${isNewBundle ? ' bundle-card--new' : ''}`,
    'data-bundle-name': bundle.bundle,
    'data-badge-type': bundle.badge_type || '',
  })

  const row = el('div', { class: 'bundle-card-row', role: 'button', tabindex: '0' })
  row.innerHTML = `
    <div class="bundle-card-avatar-area">
      ${avatarUrl
        ? `<img class="bundle-card-avatar" src="${escHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''
      }
      <div class="bundle-card-avatar-placeholder" ${avatarUrl ? 'style="display:none"' : ''}>
        <span>${(bundle.patches_name || bundle.bundle).charAt(0).toUpperCase()}</span>
      </div>
    </div>
    <div class="bundle-card-row-info">
      <div class="bundle-card-row-top">
        <span class="bundle-card-row-name" title="${escHtml(bundle.patches_name || bundle.bundle)}">${escHtml(bundle.patches_name || bundle.bundle)}</span>
        ${updatedBadge}
      </div>
      <div class="bundle-card-row-bottom">
        <span class="bundle-author">${getAuthorLink(bundle.repo_url)}</span>
        <div class="bundle-card-row-badges">
          <div class="channel-badges-group">${channelBadges}</div>
          ${versionTag}
          ${starsHtml}
          ${stalenessHtml}
        </div>
      </div>
    </div>
    <div class="bundle-card-row-meta">
      <span class="bundle-card-row-count">${count} app${count !== 1 ? 's' : ''}</span>
      <div class="bundle-card-row-actions">
        <a href="${escHtml(bundle.repo_url)}" class="bundle-card-row-icon-link" target="_blank" rel="noopener" title="View Source Repository" onclick="event.stopPropagation()">${iconSvg}</a>
        <button class="bundle-card-row-icon-link history-btn" data-bundle="${escHtml(bundle.bundle)}" title="View changelog history" onclick="event.stopPropagation()">${HISTORY_ICON}</button>
      </div>
      <span class="bundle-card-row-chevron">${CHEVRON_DOWN}</span>
    </div>
  `

  row.addEventListener('click', () => toggleExpand(card, apps, nameCache, iconCache))
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpand(card, apps, nameCache, iconCache)
    }
  })

  const historyBtn = row.querySelector('.history-btn')
  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('open-bundle-history', { detail: { bundleName: bundle.bundle } }))
  })

  card.appendChild(row)

  return card
}

function toggleExpand(card, apps, nameCache, iconCache) {
  const isExpanded = card.classList.contains('expanded')
  card.classList.toggle('expanded')

  let appsContainer = card.querySelector('.bundle-card-apps')
  if (!appsContainer) {
    appsContainer = el('div', { class: 'bundle-card-apps' })
    for (const app of apps) {
      const appName = resolveAppName(app, nameCache)
      const iconHtml = renderAppIcon(app, iconCache, 'sm')
      const patchCount = (app.patches || []).length

      const appRow = el('div', { class: 'bundle-card-app-row', role: 'button', tabindex: '0' })
      appRow.innerHTML = `
        ${iconHtml}
        <div class="bundle-card-app-info">
          <span class="bundle-card-app-name">${escHtml(appName)}</span>
          <span class="bundle-card-app-pkg">${escHtml(app.package)}</span>
        </div>
        <span class="bundle-card-app-patches">${patchCount} patch${patchCount !== 1 ? 'es' : ''}</span>
      `
      appRow.addEventListener('click', (e) => {
        e.stopPropagation()
        window.dispatchEvent(new CustomEvent('open-app', {
          detail: {
            app: { package: app.package, app_name: app.app_name, patches: app.patches },
            bundleName: '',
            channels: [],
          },
        }))
      })
      appRow.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent('open-app', {
            detail: {
              app: { package: app.package, app_name: app.app_name, patches: app.patches },
              bundleName: '',
              channels: [],
            },
          }))
        }
      })
      appsContainer.appendChild(appRow)
    }
    card.appendChild(appsContainer)
  }

  if (!isExpanded) {
    appsContainer.style.maxHeight = appsContainer.scrollHeight + 'px'
  } else {
    appsContainer.style.maxHeight = '0'
  }
}
