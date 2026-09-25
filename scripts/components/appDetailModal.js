/**
 * AppDetailModal — tabbed layout: Bundles | Patches | Changes.
 * Floating close button, hero section, expandable bundle accordions.
 */
import { el } from '../ui.js'
import { openModal, closeModal } from './modal.js'
import * as store from '../store.js'
import { resolveAppName, getAppIconUrl, copyToClipboard, getDisplayAvatar, getDisplayBundleImage, avatarStackHtml } from '../utils/misc.js'
import { getPlayStoreUrl, getAddMorpheUrl } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { formatVersion } from '../utils/format.js'
import { CLOSE_ICON, CHEVRON_DOWN, CHEVRON_RIGHT } from '../utils/svg.js'

const PLAY_STORE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M.859 11.981V1.741c0-.672.79-1.098 1.434-.771L12.37 6.09c.662.336.662 1.207 0 1.543l-10.077 5.12c-.644.327-1.434-.099-1.434-.772M9.23 9.23l-8.1-8.101m8.1 3.364l-8.1 8.1"/></svg>'

export function openAppDetailModal({ app, bundleName, channels = [], patchName = null }) {
  if (!app) return
  if (app.badge_type === 'REMOVED APP') return

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const pkg = app.package
  const appName = resolveAppName(app, nameCache)
  const iconUrl = getAppIconUrl({ package: pkg }, iconCache)
  const hideDev = localStorage.getItem('morphe_hide_dev') === 'true'

  // Collect all bundles containing this app
  const appBundles = []
  for (const [key, bundle] of Object.entries(bundles)) {
    if (hideDev && key.endsWith(':dev')) continue
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
          avatarUrl: getDisplayAvatar(bundle.repo_url, bundle.avatarUrl),
          bundleImageUrl: getDisplayBundleImage(bundle.repo_url, bundle.bundleImageUrl),
        })
      }
    }
  }

  // Find target bundle for Patches tab
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

  // Check if there are changes
  const hasChanges = !!(app.patch_diff && (
    (app.patch_diff.patches_added || []).length > 0 ||
    (app.patch_diff.patches_removed || []).length > 0 ||
    (app.patch_diff.patches_modified || []).length > 0
  ))

  const content = el('div', { class: 'app-detail-content' })

  // Floating close button
  const closeBtn = el('button', {
    class: 'app-detail-close-btn',
    'aria-label': 'Close modal',
    dangerouslySetInnerHTML: CLOSE_ICON,
  })
  closeBtn.addEventListener('click', closeModal)
  content.appendChild(closeBtn)

  // Hero section
  const iconHtml = iconUrl
    ? `<img class="app-detail-icon" src="${escHtml(iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="app-detail-icon app-detail-icon--fallback">${appName.charAt(0).toUpperCase()}</div>`

  const heroEl = el('div', { class: 'app-detail-hero' })
  heroEl.innerHTML = `
    ${iconHtml}
    <div class="app-detail-hero-info">
      <h3 class="app-detail-name">${escHtml(appName)}</h3>
      <span class="app-detail-pkg">${escHtml(pkg)}</span>
      <a class="app-detail-playstore" href="${escHtml(getPlayStoreUrl(pkg))}" target="_blank" rel="noopener">
        ${PLAY_STORE_SVG} View on Google Play
      </a>
    </div>
  `
  content.appendChild(heroEl)

  // Copy package name on click
  const pkgEl = heroEl.querySelector('.app-detail-pkg')
  if (pkgEl) {
    pkgEl.classList.add('copyable')
    pkgEl.setAttribute('title', 'Click to copy package name')
    pkgEl.addEventListener('click', (e) => {
      e.stopPropagation()
      copyToClipboard(pkg, pkgEl)
    })
  }

  // Tabs
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

  // ── Bundles tab ──────────────────────────────────────
  const bundlesTab = tabContents['Bundles']
  if (appBundles.length > 0) {
    // Compare bar: select 2+ bundles, then open comparison overlay
    const selectedForCompare = new Set()
    const getPatchesFor = (b) => {
      const bKey = b.channels.includes('dev') ? `${b.bundleName}:dev` : `${b.bundleName}:stable`
      const bd = bundles[bKey]
      return bd?.apps?.find((a) => a.package === pkg)?.patches || []
    }

    const compareBar = el('div', { class: 'app-detail-compare-bar' })
    const compareHint = el('span', { class: 'app-detail-compare-hint' }, ['Select bundles to compare'])
    const compareBtn = el('button', { class: 'btn btn--primary btn--sm', type: 'button', disabled: '' }, ['Compare'])
    compareBar.appendChild(compareHint)
    compareBar.appendChild(compareBtn)
    if (appBundles.length >= 2) bundlesTab.appendChild(compareBar)

    function updateCompareBar() {
      const n = selectedForCompare.size
      compareBtn.disabled = n < 2
      compareBtn.textContent = n >= 2 ? `Compare (${n})` : 'Compare'
      compareHint.textContent = n >= 2
        ? `${n} bundle${n !== 1 ? 's' : ''} selected`
        : 'Select bundles to compare'
    }

    compareBtn.addEventListener('click', () => {
      const picked = appBundles.filter((b) => selectedForCompare.has(b.bundleName))
      if (picked.length < 2) return

      const patchSets = picked.map((b) => {
        const names = new Set(getPatchesFor(b).map((p) => p.name.toLowerCase()))
        return { bundle: b, names }
      })

      const shared = [...patchSets[0].names].filter((n) =>
        patchSets.every((s) => s.names.has(n)),
      )
      const sharedNames = new Set(shared)
      const sharedPatches = getPatchesFor(picked[0])
        .filter((p) => sharedNames.has(p.name.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))

      const overlay = el('div', { class: 'compare-overlay' })

      const inAll = el('div', { class: 'compare-section' })
      inAll.appendChild(el('h4', { class: 'compare-section-title' }, [`In all ${picked.length} bundles (${sharedPatches.length})`]))
      if (sharedPatches.length === 0) {
        inAll.appendChild(el('div', { class: 'compare-empty' }, ['No shared patches']))
      }
      for (const p of sharedPatches) {
        inAll.appendChild(el('div', { class: 'compare-patch compare-patch--shared' }, [p.name]))
      }
      overlay.appendChild(inAll)

      for (const s of patchSets) {
        const only = [...s.names].filter((n) => {
          const count = patchSets.filter((x) => x.names.has(n)).length
          return count === 1
        })
        const onlyPatches = getPatchesFor(s.bundle)
          .filter((p) => only.includes(p.name.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name))
        const sec = el('div', { class: 'compare-section' })
        sec.appendChild(el('h4', { class: 'compare-section-title' }, [
          `Only in ${s.bundle.patchesName} (${onlyPatches.length})`,
        ]))
        if (onlyPatches.length === 0) {
          sec.appendChild(el('div', { class: 'compare-empty' }, ['No unique patches']))
        }
        for (const p of onlyPatches) {
          sec.appendChild(el('div', { class: 'compare-patch compare-patch--unique' }, [p.name]))
        }
        overlay.appendChild(sec)
      }

      openModal({
        title: `Compare ${appName} patches`,
        content: overlay,
        className: 'compare-modal',
        maxWidth: 700,
        stack: true,
      })
    })

    for (const b of appBundles) {
      const bundleAccordion = el('div', { class: 'app-detail-bundle-accordion' })

      const channelBadges = b.channels.map((ch) =>
        `<span class="channel-badge ${ch}">${ch}</span>`
      ).join(' ')

      const bundleHeader = el('div', { class: 'app-detail-bundle-accordion-header', role: 'button', tabindex: '0' })
      bundleHeader.innerHTML = `
        <div class="app-detail-bundle-accordion-info">
          ${avatarStackHtml(
            b.bundleImageUrl,
            b.avatarUrl,
            (b.patchesName || '?').charAt(0).toUpperCase(),
            'app-detail-bundle-avatar',
            'app-detail-bundle-avatar app-detail-bundle-avatar--fallback',
          )}
          <span class="app-detail-bundle-name">${escHtml(b.patchesName)}</span>
          ${channelBadges}
          ${b.version ? `<span class="app-detail-bundle-version">${escHtml(formatVersion(b.version))}</span>` : ''}
        </div>
        <div class="app-detail-bundle-accordion-actions">
          ${b.repoUrl ? `<a href="${escHtml(getAddMorpheUrl(b.repoUrl))}" class="btn btn--primary btn--sm" target="_blank" rel="noopener" onclick="event.stopPropagation()">Add to Morphe</a>` : ''}
          <label class="app-detail-compare-check" title="Select for comparison" onclick="event.stopPropagation()">
            <input type="checkbox" data-bundle="${escHtml(b.bundleName)}">
          </label>
          <span class="app-detail-bundle-chevron">${CHEVRON_DOWN}</span>
        </div>
      `

      const checkBox = bundleHeader.querySelector('input[type="checkbox"]')
      checkBox.addEventListener('change', () => {
        if (checkBox.checked) selectedForCompare.add(b.bundleName)
        else selectedForCompare.delete(b.bundleName)
        updateCompareBar()
      })

      const patchesContainer = el('div', { class: 'app-detail-bundle-patches' })

      let bundlePatches = []
      const bKey = b.channels.includes('dev')
        ? `${b.bundleName}:dev`
        : `${b.bundleName}:stable`
      const bundleData = bundles[bKey]
      if (bundleData) {
        const appData = bundleData.apps?.find((a) => a.package === pkg)
        if (appData) bundlePatches = appData.patches || []
      }

      if (bundlePatches.length > 0) {
        const sorted = [...bundlePatches].sort((a, b) => a.name.localeCompare(b.name))
        for (const patch of sorted) {
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
          patchesContainer.appendChild(patchEl)
        }
      } else {
        patchesContainer.appendChild(el('div', { class: 'app-detail-patch-empty' }, ['No patch data available.']))
      }

      bundleHeader.addEventListener('click', () => {
        const isOpen = bundleAccordion.classList.toggle('open')
        if (isOpen) {
          patchesContainer.style.maxHeight = patchesContainer.scrollHeight + 'px'
        } else {
          patchesContainer.style.maxHeight = '0'
        }
      })
      bundleHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          bundleHeader.click()
        }
      })

      bundleAccordion.appendChild(bundleHeader)
      bundleAccordion.appendChild(patchesContainer)
      bundlesTab.appendChild(bundleAccordion)
    }
  } else {
    bundlesTab.innerHTML = '<div class="empty-state">No bundles found for this app.</div>'
  }

  // ── Patches tab ──────────────────────────────────────
  const patchesTab = tabContents['Patches']
  const patchesList = el('div', { class: 'app-detail-patches' })

  function renderPatchesForBundle(bundleInfo) {
    patchesList.replaceChildren()
    let bundlePatches = []
    const bKey = bundleInfo.channels.includes('dev')
      ? `${bundleInfo.bundleName}:dev`
      : `${bundleInfo.bundleName}:stable`
    const bundleData = bundles[bKey]
    if (bundleData) {
      const appData = bundleData.apps?.find((a) => a.package === pkg)
      if (appData) bundlePatches = appData.patches || []
    }

    if (bundlePatches.length > 0) {
      const sorted = [...bundlePatches].sort((a, b) => a.name.localeCompare(b.name))
      for (const patch of sorted) {
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
    } else {
      patchesList.appendChild(el('div', { class: 'app-detail-patch-empty' }, ['No patch data available.']))
    }
  }

  if (appBundles.length > 0) {
    let currentBundle = targetBundle || appBundles[0]

    function getBundleLabel(b) {
      return `${escHtml(b.patchesName)}${b.version ? ` ${escHtml(formatVersion(b.version))}` : ''}`
    }

    const dropdownWrapper = el('div', { class: 'app-detail-bundle-dropdown' })
    const trigger = el('button', { class: 'app-detail-bundle-dropdown-trigger', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' })
    const triggerLabel = el('span', { class: 'app-detail-bundle-dropdown-label' })
    const triggerChevron = el('span', { class: 'app-detail-bundle-dropdown-chevron', dangerouslySetInnerHTML: CHEVRON_DOWN })
    trigger.appendChild(triggerLabel)
    trigger.appendChild(triggerChevron)

    const menu = el('div', { class: 'app-detail-bundle-dropdown-menu', role: 'listbox' })

    function updateTrigger() {
      const chBadges = currentBundle.channels.map((ch) =>
        `<span class="channel-badge channel-badge--sm ${ch}">${ch}</span>`
      ).join('')
      triggerLabel.innerHTML = `${getBundleLabel(currentBundle)} ${chBadges}`
    }

    function renderMenu() {
      menu.replaceChildren()
      for (const b of appBundles) {
        const isActive = b.bundleName === currentBundle.bundleName
        const option = el('div', {
          class: `app-detail-bundle-dropdown-option${isActive ? ' active' : ''}`,
          role: 'option',
          'aria-selected': String(isActive),
        })
        const chBadges = b.channels.map((ch) =>
          `<span class="channel-badge channel-badge--sm ${ch}">${ch}</span>`
        ).join(' ')
        option.innerHTML = `
          <span class="app-detail-bundle-dropdown-option-name">${escHtml(b.patchesName)}</span>
          <span class="app-detail-bundle-dropdown-option-meta">${chBadges}${b.version ? ` ${escHtml(formatVersion(b.version))}` : ''}</span>
        `
        option.addEventListener('click', () => {
          currentBundle = b
          updateTrigger()
          renderMenu()
          renderPatchesForBundle(b)
          closeDropdown()
        })
        menu.appendChild(option)
      }
    }

    function openDropdown() {
      renderMenu()
      menu.classList.add('open')
      trigger.setAttribute('aria-expanded', 'true')
    }
    function closeDropdown() {
      menu.classList.remove('open')
      trigger.setAttribute('aria-expanded', 'false')
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation()
      menu.classList.contains('open') ? closeDropdown() : openDropdown()
    })
    document.addEventListener('click', (e) => {
      if (!dropdownWrapper.contains(e.target)) closeDropdown()
    })

    updateTrigger()
    dropdownWrapper.appendChild(trigger)
    dropdownWrapper.appendChild(menu)
    patchesTab.appendChild(dropdownWrapper)
    renderPatchesForBundle(currentBundle)
    patchesTab.appendChild(patchesList)

    // Deep-link: switch to Patches tab and highlight the target patch
    if (patchName) {
      const activateTab = (name) => {
        tabsEl.querySelectorAll('.modal-tab').forEach((t) => t.classList.toggle('active', t.textContent === name))
        Object.entries(tabContents).forEach(([k, c]) => c.classList.toggle('active', k === name))
      }
      activateTab('Patches')
      const target = [...patchesList.querySelectorAll('.app-detail-patch')].find(
        (n) => n.querySelector('.app-detail-patch-name')?.textContent === patchName
      )
      if (target) {
        target.classList.add('app-detail-patch--highlight')
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => target.classList.remove('app-detail-patch--highlight'), 2500)
      }
    }
  } else {
    patchesTab.innerHTML = '<div class="empty-state">No patch information available.</div>'
  }

  // ── Changes tab ──────────────────────────────────────
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
    hideHeader: true,
  })
}
