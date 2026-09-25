/**
 * Dashboard page — stats, controls, bundles grid.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { renderStatsSection } from './statsSection.js'
import { renderControls } from './controls.js'
import { renderBundlesGrid } from './bundlesGrid.js'

let unsubscribe = null

function rerenderGrid(page) {
  const gridContainer = page.querySelector('#bundles-grid-container')
  if (gridContainer) {
    gridContainer.replaceChildren()
    gridContainer.appendChild(renderBundlesGrid().firstChild || el('div', {}, ['No bundles found.']))
  }
}

export function renderDashboard(container) {
  const page = el('div', { class: 'dashboard-page' })

  page.appendChild(renderStatsSection())
  page.appendChild(renderControls())
  page.appendChild(renderBundlesGrid())

  mount(container, page)

  // Re-subscribe on each visit; drop the previous page's subscriptions first
  if (unsubscribe) unsubscribe()
  const unsubBundles = store.subscribe('bundles', () => rerenderGrid(page))
  const unsubFilters = store.subscribe('filters', () => rerenderGrid(page))
  unsubscribe = () => {
    unsubBundles()
    unsubFilters()
  }
}
