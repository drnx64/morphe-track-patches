/**
 * AppDetailModal — tabbed layout: Bundles | Patches | Changes.
 */
import { el } from '../ui.js'
import { openModal } from './modal.js'
import * as store from '../store.js'
import { resolveAppName, getAppIconUrl } from '../utils/misc.js'
import { getPlayStoreUrl, getAddMorpheUrl } from '../utils/url.js'
import { escHtml } from '../utils/html.js'

export function openAppDetailModal({ app, bundleName, channels = [] }) {
  if (!app) return

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const pkg = app.package
  const appName = resolveAppName(app, nameCache)
  const iconUrl = getAppIconUrl({ package: pkg }, iconCache)

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
          avatarUrl: bundle.avatarUrl || '',
        })
      }
    }
  }

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

  const content = el('div', { class: 'app-detail-content' })

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

  const hasChanges = !!(app.patch_diff && (
    (app.patch_diff.patches_added || []).length > 0 ||
    (app.patch_diff.patches_removed || []).length > 0 ||
    (app.patch_diff.patches_modified || []).length > 0
  ))

  const tabNames = ['Bundles', 'Patches']
  if (hasChanges) tabNames.push('Changes')

  const tabsEl = el('div', { class: 'modal-tabs' })
  const tabContents = {}

  for (const tabName of tabNames) {
    const tabBtn = el('button', { class: `modal-tab${tabName === 'Bundles' ? ' active' : ''}` }, [tabName])
    tabsEl.appendChild(tabBtn)

    const tabContent = el('div', { class: `modal-tab-content${tabName === 'Bundles' ? ' active' : ''}` })
    tabContents[tabName] = tabContent

    tabBtn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.modal-tab').forEach((t) => t.classList.remove('active'))
      Object.values(tabContents).forEach((c) => c.classList.remove('active'))
      tabBtn.classList.add('active')
      tabContent.classList.add('active')
    })
  }

  const bundlesTab = tabContents['Bundles']
  if (appBundles.length > 0) {
    const bundlesList = el('div', { class: 'app-detail-bundles' })
    for (const b of appBundles) {
      const channelBadges = b.channels.map((ch) =>
        `<span class="channel-badge ${ch}">${ch}</span>`
      ).join(' ')
      const row = el('div', { class: 'app-detail-bundle-row' })
      row.innerHTML = `
        <div class="app-detail-bundle-info">
          ${b.avatarUrl ? `<img class="app-detail-bundle-avatar" src="${escHtml(b.avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
          <span class="app-detail-bundle-name">${escHtml(b.patchesName)}</span>
          ${channelBadges}
          ${b.version ? `<span class="app-detail-bundle-version">v${escHtml(b.version)}</span>` : ''}
        </div>
      `
      if (b.repoUrl) {
        const addBtn = el('a', {
          class: 'btn btn--primary btn--sm',
          href: getAddMorpheUrl(b.repoUrl),
          target: '_blank',
          rel: 'noopener',
        }, ['Add to Morphe'])
        row.appendChild(addBtn)
      }
      bundlesList.appendChild(row)
    }
    bundlesTab.appendChild(bundlesList)
  } else {
    bundlesTab.innerHTML = '<div class="empty-state">No bundles found for this app.</div>'
  }

  const patchesTab = tabContents['Patches']
  if (patches.length > 0) {
    const patchesList = el('div', { class: 'app-detail-patches' })
    for (const patch of patches) {
      const patchEl = el('div', { class: 'app-detail-patch' })
      const defaultBadge = patch.use ? '<span class="badge badge--default-on">ON</span>' : ''
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
    patchesTab.appendChild(patchesList)
  } else {
    patchesTab.innerHTML = '<div class="empty-state">No patch information available.</div>'
  }

  if (hasChanges) {
    const changesTab = tabContents['Changes']
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
    changesTab.appendChild(diffList)
  }

  content.appendChild(tabsEl)
  for (const tabContent of Object.values(tabContents)) {
    content.appendChild(tabContent)
  }

  openModal({
    title: appName,
    content,
    className: 'app-detail-modal',
    maxWidth: 600,
  })
}
