/**
 * Header — nav tabs, title, search.
 */
import { el } from '../ui.js'
import * as store from '../store.js'
import * as router from '../router.js'

const NAV_TABS = [
  { path: '#/', label: 'Apps', exact: true },
  { path: '#/changelog', label: 'Changelog' },
  { path: '#/bundles', label: 'Bundles' },
  { path: '#/diff', label: 'Bundle Diff' },
]

export function renderHeader() {
  const nav = el('div', { class: 'header-content' }, [
    el('div', { class: 'header-top-row' }, [
      el('div', { class: 'header-title-group' }, [
        el('h1', { id: 'main-title', class: 'header-title-clickable', title: 'Double-click to toggle reduced motion' }, ['Morphe Tracker']),
        el('p', { class: 'subtitle' }, ['Patch monitoring & changelog dashboard']),
      ]),
      el('div', { class: 'header-right-row', id: 'header-actions' }),
    ]),
    el('nav', { class: 'app-nav', 'aria-label': 'Main navigation', id: 'app-nav' }),
  ])

  // Nav tabs
  const navEl = nav.querySelector('#app-nav')
  for (const tab of NAV_TABS) {
    const link = el('a', { href: tab.path, class: 'nav-tab' }, [tab.label])
    navEl.appendChild(link)
  }

  // Title double-click → toggle reduced motion
  const title = nav.querySelector('#main-title')
  title.addEventListener('dblclick', () => {
    const next = !store.get('reducedMotion')
    store.set('reducedMotion', next)
    localStorage.setItem('morphe_reduced_motion', String(next))
  })

  return nav
}

export function updateActiveNav() {
  const hash = window.location.hash || '#/'
  const tabs = document.querySelectorAll('.nav-tab')
  for (const tab of tabs) {
    const href = tab.getAttribute('href')
    const isActive = hash === href || (href !== '#/' && hash.startsWith(href))
    tab.classList.toggle('active', isActive)
  }
}

// Listen for hash changes to update active tab
window.addEventListener('hashchange', updateActiveNav)
