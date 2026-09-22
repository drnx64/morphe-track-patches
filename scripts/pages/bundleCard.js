/**
 * Bundle card — expand/collapse, repo link, badges.
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, getAppIconUrl, getStaleness, getStoredVersions, setStoredVersion, renderAppIcon } from '../utils/misc.js'
import { getRepoInfo, getAddMorpheUrl, getAuthorLink } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { GITHUB_SVG, GITLAB_SVG, HISTORY_ICON, ARROW_ICON } from '../utils/svg.js'

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

  // Badges
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
    ? `<span class="bundle-version-tag">${escHtml(bundle.bundle)}</span>`
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

  // Channel badges
  const channelBadges = bundle.channels.map((ch) =>
    `<span class="channel-badge ${ch}">${ch}</span>`
  ).join('')

  const card = el('div', {
    class: `bundle-card${viewMode === 'list' ? ' compact' : ''}`,
    'data-bundle-name': bundle.bundle,
    role: 'button',
    tabindex: '0',
  })

  card.innerHTML = `
    <div class="bundle-card-header">
      <div class="bundle-title-group">
        <div class="bundle-title-row">
          ${updatedBadge}
          <span class="bundle-name-title" title="${escHtml(bundle.patches_name || bundle.bundle)}">${escHtml(bundle.patches_name || bundle.bundle)}</span>
          <span class="bundle-author">${getAuthorLink(bundle.repo_url)}</span>
        </div>
        <div class="channel-badges-group">${channelBadges}</div>
        ${versionTag}${starsHtml}${archivedHtml}${preReleaseHtml}${stalenessHtml}
      </div>
    </div>
    <div class="apps-summary">${count} compatible ${appsWord}</div>
    <div class="app-mini-cards" data-drawer style="display:none"></div>
    <div class="bundle-card-actions">
      <div class="icon-actions">
        <a href="${escHtml(bundle.repo_url)}" class="github-repo-icon-link" target="_blank" rel="noopener" title="View Source Repository" onclick="event.stopPropagation()">${iconSvg}</a>
        <button class="history-btn" data-bundle="${escHtml(bundle.bundle)}" title="View changelog history" onclick="event.stopPropagation()">${HISTORY_ICON}</button>
      </div>
      <a href="${escHtml(addMorpheUrl)}" class="add-morphe-btn" target="_blank" rel="noopener" onclick="event.stopPropagation()">Add to Morphe</a>
    </div>
  `

  // Click handler — expand/collapse
  card.addEventListener('click', () => {
    if (viewMode === 'list') {
      window.location.hash = `#/bundle/${encodeURIComponent(bundle.bundle)}`
      return
    }
    const drawer = card.querySelector('[data-drawer]')
    const isExpanded = card.classList.contains('expanded')
    card.classList.toggle('expanded')
    drawer.classList.toggle('expanded')
    if (!isExpanded) {
      drawer.replaceChildren()
      if (apps.length === 0) {
        drawer.appendChild(el('div', { class: 'no-apps-msg' }, ['No app info available.']))
      } else {
        for (const app of apps) {
          drawer.appendChild(renderAppMiniCard(app, bundle.bundle, bundle.channels))
        }
      }
      if (bundle.version) setStoredVersion(bundle.bundle, bundle.version)
    }
  })

  // History button
  const historyBtn = card.querySelector('.history-btn')
  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('open-bundle-history', { detail: { bundleName: bundle.bundle } }))
  })

  return card
}

function renderAppMiniCard(app, bundleName, bundleChannels) {
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}
  const allBundles = store.get('bundles') || {}

  const isPre = (() => {
    const stableKey = `${bundleName}:stable`
    const devKey = `${bundleName}:dev`
    const inStable = allBundles[stableKey]?.apps?.some((a) => a.package === app.package)
    const inDev = allBundles[devKey]?.apps?.some((a) => a.package === app.package)
    return !!inDev && !inStable
  })()

  const patchList = app.patches || []
  const patchCount = patchList.length

  const allVersions = new Set()
  for (const p of patchList) {
    if (p.compatible_versions) {
      for (const v of p.compatible_versions) allVersions.add(v)
    }
  }
  const versionArr = [...allVersions].sort()

  const card = el('div', {
    class: 'app-mini-card',
    role: 'button',
    tabindex: '0',
    'aria-label': `View patches for ${resolveAppName(app, nameCache)}`,
  })

  const iconHtml = renderAppIcon(app, iconCache)

  const versionsHtml = versionArr.length === 0
    ? '<span class="version-chip version-chip--any">Any version</span>'
    : versionArr.slice(0, 3).map((v) => `<span class="version-chip">${escHtml(v)}</span>`).join('') +
      (versionArr.length > 3 ? `<span class="version-chip version-chip--any">+${versionArr.length - 3}</span>` : '')

  card.innerHTML = `
    <div class="app-mini-card-main">
      ${iconHtml}
      <div class="app-mini-card-info">
        ${isPre ? '<span class="badge badge--pre-release">Pre-Release</span>' : ''}
        <span class="app-mini-name">${escHtml(resolveAppName(app, nameCache))}</span>
        <span class="app-mini-pkg">${escHtml(app.package)}</span>
      </div>
      <div class="app-mini-stats">
        <span class="app-mini-patch-count">${patchCount} patch${patchCount !== 1 ? 'es' : ''}</span>
        <span class="app-mini-arrow">${ARROW_ICON}</span>
      </div>
    </div>
    <div class="app-mini-versions">${versionsHtml}</div>
  `

  const handleClick = (e) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('open-app', {
      detail: { app, bundleName, channels: bundleChannels },
    }))
  }
  card.addEventListener('click', handleClick)
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick(e)
    }
  })

  return card
}
