/**
 * Apps page — today's updates + directory of all apps across bundles.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { buildAppIndex, resolveAppName, getAppIconUrl, renderAppIcon } from '../utils/misc.js'
import { getPlayStoreUrl } from '../utils/url.js'
import { escHtml } from '../utils/html.js'
import { renderTodayUpdates } from './todayUpdates.js'

export function renderApps(container) {
  const page = el('div', { class: 'apps-page' })

  // Today's updates (hero section on apps page)
  page.appendChild(renderTodayUpdates())

  // Apps directory
  const header = el('div', { class: 'apps-header' }, [
    el('h2', { class: 'section-title' }, ['Apps Directory']),
  ])

  const searchInput = el('input', {
    type: 'text',
    class: 'apps-search-input',
    placeholder: 'Search apps by name or package...',
    'aria-label': 'Search apps',
  })

  const clearBtn = el('button', {
    class: 'search-bar-clear',
    'aria-label': 'Clear search',
    style: { display: 'none' },
  }, ['✕'])

  const searchRow = el('div', { class: 'search-row' }, [searchInput, clearBtn])

  const grid = el('div', { class: 'apps-grid', id: 'apps-grid' })

  page.appendChild(header)
  page.appendChild(searchRow)
  page.appendChild(grid)
  mount(container, page)

  // Build app index
  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}
  const appIndex = buildAppIndex(bundles, nameCache, iconCache)

  function renderAppsList(query = '') {
    grid.replaceChildren()
    let list = appIndex
    if (query) {
      const q = query.toLowerCase()
      list = list.filter((app) =>
        app.name.toLowerCase().includes(q) || app.package.toLowerCase().includes(q)
      )
    }

    if (list.length === 0) {
      grid.appendChild(el('div', { class: 'loading-state' }, ['No apps found.']))
      return
    }

    let rendered = 0
    const BATCH = 24
    function renderBatch() {
      const end = Math.min(rendered + BATCH, list.length)
      for (let i = rendered; i < end; i++) {
        const app = list[i]
        const card = el('div', { class: 'app-card' })
        const iconCache = store.get('iconCache') || {}
        const iconHtml = renderAppIcon({ package: app.package, app_name: app.name }, iconCache)

        const bundleNames = app.bundles.map((b) => b.patchesName || b.bundleName).join(', ')
        card.innerHTML = `
          <div class="app-card-main">
            ${iconHtml}
            <div class="app-card-info">
              <span class="app-card-name">${escHtml(app.name)}</span>
              <span class="app-card-pkg">${escHtml(app.package)}</span>
              <span class="app-card-bundles">Bundles: ${escHtml(bundleNames)}</span>
            </div>
          </div>
        `
        card.style.cursor = 'pointer'
        card.setAttribute('role', 'button')
        card.setAttribute('tabindex', '0')
        card.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('open-app', {
            detail: {
              app: { package: app.package, app_name: app.name },
              bundleName: app.bundles[0]?.bundleName || '',
              channels: app.bundles[0]?.channels || [],
            },
          }))
        })
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('open-app', {
              detail: {
                app: { package: app.package, app_name: app.name },
                bundleName: app.bundles[0]?.bundleName || '',
                channels: app.bundles[0]?.channels || [],
              },
            }))
          }
        })
        grid.appendChild(card)
      }
      rendered = end
      if (rendered < list.length) requestAnimationFrame(renderBatch)
    }
    renderBatch()
  }

  renderAppsList()

  let debounceTimer
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const hasValue = searchInput.value.length > 0
    clearBtn.style.display = hasValue ? '' : 'none'
    debounceTimer = setTimeout(() => renderAppsList(searchInput.value), 200)
  })

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    clearBtn.style.display = 'none'
    renderAppsList('')
    searchInput.focus()
  })

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = ''
      clearBtn.style.display = 'none'
      renderAppsList('')
    }
  })
}
