/**
 * Bundle card — expand/collapse, repo link, badges.
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, getStaleness, getStoredVersions } from '../utils/misc.js'
import { getRepoInfo, getAddMorpheUrl, getAuthorLink } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON } from '../utils/svg.js'

export function renderBundleCard(bundle) {
  const nameCache = store.get('nameCache') || {}
  const allBundles = store.get('bundles') || {}
  const viewMode = store.get('viewMode') || 'grid'

  const repoInfo = getRepoInfo(bundle.repo_url)
  const addMorpheUrl = getAddMorpheUrl(bundle.repo_url)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const apps = [...(bundle.apps || [])].sort((x, y) =>
    resolveAppName(x, nameCache).localeCompare(resolveAppName(y, nameCache)),
  )
  const count = apps.length
  const appsWord = count === 1 ? 'app' : 'apps'

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
  const releaseDate = allBundles[stableKey]?.release_date || allBundles[devKey]?.release_date || ''
  const staleness = getStaleness(releaseDate)
  const stalenessHtml = staleness
    ? `<span class="staleness-badge staleness--${staleness.level}" title="Released ${releaseDate}">${staleness.label}</span>`
    : ''

  const channelBadges = bundle.channels.map((ch) =>
    `<span class="channel-badge ${ch}">${ch}</span>`
  ).join('')

  const avatarUrl = bundle.avatarUrl || ''

  const card = el('div', {
    class: `bundle-card${viewMode === 'list' ? ' compact' : ''}`,
    'data-bundle-name': bundle.bundle,
    role: 'button',
    tabindex: '0',
  })

  card.innerHTML = `
    <div class="bundle-card-image-area">
      ${avatarUrl
        ? `<img class="bundle-card-avatar" src="${escHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('no-image')">`
        : ''
      }
      <div class="bundle-card-avatar-placeholder">
        <span>${(bundle.patches_name || bundle.bundle).charAt(0).toUpperCase()}</span>
      </div>
      <div class="bundle-card-image-overlay"></div>
      <div class="bundle-card-badges-overlay">
        ${updatedBadge}
        <span class="bundle-card-app-count">${count} ${appsWord}</span>
      </div>
      ${stalenessHtml ? `<span class="bundle-card-staleness-overlay staleness--${staleness.level}">${staleness.label}</span>` : ''}
    </div>
    <div class="bundle-card-content">
      <div class="bundle-card-title-group">
        <div class="bundle-card-title-row">
          <span class="bundle-name-title" title="${escHtml(bundle.patches_name || bundle.bundle)}">${escHtml(bundle.patches_name || bundle.bundle)}</span>
        </div>
        <span class="bundle-author">${getAuthorLink(bundle.repo_url)}</span>
        <div class="bundle-card-meta-row">
          <div class="channel-badges-group">${channelBadges}</div>
          ${versionTag}
          ${starsHtml}
          ${archivedHtml}
          ${preReleaseHtml}
        </div>
      </div>
      <div class="bundle-card-actions">
        <div class="icon-actions">
          <a href="${escHtml(bundle.repo_url)}" class="github-repo-icon-link" target="_blank" rel="noopener" title="View Source Repository" onclick="event.stopPropagation()">${iconSvg}</a>
          <button class="history-btn" data-bundle="${escHtml(bundle.bundle)}" title="View changelog history" onclick="event.stopPropagation()">${HISTORY_ICON}</button>
        </div>
        <a href="${escHtml(addMorpheUrl)}" class="add-morphe-btn" target="_blank" rel="noopener" onclick="event.stopPropagation()">Add to Morphe</a>
      </div>
    </div>
  `

  card.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('open-bundle', {
      detail: { bundleName: bundle.bundle, channels: bundle.channels },
    }))
  })
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('open-bundle', {
        detail: { bundleName: bundle.bundle, channels: bundle.channels },
      }))
    }
  })

  const historyBtn = card.querySelector('.history-btn')
  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('open-bundle-history', { detail: { bundleName: bundle.bundle } }))
  })

  return card
}
