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
import { openBundleModal } from './components/bundleModal.js'
import { renderGlobalSearch } from './components/globalSearch.js'
import { showWorkToast } from './components/workToast.js'
import { preloadAvatars } from './services/iconCache.js'
import { initIconQueue, runIconQueue } from './services/iconFetchQueue.js'
import { loadBundleState, saveBundleState } from './services/bundleCache.js'
import { SITE_URL, GITHUB_REPO_URL } from './utils/url.js'
import { parseBundleKey } from './utils/bundleKey.js'

// ── Default State ──
store.init({
  bundles: {},
  iconCache: {},
  nameCache: {},
  repoAvatarMap: {},
  repoBundleImageMap: {},
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
          el('div', { class: 'header-title-row' }, [
            el('img', { class: 'header-logo', src: 'public/tracker_logo.jpg', alt: '', width: '28', height: '28' }),
            el('h1', { id: 'main-title', class: 'header-title-clickable', title: 'Double-click to toggle reduced motion' }, ['MorpheTracker']),
          ]),
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

  // Global search bar
  const globalSearch = renderGlobalSearch()
  header.querySelector('#header-actions').prepend(globalSearch)

  // Theme toggle button
  const themeBtn = el('button', {
    class: 'theme-toggle',
    'aria-label': 'Toggle dark mode',
    title: 'Toggle theme',
    dangerouslySetInnerHTML: savedTheme === 'dark' ? MOON_ICON : SUN_ICON,
  })
  themeBtn.addEventListener('click', toggleTheme)
  header.querySelector('#header-actions').appendChild(themeBtn)

  // Boot progress bar — determinate top bar + status pill while loadData runs
  const bootProgress = el('div', {
    class: 'boot-progress',
    id: 'boot-progress',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': '0',
    'aria-label': 'Loading site data',
  }, [
    el('div', { class: 'boot-progress-track' }, [
      el('div', { class: 'boot-progress-fill', id: 'boot-progress-fill' }),
    ]),
    el('div', { class: 'boot-progress-status', id: 'boot-progress-status' }, [
      store.get('loadingStatus') || 'Starting…',
    ]),
  ])

  const pageContainer = el('main', { id: 'page-container', class: 'page-container dashboard-page' })

  const footer = el('footer', { class: 'app-footer' }, [
    el('div', { class: 'footer-inner' }, [
      el('div', { class: 'footer-links' }, [
        el('a', { href: `${SITE_URL}/feed.xml`, target: '_blank', rel: 'noopener' }, ['RSS Feed']),
        el('span', { class: 'footer-sep' }, ['|']),
        el('a', { href: GITHUB_REPO_URL, target: '_blank', rel: 'noopener' }, ['GitHub']),
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

  mount(root, [header, bootProgress, pageContainer, footer, bottomNav])

  // Drive the progress bar from store state (shell renders once — no leak)
  const progressFill = bootProgress.querySelector('#boot-progress-fill')
  const progressStatus = bootProgress.querySelector('#boot-progress-status')
  store.subscribe('loadingProgress', (progress) => {
    const clamped = Math.max(0, Math.min(100, progress))
    progressFill.style.width = `${clamped}%`
    bootProgress.setAttribute('aria-valuenow', String(Math.round(clamped)))
  })
  store.subscribe('loadingStatus', (status) => {
    progressStatus.textContent = status
  })
  store.subscribe('loading', (loading) => {
    if (!loading) bootProgress.classList.add('done')
  })
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
    const container = document.getElementById('page-container')
    mount(container, el('div', { class: 'loading-state' }, ['Loading changelog...']))
    await ensureChangelog()
    renderChangelog(container)
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
let deferredPreloads = null

// Lazily fetch the 2.75 MB changelog (only /changelog + history modal need it)
let changelogPromise = null
function ensureChangelog() {
  if (!changelogPromise) {
    changelogPromise = fetchJson('data/changelog.json')
      .then((data) => {
        store.set('changelog', Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error('[app] Changelog load failed:', err)
        changelogPromise = null
      })
  }
  return changelogPromise
}

function setBootProgress(progress, status) {
  store.set('loadingProgress', progress)
  if (status) store.set('loadingStatus', status)
}

function bundleFileUrl(key) {
  return `data/bundles/${key.replace(':', '_')}.json`
}

async function retryBundleFiles(failedKeys, bundles, toast, index) {
  toast.setActions([])
  toast.setDetail(`Retrying ${failedKeys.length} file${failedKeys.length !== 1 ? 's' : ''}…`)
  const stillFailed = []
  for (const key of failedKeys) {
    try {
      const data = await fetchJson(bundleFileUrl(key))
      if (data) {
        bundles[key] = { ...index[key], ...data }
      } else {
        stillFailed.push(key)
      }
    } catch {
      stillFailed.push(key)
    }
  }
  store.set('bundles', { ...bundles })

  if (stillFailed.length === 0) {
    saveBundleState(index, bundles)
    toast.finish(`Recovered ${failedKeys.length} file${failedKeys.length !== 1 ? 's' : ''}`)
    return
  }
  // Incomplete keys stay out of the cache index so they revalidate next boot
  const stillFailedSet = new Set(stillFailed)
  saveBundleState(
    Object.fromEntries(Object.entries(index).filter(([key]) => !stillFailedSet.has(key))),
    bundles,
  )
  toast.setDetail(`${stillFailed.length} file${stillFailed.length !== 1 ? 's' : ''} failed to load`)
  toast.setActions([
    { label: 'Retry', primary: true, onClick: () => retryBundleFiles(stillFailed, bundles, toast, index) },
    { label: 'Dismiss', onClick: () => toast.close() },
  ])
}

function offerBundleRetry(failedKeys, bundles, index) {
  const toast = showWorkToast('Bundle data')
  toast.setDetail(`${failedKeys.length} file${failedKeys.length !== 1 ? 's' : ''} failed to load`)
  toast.setActions([
    { label: 'Retry', primary: true, onClick: () => retryBundleFiles(failedKeys, bundles, toast, index) },
    { label: 'Dismiss', onClick: () => toast.close() },
  ])
}

function offerOfflineNotice() {
  const toast = showWorkToast('Data refresh failed')
  toast.setDetail('Showing cached data')
  toast.setActions([
    { label: 'Retry', primary: true, onClick: () => location.reload() },
    { label: 'Dismiss', onClick: () => toast.close() },
  ])
}

function finishBoot(status = 'Loading complete') {
  setBootProgress(100, status)
  store.set('loading', false)

  // Record last visit for "new scan" detection
  const today = new Date().toISOString().split('T')[0]
  if (store.get('lastVisitScan') !== today) {
    localStorage.setItem('morphe_last_visit_scan', today)
    store.set('lastVisitScan', today)
  }
}

function offerImageRetry(failedCount, runPass, toast) {
  const retry = async () => {
    toast.setActions([])
    toast.setDetail('Retrying…')
    try {
      const stillFailed = await runPass()
      if (stillFailed > 0) {
        offerImageRetry(stillFailed, runPass, toast)
      } else {
        toast.finish('Images cached')
      }
    } catch (err) {
      console.error('[app] Image retry failed:', err)
      toast.setDetail('Retry failed')
      toast.setActions([{ label: 'Dismiss', onClick: () => toast.close() }])
    }
  }
  toast.setDetail(`${failedCount} image${failedCount !== 1 ? 's' : ''} failed to cache`)
  toast.setActions([
    { label: 'Retry', primary: true, onClick: retry },
    { label: 'Dismiss', onClick: () => toast.close() },
  ])
}

// Background-warm the avatar cache, then the icon queue (viewport-first lane
// + paced sweep), reporting through one progress toast with retry on failures.
async function cacheImagesInBackground(iconMap, repoAvatarMap, repoBundleImageMap) {
  const iconTotal = Object.values(iconMap).filter((v) => typeof v === 'string' && v.startsWith('http')).length
  const avatarUrls = [...new Set(
    [...Object.values(repoAvatarMap), ...Object.values(repoBundleImageMap)]
      .filter((u) => u && typeof u === 'string' && !u.startsWith('data:')),
  )]
  if (!iconTotal && !avatarUrls.length) return

  const toast = showWorkToast('Caching images')

  const runPass = async () => {
    let failed = 0
    if (avatarUrls.length) {
      toast.setTitle('Caching avatars')
      const avRes = await preloadAvatars(avatarUrls, (loaded) => toast.setProgress(loaded, avatarUrls.length))
      failed += avRes.failed
    }
    if (iconTotal) {
      toast.setTitle('Caching icons')
      const iconRes = await runIconQueue((done, total) => toast.setProgress(done, total), { includeFailed: true })
      failed += iconRes.failed
    }
    return failed
  }

  try {
    const failed = await runPass()
    if (failed > 0) {
      offerImageRetry(failed, runPass, toast)
    } else {
      toast.finish('Images cached')
    }
  } catch (err) {
    console.error('[app] Image caching failed:', err)
    toast.setDetail('Image caching failed')
    toast.setActions([{ label: 'Dismiss', onClick: () => toast.close() }])
  }
}

async function loadData() {
  try {
    setBootProgress(5, 'Loading site data…')

    // Local cache first — full paint with zero bundle fetches while revalidating
    const cachedState = await loadBundleState()

    // Fetch core + stats + changes in parallel
    const ts = Date.now()
    let coreRes, statsRes, changesRes
    try {
      ;[coreRes, statsRes, changesRes] = await Promise.all([
        fetchJson(`data/core.json?_t=${ts}`),
        fetchJson(`data/stats.json?_t=${ts}`),
        fetchJson(`data/changes.json?_t=${ts}`),
      ])
    } catch (err) {
      if (cachedState) {
        store.set('bundles', { ...cachedState.records })
        deferredPreloads = null
        offerOfflineNotice()
        finishBoot('Offline — cached data')
        return
      }
      throw err
    }

    store.merge({
      liveDataDate: coreRes.date || '',
      lastChecked: coreRes.last_run || '',
      stats: statsRes,
      changes: changesRes,
    })
    setBootProgress(25, 'Loading caches…')

    // Instant full paint from cache while everything else loads
    if (cachedState) store.set('bundles', { ...cachedState.records })

    // Icon + name caches — degraded (fallback icons, resolved names) if missing
    const cacheRes = await fetchJson('data/state/app_cache.json', {})
    const iconCache = {}
    const nameCache = {}
    for (const [pkg, entry] of Object.entries(cacheRes)) {
      if (entry && typeof entry === 'object') {
        if (entry.icon_url) iconCache[pkg] = entry.icon_url
        if (entry.name) nameCache[pkg] = entry.name
      }
    }
    store.merge({ iconCache, nameCache })
    initIconQueue(iconCache)
    setBootProgress(35, 'Loading caches…')

    // Repo owner avatars (repo_cache.json → repo_url → avatarUrl)
    const repoCacheRes = await fetchJson('data/state/repo_cache.json', {})
    const repoAvatarMap = {}
    const repoBundleImageMap = {}
    if (repoCacheRes && typeof repoCacheRes === 'object') {
      for (const [repoUrl, entry] of Object.entries(repoCacheRes)) {
        if (entry && typeof entry === 'object' && entry.avatarUrl) {
          repoAvatarMap[repoUrl] = entry.avatarUrl
        }
        if (entry && typeof entry === 'object' && entry.bundleImageUrl) {
          repoBundleImageMap[repoUrl] = entry.bundleImageUrl
        }
      }
    }
    store.merge({ repoAvatarMap, repoBundleImageMap })

    // Background-warm icon + avatar caches. Deferred until after the bundle
    // fetch so they don't compete for connections.
    deferredPreloads = () => {
      cacheImagesInBackground(iconCache, repoAvatarMap, repoBundleImageMap).catch((err) => {
        console.error('[app] Image caching failed:', err)
      })
    }

    // Load bundle index (cached records were painted above)
    if (cachedState) {
      setBootProgress(45, 'Refreshing bundle index…')
    } else {
      setBootProgress(45, 'Loading bundle index…')
    }

    let index
    try {
      index = await fetchJson('data/bundles/_index.json')
    } catch (err) {
      if (cachedState) {
        deferredPreloads = null
        offerOfflineNotice()
        finishBoot('Using cached data')
        return
      }
      throw err
    }

    const keys = Object.keys(index)
    if (keys.length === 0) {
      finishBoot()
      return
    }

    // Revalidate per key: version match → trust cached file data; else fetch
    const cachedRecords = cachedState?.records || null
    const cachedIndex = cachedState?.index || null
    const bundles = {}
    const keysToFetch = []
    for (const key of keys) {
      const indexEntry = index[key]
      const cachedRecord = cachedRecords?.[key]
      if (cachedRecord && cachedIndex?.[key]?.version === indexEntry.version) {
        bundles[key] = { ...cachedRecord, ...indexEntry }
      } else {
        // New or changed — paint now (stale beats empty), file streams in below
        bundles[key] = cachedRecord ? { ...cachedRecord, ...indexEntry } : { ...indexEntry, apps: [] }
        keysToFetch.push(key)
      }
    }
    store.set('bundles', { ...bundles })
    setBootProgress(
      keysToFetch.length ? 50 : 95,
      keysToFetch.length ? `Loading bundles 0/${keysToFetch.length}` : 'Data up to date',
    )

    // Load changed bundles in batches — one bad file must not sink the page
    const BATCH = 50
    const failedKeys = []
    for (let i = 0; i < keysToFetch.length; i += BATCH) {
      const batch = keysToFetch.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(async (key) => {
          try {
            const data = await fetchJson(bundleFileUrl(key))
            return { key, data }
          } catch {
            return { key, data: null }
          }
        }),
      )
      for (const { key, data } of results) {
        if (data) {
          // Index carries card metadata files lack (stars, isArchived, …)
          bundles[key] = { ...index[key], ...data }
        } else {
          failedKeys.push(key)
          // Stale beats empty while the retry runs
          if (cachedRecords?.[key]) {
            bundles[key] = { ...cachedRecords[key], ...index[key] }
          }
        }
      }
      const done = Math.min(i + BATCH, keysToFetch.length)
      setBootProgress(
        50 + Math.round((45 * done) / keysToFetch.length),
        `Loading bundles ${done}/${keysToFetch.length}`,
      )
      store.set('bundles', { ...bundles })
    }

    if (failedKeys.length) offerBundleRetry(failedKeys, bundles, index)

    // Persist for next boot — incomplete keys excluded so they revalidate
    if (failedKeys.length) {
      const failedSet = new Set(failedKeys)
      saveBundleState(
        Object.fromEntries(Object.entries(index).filter(([key]) => !failedSet.has(key))),
        bundles,
      )
    } else {
      saveBundleState(index, bundles)
    }

    // Icon/avatar preloads now that the bundle fetch is done
    if (deferredPreloads) {
      deferredPreloads()
      deferredPreloads = null
    }

    finishBoot()
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

async function fetchJson(url, fallback) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      if (fallback !== undefined) return fallback
      throw new Error(`${url} returned ${resp.status}`)
    }
    return await resp.json()
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
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

window.addEventListener('open-bundle-history', async (e) => {
  await ensureChangelog()
  openBundleHistoryModal(e.detail.bundleName)
})

window.addEventListener('open-bundle', (e) => {
  openBundleModal(e.detail)
})

// ── URL Parameter Deep Linking ──
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search)
  const openApp = params.get('open-app')
  const patchName = params.get('patch')
  if (openApp) {
    const bundles = store.get('bundles') || {}
    const nameCache = store.get('nameCache') || {}
    // Find app by package across all bundles
    for (const [, bundle] of Object.entries(bundles)) {
      const appData = bundle.apps?.find((a) => a.package === openApp)
      if (appData) {
        const bKey = Object.keys(bundles).find((k) => bundles[k] === bundle)
        const bundleName = bKey ? parseBundleKey(bKey).name : ''
        openAppDetailModal({
          app: appData,
          bundleName,
          channels: [bundle.channel || 'stable'],
          patchName,
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
