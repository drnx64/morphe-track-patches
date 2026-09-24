/**
 * Diff page — app-centric: search for an app, see all patches across bundles.
 * Cross-bundle patch highlighting for same-name patches.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { buildAppIndex, resolveAppName, renderAppIcon, suggestFuzzy, copyToClipboard, getDisplayAvatar } from '../utils/misc.js'
import { escHtml } from '../utils/html.js'
import { SEARCH_ICON, REFRESH_ICON } from '../utils/svg.js'

const HIGHLIGHT_COLORS = [
  { bg: 'rgba(74, 127, 200, 0.15)', border: 'rgba(74, 127, 200, 0.4)', text: 'var(--state-info)' },
  { bg: 'rgba(127, 168, 118, 0.15)', border: 'rgba(127, 168, 118, 0.4)', text: 'var(--state-stable)' },
  { bg: 'rgba(201, 138, 95, 0.15)', border: 'rgba(201, 138, 95, 0.4)', text: 'var(--state-dev)' },
  { bg: 'rgba(162, 129, 173, 0.15)', border: 'rgba(162, 129, 173, 0.4)', text: 'var(--state-plum)' },
  { bg: 'rgba(181, 83, 63, 0.15)', border: 'rgba(181, 83, 63, 0.4)', text: 'var(--state-critical)' },
]

export function renderDiff(container) {
  const page = el('div', { class: 'diff-page' })
  page.appendChild(el('h2', { class: 'section-title' }, ['Patch Explorer']))

  const subtitle = el('p', { class: 'section-helper' }, ['Search for an app to see all patches across bundles.'])
  page.appendChild(subtitle)

  const searchWrapper = el('div', { class: 'diff-app-search' })
  const searchInput = el('input', {
    type: 'text',
    class: 'diff-app-search-input',
    placeholder: 'Search for an app (e.g. YouTube, TikTok)...',
    'aria-label': 'Search app for patch comparison',
  })
  const searchIcon = el('span', { class: 'diff-app-search-icon', dangerouslySetInnerHTML: SEARCH_ICON })
  const clearBtn = el('button', { class: 'global-search-clear', 'aria-label': 'Clear' }, ['✕'])
  const searchDropdown = el('div', { class: 'diff-app-search-dropdown' })

  searchWrapper.appendChild(searchIcon)
  searchWrapper.appendChild(searchInput)
  searchWrapper.appendChild(clearBtn)
  searchWrapper.appendChild(searchDropdown)

  const resultArea = el('div', { class: 'diff-result' })
  const suggestionsArea = el('div', { class: 'diff-suggestions' })

  page.appendChild(searchWrapper)
  page.appendChild(suggestionsArea)
  page.appendChild(resultArea)
  mount(container, page)

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}
  const appIndex = buildAppIndex(bundles, nameCache, iconCache)

  // Filter apps with 2+ distinct bundles for suggestions
  const multiBundleApps = appIndex.filter((app) => {
    const uniqueBundles = new Set(app.bundles.map((b) => b.bundleName))
    return uniqueBundles.size >= 2
  })

  function getRandomSuggestions(count = 8) {
    const shuffled = [...multiBundleApps].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  function renderSuggestions() {
    suggestionsArea.replaceChildren()
    const suggestions = getRandomSuggestions(8)
    if (suggestions.length === 0) return

    const header = el('div', { class: 'diff-suggestions-header' })
    header.innerHTML = `<span class="diff-suggestions-title">Suggested Apps</span>`
    const refreshBtn = el('button', { class: 'diff-suggestions-refresh', 'aria-label': 'Refresh suggestions', dangerouslySetInnerHTML: REFRESH_ICON })
    refreshBtn.addEventListener('click', renderSuggestions)
    header.appendChild(refreshBtn)
    suggestionsArea.appendChild(header)

    const grid = el('div', { class: 'diff-suggestions-grid' })
    for (const app of suggestions) {
      const card = el('div', { class: 'diff-suggestion-card', role: 'button', tabindex: '0' })
      const iconHtml = renderAppIcon({ package: app.package, app_name: app.name }, iconCache)
      const bundleCount = app.bundles.length
      card.innerHTML = `
        ${iconHtml}
        <div class="diff-suggestion-info">
          <span class="diff-suggestion-name">${escHtml(app.name)}</span>
          <span class="diff-suggestion-meta">${bundleCount} bundle${bundleCount !== 1 ? 's' : ''}</span>
        </div>
      `
      card.addEventListener('click', () => {
        searchInput.value = app.name
        clearBtn.classList.add('visible')
        selectApp(app.package)
      })
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          searchInput.value = app.name
          clearBtn.classList.add('visible')
          selectApp(app.package)
        }
      })
      grid.appendChild(card)
    }
    suggestionsArea.appendChild(grid)
  }

  renderSuggestions()

  let debounceTimer
  let selectedPkg = null

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const q = searchInput.value.trim()
    clearBtn.classList.toggle('visible', q.length > 0)

    if (!q) {
      searchDropdown.classList.remove('open')
      searchDropdown.replaceChildren()
      selectedPkg = null
      return
    }

    debounceTimer = setTimeout(() => {
      const ql = q.toLowerCase()
      const matches = appIndex.filter((app) =>
        app.name.toLowerCase().includes(ql) || app.package.toLowerCase().includes(ql)
      ).slice(0, 8)

      searchDropdown.replaceChildren()

      if (matches.length === 0) {
        const suggestions = suggestFuzzy(q, appIndex)
        if (suggestions.length > 0) {
          const sugEl = el('div', { class: 'diff-app-search-suggestion' })
          sugEl.innerHTML = `Did you mean: `
          for (let i = 0; i < suggestions.length; i++) {
            const link = el('button', { class: 'global-search-suggestion-link' }, [suggestions[i].name])
            link.addEventListener('click', () => {
              searchInput.value = suggestions[i].name
              clearBtn.classList.add('visible')
              selectApp(suggestions[i].package)
            })
            sugEl.appendChild(link)
            if (i < suggestions.length - 1) sugEl.appendChild(document.createTextNode(', '))
          }
          searchDropdown.appendChild(sugEl)
        } else {
          searchDropdown.appendChild(el('div', { class: 'global-search-empty' }, ['No apps found.']))
        }
      } else {
        for (const app of matches) {
          const item = el('div', { class: 'diff-app-search-item' })
          const iconUrl = iconCache[app.package] || ''
          item.innerHTML = `
            ${iconUrl
              ? `<img class="app-icon" src="${escHtml(iconUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''
            }
            <div class="app-icon app-icon--fallback" ${iconUrl ? 'style="display:none"' : ''}>${app.name.charAt(0).toUpperCase()}</div>
            <div class="global-search-item-info">
              <span class="global-search-item-name">${escHtml(app.name)}</span>
              <span class="global-search-item-meta">${escHtml(app.package)}</span>
            </div>
          `
          item.addEventListener('click', () => selectApp(app.package))
          searchDropdown.appendChild(item)
        }
      }
      searchDropdown.classList.add('open')
    }, 150)
  })

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      searchInput.dispatchEvent(new Event('input'))
    }
  })

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.blur()
      searchDropdown.classList.remove('open')
    }
  })

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    clearBtn.classList.remove('visible')
    searchDropdown.classList.remove('open')
    searchDropdown.replaceChildren()
    selectedPkg = null
    resultArea.replaceChildren()
    suggestionsArea.style.display = ''
    renderSuggestions()
    searchInput.focus()
  })

  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) {
      searchDropdown.classList.remove('open')
    }
  })

  function selectApp(pkg) {
    selectedPkg = pkg
    searchDropdown.classList.remove('open')
    searchDropdown.replaceChildren()
    suggestionsArea.style.display = 'none'
    renderAppBundles(pkg)
  }

  function renderAppBundles(pkg) {
    resultArea.replaceChildren()

    const appEntry = appIndex.find((a) => a.package === pkg)
    if (!appEntry) {
      resultArea.innerHTML = '<div class="empty-state">App not found.</div>'
      return
    }

    const appName = resolveAppName(appEntry, nameCache)
    const iconHtml = renderAppIcon({ package: pkg, app_name: appName }, iconCache)

    const headerEl = el('div', { class: 'diff-app-header' })
    headerEl.innerHTML = `
      ${iconHtml}
      <div class="diff-app-header-info">
        <h3 class="diff-app-header-name">${escHtml(appName)}</h3>
        <span class="diff-app-header-pkg">${escHtml(pkg)}</span>
      </div>
    `
    resultArea.appendChild(headerEl)

    const patchBundleMap = new Map()
    const allPatchNames = new Set()

    for (const [key, bundle] of Object.entries(bundles)) {
      const bName = key.replace(/:(stable|dev)$/, '')
      const channel = key.endsWith(':dev') ? 'dev' : 'stable'
      const appData = bundle.apps?.find((a) => a.package === pkg)
      if (!appData) continue

      const patches = appData.patches || []
      if (patches.length === 0) continue

      const bKey = `${bName}:${channel}`
      if (!patchBundleMap.has(bKey)) {
        patchBundleMap.set(bKey, {
          name: bundle.patches_name || bName,
          bundle: bName,
          channel,
          version: bundle.version || '',
          avatarUrl: getDisplayAvatar(bundle.repo_url, bundle.avatarUrl),
          patches,
        })
      } else {
        const existing = patchBundleMap.get(bKey)
        if (bundle.version && !existing.version) existing.version = bundle.version
      }

      for (const p of patches) {
        allPatchNames.add(p.name.toLowerCase())
      }
    }

    if (patchBundleMap.size === 0) {
      resultArea.appendChild(el('div', { class: 'empty-state' }, ['No patch data found for this app.']))
      return
    }

    const crossBundlePatches = new Map()
    for (const patchName of allPatchNames) {
      const containingBundles = new Set()
      for (const [, bundleInfo] of patchBundleMap) {
        if (bundleInfo.patches.some((p) => p.name.toLowerCase() === patchName)) {
          containingBundles.add(bundleInfo.bundle)
        }
      }
      if (containingBundles.size > 1) {
        crossBundlePatches.set(patchName, [...containingBundles])
      }
    }

    const patchColorMap = new Map()
    let colorIdx = 0
    for (const [patchName] of crossBundlePatches) {
      patchColorMap.set(patchName, HIGHLIGHT_COLORS[colorIdx % HIGHLIGHT_COLORS.length])
      colorIdx++
    }

    const allBundles = [...patchBundleMap.values()]
    const stableBundles = allBundles.filter((b) => b.channel === 'stable').sort((a, b) => a.name.localeCompare(b.name))
    const devBundles = allBundles.filter((b) => b.channel === 'dev').sort((a, b) => a.name.localeCompare(b.name))

    const renderBundleGroup = (bundles, label) => {
      if (bundles.length === 0) return
      const groupEl = el('div', { class: 'diff-bundle-group' })
      groupEl.appendChild(el('h4', { class: 'diff-bundle-group-title' }, [label]))
      for (const bundleInfo of bundles) {
      const bundleSection = el('div', { class: 'diff-bundle-section' })

      const channelBadges = `<span class="channel-badge ${bundleInfo.channel}">${bundleInfo.channel}</span>`
      const titleRow = el('div', { class: 'diff-bundle-section-header' })
      titleRow.innerHTML = `
        <div class="diff-bundle-section-info">
          ${bundleInfo.avatarUrl
            ? `<img class="diff-bundle-section-avatar" src="${escHtml(bundleInfo.avatarUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="diff-bundle-section-avatar diff-bundle-section-avatar--fallback" ${bundleInfo.avatarUrl ? 'style="display:none"' : ''}>${(bundleInfo.name || '?').charAt(0).toUpperCase()}</div>
          <span class="diff-bundle-section-name">${escHtml(bundleInfo.name)}</span>
          ${channelBadges}
          ${bundleInfo.version ? `<span class="bundle-version-tag">v${escHtml(bundleInfo.version)}</span>` : ''}
        </div>
        <span class="diff-bundle-section-count">${bundleInfo.patches.length} patches</span>
      `
      bundleSection.appendChild(titleRow)

      const patchesList = el('div', { class: 'diff-bundle-patches' })
      const sorted = [...bundleInfo.patches].sort((a, b) => a.name.localeCompare(b.name))

      for (const patch of sorted) {
        const patchEl = el('div', { class: 'diff-patch-row' })
        const patchLower = patch.name.toLowerCase()
        const isShared = crossBundlePatches.has(patchLower)
        const color = patchColorMap.get(patchLower)

        if (isShared && color) {
          patchEl.style.background = color.bg
          patchEl.style.borderLeft = `3px solid ${color.border}`
        }

        const onBadge = patch.use
          ? '<span class="badge badge--default-on">ON</span>'
          : ''

        const versionsHtml = patch.compatible_versions?.length
          ? `<span class="diff-patch-versions">${escHtml(patch.compatible_versions.join(', '))}</span>`
          : ''

        patchEl.innerHTML = `
          <div class="diff-patch-row-header">
            <span class="diff-patch-row-name copyable" title="Click to copy">${escHtml(patch.name)}</span>
            ${onBadge}
            ${isShared ? '<span class="diff-patch-shared-badge" title="This patch exists in multiple bundles">shared</span>' : ''}
          </div>
          ${patch.description ? `<p class="diff-patch-row-desc">${escHtml(patch.description)}</p>` : ''}
          ${versionsHtml ? `<div class="diff-patch-row-meta">${versionsHtml}</div>` : ''}
        `

        const nameEl = patchEl.querySelector('.diff-patch-row-name')
        if (nameEl) {
          nameEl.addEventListener('click', (e) => {
            e.stopPropagation()
            copyToClipboard(patch.name, nameEl)
          })
        }

        patchesList.appendChild(patchEl)
      }

      bundleSection.appendChild(patchesList)
      groupEl.appendChild(bundleSection)
      }
      resultArea.appendChild(groupEl)
    }

    renderBundleGroup(stableBundles, 'Stable')
    renderBundleGroup(devBundles, 'Dev')
  }
}
