/**
 * MorpheTracker — Vanilla JS Entry Point
 * Boot: init store, load data, register routes, render shell.
 */

// ── Verbose Logging with Colors ──
const _LOG_COLORS = { log: '#948d81', info: '#6b9fd4', warn: '#d4a06b', error: '#b5533f', debug: '#a281ad' }
for (const [method, color] of Object.entries(_LOG_COLORS)) {
  const orig = console[method].bind(console)
  console[method] = (...args) => orig(`%c[Morphe]`, `color:${color};font-weight:bold`, ...args)
}
window.addEventListener('error', (e) => console.error('Uncaught:', e.message, e.filename, e.lineno, e.error))
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled promise:', e.reason))

// ── Theme ──
const savedTheme = localStorage.getItem('morphe_theme') || 'light'
document.documentElement.setAttribute('data-theme', savedTheme)

function updateThemeMeta(theme) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#14120f' : '#f5f3f0'
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('morphe_theme', next)
  updateThemeMeta(next)
  const btn = document.querySelector('.theme-toggle')
  if (btn) btn.innerHTML = next === 'dark' ? MOON_ICON : SUN_ICON
}

const SUN_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
const MOON_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'

import * as store from './store.js'
import * as router from './router.js'
import { el, mount } from './ui.js'
import { openAppDetailModal } from './components/appDetailModal.js'
import { openBundleHistoryModal } from './components/bundleHistoryModal.js'
import { preloadIcons } from './services/iconCache.js'

const SITE_URL = 'https://drnx64.github.io/morphe-tracker'

// ── Default State ──
store.init({
  bundles: {},
  iconCache: {},
  nameCache: {},
  changelog: [],
  liveDataDate: '',
  lastChecked: '',
  stats: null,
  changes: null,
  loading: true,
  loadingProgress: 0,
  loadingStatus: 'Initializing...',
  filters: { search: '', channel: 'all', hideArchived: false, hidePreRelease: false },
  viewMode: localStorage.getItem('morphe_view') || 'grid',
  changelogViewMode: localStorage.getItem('morphe_changelog_view') || 'grid',
  updatesViewMode: localStorage.getItem('morphe_updates_view') || 'timeline',
  lastVisitScan: localStorage.getItem('morphe_last_visit_scan') || '',
  fetchErrors: [],
  reducedMotion: localStorage.getItem('morphe_reduced_motion') === 'true',
  liveClockUTC: '',
  liveClockLocal: '',
})

// ── Page Modules (lazy-loaded) ──
const pages = {
  dashboard: () => import('./pages/dashboard.js'),
  apps: () => import('./pages/apps.js'),
  bundleDetail: () => import('./pages/bundleDetail.js'),
  changelog: () => import('./pages/changelog.js'),
  diff: () => import('./pages/diff.js'),
}

// ── Nav Tabs Config ──
const NAV_TABS = [
  { path: '#/', label: 'Apps', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>' },
  { path: '#/changelog', label: 'Changelog', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/></svg>' },
  { path: '#/bundles', label: 'Bundles', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/></svg>' },
  { path: '#/diff', label: 'Diff', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v4"/><path d="M16 3v4"/><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 14l3 3 5-6"/></svg>' },
]

// ── Shell Layout ──
function renderShell() {
  const root = document.getElementById('root')

  // Header with title + desktop nav
  const header = el('header', { class: 'app-header' }, [
    el('div', { class: 'header-content' }, [
      el('div', { class: 'header-top-row' }, [
        el('div', { class: 'header-title-group' }, [
          el('h1', { id: 'main-title', class: 'header-title-clickable', title: 'Double-click to toggle reduced motion' }, ['MorpheTracker']),
          el('span', { class: 'subtitle' }, ['Patch monitoring & changelog dashboard']),
        ]),
        el('div', { class: 'header-right-row', id: 'header-actions' }),
      ]),
      el('nav', { class: 'app-nav', id: 'app-nav', 'aria-label': 'Main navigation' }),
    ]),
  ])

  // Populate desktop nav tabs
  const navEl = header.querySelector('#app-nav')
  for (const tab of NAV_TABS) {
    const link = el('a', { href: tab.path, class: 'nav-tab' }, [tab.label])
    navEl.appendChild(link)
  }

  // Title double-click → toggle reduced motion
  const title = header.querySelector('#main-title')
  title.addEventListener('dblclick', () => {
    const next = !store.get('reducedMotion')
    store.set('reducedMotion', next)
    localStorage.setItem('morphe_reduced_motion', String(next))
  })

  // Theme toggle button
  const themeBtn = el('button', {
    class: 'theme-toggle',
    'aria-label': 'Toggle dark mode',
    title: 'Toggle theme',
    dangerouslySetInnerHTML: savedTheme === 'dark' ? MOON_ICON : SUN_ICON,
  })
  themeBtn.addEventListener('click', toggleTheme)
  header.querySelector('#header-actions').appendChild(themeBtn)

  const pageContainer = el('main', { id: 'page-container', class: 'page-container dashboard-page' })

  const footer = el('footer', { class: 'app-footer' }, [
    el('div', { class: 'footer-inner' }, [
      el('div', { class: 'footer-links' }, [
        el('a', { href: `${SITE_URL}/feed.xml`, target: '_blank', rel: 'noopener' }, ['RSS Feed']),
        el('span', { class: 'footer-sep' }, ['|']),
        el('a', { href: 'https://github.com/drnx64/morphe-tracker', target: '_blank', rel: 'noopener' }, ['GitHub']),
      ]),
      el('p', { class: 'footer-disclaimer' }, [
        'MorpheTracker is not affiliated with or endorsed by any app developers.',
      ]),
    ]),
  ])

  // Bottom tab bar (mobile)
  const bottomNav = el('nav', { class: 'bottom-nav', id: 'bottom-nav', 'aria-label': 'Primary navigation' })
  for (const tab of NAV_TABS) {
    const link = el('a', { href: tab.path, class: 'nav-tab' }, [
      el('span', { dangerouslySetInnerHTML: tab.icon }),
      el('span', {}, [tab.label]),
    ])
    bottomNav.appendChild(link)
  }

  mount(root, [header, pageContainer, footer, bottomNav])
}

// ── Routes ──
function setupRoutes() {
  router.addRoute('/', async () => {
    const { renderApps } = await pages.apps()
    renderApps(document.getElementById('page-container'))
  }, 'apps')

  router.addRoute('/bundles', async () => {
    const { renderDashboard } = await pages.dashboard()
    renderDashboard(document.getElementById('page-container'))
  }, 'dashboard')

  router.addRoute('/bundle/:bundleName', async (params) => {
    const { renderBundleDetail } = await pages.bundleDetail()
    renderBundleDetail(document.getElementById('page-container'), params.bundleName)
  }, 'bundleDetail')

  router.addRoute('/changelog', async () => {
    const { renderChangelog } = await pages.changelog()
    renderChangelog(document.getElementById('page-container'))
  }, 'changelog')

  router.addRoute('/diff', async () => {
    const { renderDiff } = await pages.diff()
    renderDiff(document.getElementById('page-container'))
  }, 'diff')

  router.setNotFound(() => {
    router.navigate('/')
  })
}

// ── Data Loading ──
async function loadData() {
  try {
    // Fetch core + stats + changes in parallel
    const ts = Date.now()
    const [coreRes, statsRes, changesRes] = await Promise.all([
      fetchJson(`data/core.json?_t=${ts}`),
      fetchJson(`data/stats.json?_t=${ts}`),
      fetchJson(`data/changes.json?_t=${ts}`),
    ])

    store.merge({
      liveDataDate: coreRes.date || '',
      lastChecked: coreRes.last_run || '',
      stats: statsRes,
      changes: changesRes,
    })

    // Load icon + name caches
    const cacheRes = await fetchJson('data/state/app_cache.json')
    const iconCache = {}
    const nameCache = {}
    for (const [pkg, entry] of Object.entries(cacheRes)) {
      if (entry && typeof entry === 'object') {
        if (entry.icon_url) iconCache[pkg] = entry.icon_url
        if (entry.name) nameCache[pkg] = entry.name
      }
    }
    store.merge({ iconCache, nameCache })

    // Background-warm icon cache (fetch, resize, store in IndexedDB)
    preloadIcons(iconCache).catch(() => {})

    // Load bundle index
    const index = await fetchJson('data/bundles/_index.json')
    const keys = Object.keys(index)
    if (keys.length === 0) {
      store.set('loading', false)
      return
    }

    // Load bundles in batches
    const BATCH = 50
    const bundles = {}
    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(async (key) => {
          const filename = key.replace(':', '_') + '.json'
          const data = await fetchJson(`data/bundles/${filename}`)
          return [key, data]
        })
      )
      for (const [key, data] of results) {
        if (data) bundles[key] = data
      }
    }

    store.set('bundles', bundles)

    // Load changelog
    const changelog = await fetchJson('data/changelog.json')
    store.set('changelog', Array.isArray(changelog) ? changelog : [])

    store.set('loading', false)

    // Record last visit for "new scan" detection
    const today = new Date().toISOString().split('T')[0]
    if (store.get('lastVisitScan') !== today) {
      localStorage.setItem('morphe_last_visit_scan', today)
      store.set('lastVisitScan', today)
    }
  } catch (err) {
    console.error('[app] Data loading failed:', err)
    store.set('fetchErrors', [...store.get('fetchErrors'), err.message])
    store.set('loading', false)
    // Show error state in page container
    const container = document.getElementById('page-container')
    if (container) {
      container.innerHTML = `
        <div class="error-page-overlay">
          <div class="error-page-box">
            <div class="error-page-icon">!</div>
            <h2 class="error-page-title">Failed to load data</h2>
            <p class="error-page-subtitle">${err.message || 'Network error'}</p>
            <div class="error-page-actions">
              <button class="error-page-btn error-page-btn-primary" onclick="location.reload()">Retry</button>
            </div>
          </div>
        </div>
      `
    }
  }
}

async function fetchJson(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`${url} returned ${resp.status}`)
  return resp.json()
}

// ── Active Nav State ──
function updateActiveNav() {
  const hash = window.location.hash || '#/'
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    const href = tab.getAttribute('href')
    if (!href) return
    const isActive = hash === href || (href !== '#/' && hash.startsWith(href))
    tab.classList.toggle('active', isActive)
    tab.setAttribute('aria-current', isActive ? 'page' : 'false')
  })
}
window.addEventListener('hashchange', updateActiveNav)

// ── Reduced Motion ──
function applyReducedMotion() {
  document.documentElement.classList.toggle('reduced-motion', store.get('reducedMotion'))
}
store.subscribe('reducedMotion', applyReducedMotion)

// ── Modal Event Listeners ──
window.addEventListener('open-app', (e) => {
  openAppDetailModal(e.detail)
})

window.addEventListener('open-bundle-history', (e) => {
  openBundleHistoryModal(e.detail.bundleName)
})

// ── URL Parameter Deep Linking ──
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search)
  const openApp = params.get('open-app')
  if (openApp) {
    const bundles = store.get('bundles') || {}
    const nameCache = store.get('nameCache') || {}
    // Find app by package across all bundles
    for (const [, bundle] of Object.entries(bundles)) {
      const appData = bundle.apps?.find((a) => a.package === openApp)
      if (appData) {
        const bKey = Object.keys(bundles).find((k) => bundles[k] === bundle)
        const bundleName = bKey?.replace(/:(stable|dev)$/, '') || ''
        openAppDetailModal({
          app: appData,
          bundleName,
          channels: [bundle.channel || 'stable'],
        })
        break
      }
    }
    // Clean URL
    history.replaceState(null, '', window.location.pathname + window.location.hash)
  }
}

// ── Boot ──
async function boot() {
  applyReducedMotion()
  renderShell()
  setupRoutes()
  updateActiveNav()

  // Load data in background, then start router
  loadData().then(() => {
    router.rerender()
    updateActiveNav()
    handleUrlParams()
  })

  // Also start router immediately so hash routes work while data loads
  router.start()
}

boot()
