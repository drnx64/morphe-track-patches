/**
 * Changelog page — historical changelog with pagination.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { renderAppIcon } from '../utils/misc.js'
import { escHtml } from '../utils/html.js'

export function renderChangelog(container) {
  const page = el('div', { class: 'changelog-page' })
  page.appendChild(el('h2', { class: 'section-title' }, ['Changelog']))

  const changelog = store.get('changelog') || []

  if (changelog.length === 0) {
    mount(container, el('div', { class: 'loading-state' }, ['No changelog data available.']))
    return
  }

  const DAYS_PER_PAGE = 7
  let currentPage = 0
  const totalPages = Math.ceil(changelog.length / DAYS_PER_PAGE)

  const contentArea = el('div', { class: 'changelog-content' })
  const pagination = el('div', { class: 'changelog-pagination' })

  page.appendChild(contentArea)
  page.appendChild(pagination)
  mount(container, page)

  function renderPage() {
    contentArea.replaceChildren()
    pagination.replaceChildren()

    const iconCache = store.get('iconCache') || {}
    const start = currentPage * DAYS_PER_PAGE
    const end = Math.min(start + DAYS_PER_PAGE, changelog.length)
    const pageDays = changelog.slice(start, end)

    for (const day of pageDays) {
      const dayEl = el('div', { class: 'changelog-day' })
      dayEl.appendChild(el('h3', { class: 'changelog-date' }, [day.date]))

      for (const bundle of day.affected_bundles || []) {
        const bundleEl = el('div', { class: 'changelog-bundle' })
        bundleEl.appendChild(el('span', { class: 'changelog-bundle-name' }, [bundle.patches_name || bundle.bundle]))

        for (const app of bundle.apps || []) {
          const appEl = el('div', { class: 'changelog-app' })
          const badgeClass = app.badge_type ? `badge--${app.badge_type.toLowerCase().replace(/\s+/g, '-')}` : ''
          const iconHtml = renderAppIcon(app, iconCache, 'sm')
          appEl.innerHTML = `
            ${app.badge_type ? `<span class="badge ${badgeClass}">${escHtml(app.badge_type)}</span>` : ''}
            ${iconHtml}
            <span class="changelog-app-name">${escHtml(app.app_name || app.package)}</span>
          `
          bundleEl.appendChild(appEl)
        }
        dayEl.appendChild(bundleEl)
      }
      contentArea.appendChild(dayEl)
    }

    // Pagination
    if (totalPages > 1) {
      if (currentPage > 0) {
        const prevBtn = el('button', { class: 'pagination-btn' }, ['← Previous'])
        prevBtn.addEventListener('click', () => { currentPage--; renderPage() })
        pagination.appendChild(prevBtn)
      }
      pagination.appendChild(el('span', { class: 'pagination-info' }, [`Page ${currentPage + 1} of ${totalPages}`]))
      if (currentPage < totalPages - 1) {
        const nextBtn = el('button', { class: 'pagination-btn' }, ['Next →'])
        nextBtn.addEventListener('click', () => { currentPage++; renderPage() })
        pagination.appendChild(nextBtn)
      }
    }
  }

  renderPage()
}
