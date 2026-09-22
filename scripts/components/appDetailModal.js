/**
 * AppDetailModal — shows app info, bundles, patches, and Add to Morphe link.
 */
import { el } from '../ui.js'
import { openModal } from './modal.js'
import * as store from '../store.js'
import { resolveAppName, getAppIconUrl } from '../utils/misc.js'
import { getPlayStoreUrl, getAddMorpheUrl } from '../utils/url.js'
import { escHtml } from '../utils/html.js'

/**
 * Open the app detail modal.
 * @param {Object} options
 * @param {Object} options.app - { package, app_name, badge_type, patch_diff }
 * @param {string} options.bundleName
 * @param {string[]} options.channels
 */
export function openAppDetailModal({ app, bundleName, channels = [] }) {
  if (!app) return

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const pkg = app.package
  const appName = resolveAppName(app, nameCache)
  const iconUrl = getAppIconUrl({ package: pkg }, iconCache)

  // Find all bundles this app belongs to
  const appBundles = []
  for (const [key, bundle] of Object.entries(bundles)) {
    const bName = key.replace(/:(stable|dev)$/, '')
    const channel = key.endsWith(':dev') ? 'dev' : 'stable'
    if (bundle.apps?.some((a) => a.package === pkg)) {
      const existing = appBundles.find((b) => b.bundleName === bName)
      if (existing) {
        if (!existing.channels.includes(channel)) existing.channels.push(channel)
      } else {
        appBundles.push({
          bundleName: bName,
          repoUrl: bundle.repo_url || '',
          patchesName: bundle.patches_name || bName,
          version: bundle.version || '',
          channels: [channel],
        })
      }
    }
  }

  // Collect patches from the target bundle (or first bundle found)
  const targetBundle = appBundles.find((b) => b.bundleName === bundleName) || appBundles[0]
  let patches = []
  if (targetBundle) {
    const bKey = targetBundle.channels.includes('dev')
      ? `${targetBundle.bundleName}:dev`
      : `${targetBundle.bundleName}:stable`
    const bundleData = bundles[bKey]
    if (bundleData) {
      const appData = bundleData.apps?.find((a) => a.package === pkg)
      if (appData) patches = appData.patches || []
    }
  }

  // Build content
  const content = el('div', { class: 'app-detail-content' })

  // App header
  const iconHtml = iconUrl
    ? `<img class="app-detail-icon" src="${escHtml(iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="app-detail-icon app-detail-icon--fallback">${appName.charAt(0).toUpperCase()}</div>`

  const headerEl = el('div', { class: 'app-detail-header' })
  headerEl.innerHTML = `
    ${iconHtml}
    <div class="app-detail-info">
      <h3 class="app-detail-name">${escHtml(appName)}</h3>
      <span class="app-detail-pkg">${escHtml(pkg)}</span>
      <a class="app-detail-playstore" href="${escHtml(getPlayStoreUrl(pkg))}" target="_blank" rel="noopener">
        View on Google Play
      </a>
    </div>
  `
  content.appendChild(headerEl)

  // Bundles section
  if (appBundles.length > 0) {
    const bundlesSection = el('div', { class: 'app-detail-section' })
    bundlesSection.innerHTML = `<h4 class="app-detail-section-title">Bundles</h4>`
    const bundlesList = el('div', { class: 'app-detail-bundles' })

    for (const b of appBundles) {
      const channelBadges = b.channels.map((ch) =>
        `<span class="channel-badge ${ch}">${ch}</span>`
      ).join(' ')

      const bundleRow = el('div', { class: 'app-detail-bundle-row' })
      bundleRow.innerHTML = `
        <div class="app-detail-bundle-info">
          <span class="app-detail-bundle-name">${escHtml(b.patchesName)}</span>
          ${channelBadges}
          ${b.version ? `<span class="app-detail-bundle-version">v${escHtml(b.version)}</span>` : ''}
        </div>
      `

      // Add to Morphe link
      if (b.repoUrl) {
        const addBtn = el('a', {
          class: 'btn btn--primary btn--sm',
          href: getAddMorpheUrl(b.repoUrl),
          target: '_blank',
          rel: 'noopener',
        }, ['Add to Morphe'])
        bundleRow.appendChild(addBtn)
      }

      bundlesList.appendChild(bundleRow)
    }

    bundlesSection.appendChild(bundlesList)
    content.appendChild(bundlesSection)
  }

  // Patches section
  if (patches.length > 0) {
    const patchesSection = el('div', { class: 'app-detail-section' })
    patchesSection.innerHTML = `<h4 class="app-detail-section-title">Patches (${patches.length})</h4>`
    const patchesList = el('div', { class: 'app-detail-patches' })

    for (const patch of patches) {
      const patchEl = el('div', { class: 'app-detail-patch' })

      const defaultBadge = patch.use
        ? '<span class="badge badge--default-on">ON</span>'
        : ''

      const versionsHtml = patch.compatible_versions?.length
        ? `<span class="app-detail-patch-versions">${escHtml(patch.compatible_versions.join(', '))}</span>`
        : '<span class="app-detail-patch-versions app-detail-patch-versions--any">Any version</span>'

      patchEl.innerHTML = `
        <div class="app-detail-patch-header">
          <span class="app-detail-patch-name">${escHtml(patch.name)}</span>
          ${defaultBadge}
        </div>
        ${patch.description ? `<p class="app-detail-patch-desc">${escHtml(patch.description)}</p>` : ''}
        <div class="app-detail-patch-meta">${versionsHtml}</div>
      `
      patchesList.appendChild(patchEl)
    }

    patchesSection.appendChild(patchesList)
    content.appendChild(patchesSection)
  }

  // Patch diff (if this is an UPDATED APP with patch_diff data)
  if (app.patch_diff) {
    const diffSection = el('div', { class: 'app-detail-section' })
    diffSection.innerHTML = `<h4 class="app-detail-section-title">Changes</h4>`
    const diffList = el('div', { class: 'app-detail-diff' })

    for (const added of app.patch_diff.patches_added || []) {
      const row = el('div', { class: 'app-detail-diff-row app-detail-diff-row--added' })
      row.innerHTML = `<span class="app-detail-diff-icon">+</span><span>${escHtml(added.name)}</span>`
      diffList.appendChild(row)
    }
    for (const removed of app.patch_diff.patches_removed || []) {
      const row = el('div', { class: 'app-detail-diff-row app-detail-diff-row--removed' })
      row.innerHTML = `<span class="app-detail-diff-icon">−</span><span>${escHtml(removed.name)}</span>`
      diffList.appendChild(row)
    }
    for (const modified of app.patch_diff.patches_modified || []) {
      const row = el('div', { class: 'app-detail-diff-row app-detail-diff-row--modified' })
      const changes = (modified.changes || []).map((c) => escHtml(c)).join(', ')
      row.innerHTML = `<span class="app-detail-diff-icon">~</span><span>${escHtml(modified.name)}<span class="app-detail-diff-changes">${changes}</span></span>`
      diffList.appendChild(row)
    }

    diffSection.appendChild(diffList)
    content.appendChild(diffSection)
  }

  openModal({
    title: appName,
    content,
    className: 'app-detail-modal',
    maxWidth: 600,
  })
}
