/**
 * Bundles grid — groups bundles, renders BundleCards.
 * Includes sort dropdown (name, stars, app count, version).
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, sortBundleNames, getDisplayAvatar } from '../utils/misc.js'
import { renderBundleCard } from './bundleCard.js'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'stars', label: 'Stars' },
  { value: 'apps', label: 'App Count' },
  { value: 'version', label: 'Version' },
]

export function renderBundlesGrid() {
  const section = el('section', { class: 'bundles-section', 'aria-labelledby': 'bundles-heading' })

  const headingRow = el('div', { class: 'bundles-heading-row' })
  headingRow.appendChild(el('h2', { class: 'section-title', id: 'bundles-heading' }, ['Patch Bundles']))

  const sortSelect = el('select', { class: 'bundles-sort-select', 'aria-label': 'Sort bundles' })
  for (const opt of SORT_OPTIONS) {
    sortSelect.appendChild(el('option', { value: opt.value }, [opt.label]))
  }
  headingRow.appendChild(sortSelect)
  section.appendChild(headingRow)

  const grid = el('div', { class: 'bundles-grid', id: 'bundles-grid-container' })
  section.appendChild(grid)

  function renderList() {
    grid.replaceChildren()

    const bundles = store.get('bundles') || {}
    const filters = store.get('filters') || {}
    const nameCache = store.get('nameCache') || {}

    // Group by bundle name
    const grouped = {}
    for (const b of Object.values(bundles)) {
      if (filters.channel !== 'all' && b.channel !== filters.channel) continue
      if (filters.hideArchived && b.isArchived) continue
      if (filters.hidePreRelease && b.isPreRelease) continue

      if (!grouped[b.bundle]) {
        grouped[b.bundle] = {
          bundle: b.bundle,
          channels: [b.channel],
          repo_url: b.repo_url,
          patches_name: b.patches_name,
          version: b.version || '',
          created_at: b.created_at,
          apps: [...(b.apps || [])],
          stars: b.stars || 0,
          avatarUrl: getDisplayAvatar(b.repo_url, b.avatarUrl),
          repoDescription: b.repoDescription || '',
          isArchived: b.isArchived || false,
          isPreRelease: b.isPreRelease || false,
        }
      } else {
        const g = grouped[b.bundle]
        if (b.version && !g.version) g.version = b.version
        if (!g.channels.includes(b.channel)) g.channels.push(b.channel)
        if (!g.patches_name && b.patches_name) g.patches_name = b.patches_name
        if ((b.stars || 0) > (g.stars || 0)) g.stars = b.stars
        const bAv = getDisplayAvatar(b.repo_url, b.avatarUrl)
        if (bAv && !g.avatarUrl) g.avatarUrl = bAv
        if (b.repoDescription && !g.repoDescription) g.repoDescription = b.repoDescription
        if (b.isArchived) g.isArchived = true
        if (b.isPreRelease) g.isPreRelease = true
        const existingPkgs = new Set(g.apps.map((a) => a.package))
        for (const app of b.apps || []) {
          if (!existingPkgs.has(app.package)) {
            g.apps.push(app)
            existingPkgs.add(app.package)
          }
        }
      }
    }

    let list = Object.values(grouped)

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter((b) => {
        if (b.bundle.toLowerCase().includes(q)) return true
        if (b.patches_name?.toLowerCase().includes(q)) return true
        return b.apps?.some(
          (app) =>
            resolveAppName(app, nameCache).toLowerCase().includes(q) ||
            app.package.toLowerCase().includes(q),
        )
      })
    }

    // Sort
    const sortBy = sortSelect.value || 'name'
    if (sortBy === 'name') {
      list = sortBundleNames(list)
    } else {
      list.sort((a, b) => {
        if (sortBy === 'stars') return (b.stars || 0) - (a.stars || 0)
        if (sortBy === 'apps') return (b.apps?.length || 0) - (a.apps?.length || 0)
        if (sortBy === 'version') return (b.version || '').localeCompare(a.version || '')
        return 0
      })
    }

    if (list.length === 0) {
      grid.appendChild(el('div', { class: 'loading-state' }, ['No matching Morphe bundles found.']))
      return
    }

    // Progressive rendering
    let rendered = 0
    const BATCH = 12
    const total = list.length

    function renderBatch() {
      const end = Math.min(rendered + BATCH, total)
      for (let i = rendered; i < end; i++) {
        grid.appendChild(renderBundleCard(list[i]))
      }
      rendered = end
      if (rendered < total) {
        requestAnimationFrame(renderBatch)
      }
    }

    renderBatch()
  }

  sortSelect.addEventListener('change', renderList)
  renderList()

  return section
}
