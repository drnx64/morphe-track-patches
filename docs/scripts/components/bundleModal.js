/**
 * BundleModal — shows bundle details: apps list, description, metadata.
 * Triggered by clicking a bundle card.
 */
import { el } from '../ui.js'
import { openModal } from './modal.js'
import * as store from '../store.js'
import { resolveAppName, renderAppIcon } from '../utils/misc.js'
import { getAddMorpheUrl, getAuthorLink, getRepoInfo } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { GITHUB_SVG, GITLAB_SVG } from '../utils/svg.js'

/**
 * Open the bundle detail modal.
 * @param {Object} options
 * @param {string} options.bundleName
 * @param {string[]} options.channels
 */
export function openBundleModal({ bundleName, channels = [] }) {
  if (!bundleName) return

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const stableKey = `${bundleName}:stable`
  const devKey = `${bundleName}:dev`
  const bundleData = bundles[stableKey] || bundles[devKey]
  if (!bundleData) return

  const displayName = bundleData.patches_name || bundleName
  const repoInfo = getRepoInfo(bundleData.repo_url)
  const addMorpheUrl = getAddMorpheUrl(bundleData.repo_url)
  const authorHtml = getAuthorLink(bundleData.repo_url)
  const iconSvg = repoInfo.isGitLab ? GITLAB_SVG : GITHUB_SVG

  const avatarUrl = bundleData.avatarUrl || ''

  const content = el('div', { class: 'bundle-modal-content' })

  const headerEl = el('div', { class: 'bundle-modal-header' })
  headerEl.innerHTML = `
    <div class="bundle-modal-avatar-area">
      ${avatarUrl
        ? `<img class="bundle-modal-avatar" src="${escHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''
      }
      <div class="bundle-modal-avatar-placeholder" ${avatarUrl ? 'style="display:none"' : ''}>
        <span>${displayName.charAt(0).toUpperCase()}</span>
      </div>
    </div>
    <div class="bundle-modal-info">
      <h3 class="bundle-modal-name">${escHtml(displayName)}</h3>
      <span class="bundle-modal-author">${authorHtml}</span>
      <div class="bundle-modal-meta">
        ${bundleData.version ? `<span class="bundle-modal-version">v${escHtml(bundleData.version)}</span>` : ''}
        ${(bundleData.channels || channels).map((ch) => `<span class="channel-badge ${ch}">${ch}</span>`).join('')}
        ${bundleData.stars ? `<span class="bundle-stars-badge" title="${bundleData.stars} stars">★ ${bundleData.stars}</span>` : ''}
        ${bundleData.isArchived ? '<span class="bundle-archived-badge">Archived</span>' : ''}
      </div>
    </div>
  `
  content.appendChild(headerEl)

  if (bundleData.repoDescription) {
    const descEl = el('div', { class: 'bundle-modal-description' }, [bundleData.repoDescription])
    content.appendChild(descEl)
  }

  const apps = [...(bundleData.apps || [])].sort((a, b) =>
    resolveAppName(a, nameCache).localeCompare(resolveAppName(b, nameCache)),
  )

  const appsSection = el('div', { class: 'bundle-modal-apps-section' })
  appsSection.innerHTML = `<h4 class="bundle-modal-section-title">Apps (${apps.length})</h4>`
  const appsList = el('div', { class: 'bundle-modal-apps-list' })

  for (const app of apps) {
    const appName = resolveAppName(app, nameCache)
    const iconHtml = renderAppIcon(app, iconCache, 'sm')
    const patchCount = (app.patches || []).length

    const row = el('div', { class: 'bundle-modal-app-row', role: 'button', tabindex: '0' })
    row.innerHTML = `
      ${iconHtml}
      <div class="bundle-modal-app-info">
        <span class="bundle-modal-app-name">${escHtml(appName)}</span>
        <span class="bundle-modal-app-pkg">${escHtml(app.package)}</span>
      </div>
      <span class="bundle-modal-app-patches">${patchCount} patch${patchCount !== 1 ? 'es' : ''}</span>
    `

    const openApp = (e) => {
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('open-app', {
        detail: { app, bundleName, channels: bundleData.channels || channels },
      }))
    }
    row.addEventListener('click', openApp)
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openApp(e) }
    })
    appsList.appendChild(row)
  }

  appsSection.appendChild(appsList)
  content.appendChild(appsSection)

  const actionsEl = el('div', { class: 'bundle-modal-actions' })
  actionsEl.innerHTML = `
    <a href="${escHtml(bundleData.repo_url)}" class="btn btn--secondary" target="_blank" rel="noopener">
      ${iconSvg} View Source
    </a>
    <a href="${escHtml(addMorpheUrl)}" class="btn btn--primary" target="_blank" rel="noopener">
      Add to Morphe
    </a>
  `
  content.appendChild(actionsEl)

  openModal({
    title: displayName,
    content,
    className: 'bundle-modal',
    maxWidth: 600,
  })
}
