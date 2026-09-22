/**
 * Dashboard page — stats, controls, bundles grid.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { renderStatsSection } from './statsSection.js'
import { renderControls } from './controls.js'
import { renderBundlesGrid } from './bundlesGrid.js'

export function renderDashboard(container) {
  const page = el('div', { class: 'dashboard-page' })

  page.appendChild(renderStatsSection())
  page.appendChild(renderControls())
  page.appendChild(renderBundlesGrid())

  mount(container, page)

  // Subscribe to state changes to re-render bundles
  store.subscribe('bundles', () => {
    const gridContainer = page.querySelector('#bundles-grid-container')
    if (gridContainer) {
      gridContainer.replaceChildren()
      gridContainer.appendChild(renderBundlesGrid().firstChild || el('div', {}, ['No bundles found.']))
    }
  })
}
