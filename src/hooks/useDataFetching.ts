const VERBOSE = import.meta.env.DEV || window.location.hostname === 'localhost'

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[useDataFetching]', ...args)
}

import { useEffect } from 'react'
import { useAppContext, type AppAction } from '../context/AppContext'
import { idbGet, idbSet, idbDeleteMany } from '../services/indexedDB'
import {
  fetchCore,
  fetchStats,
  fetchChanges,
  fetchChangelog,
  fetchAllData,
  fetchLastChecked,
  fetchIconCache,
  fetchNameCache,
  fetchBundlesIncremental,
  fetchBundlesBatched,
  fetchBundleIndex,
} from '../services/fetchData'
import type { BundleIndexEntry } from '../services/fetchData'
import { preloadIcons } from '../services/iconCache'
import { notifyWatchedUpdates } from '../services/watchlist'
import { CACHE_KEYS, APP_VERSION, APP_VERSION_KEY } from '../types/utils'
import { limitChangelogDays } from '../utils/changelog'
import type { ChangelogEntry } from '../types/changelog'

let loadedOnce = false
let loadPromise: Promise<void> | null = null
let lastIconCacheSize = 0
let lastNameCacheSize = 0

async function migrateIfNeeded(): Promise<boolean> {
  const stored = localStorage.getItem(APP_VERSION_KEY)
  if (stored === APP_VERSION) return false
  log(`[migrate] version mismatch (stored=${stored}, current=${APP_VERSION}), clearing cache...`)
  await idbDeleteMany([CACHE_KEYS.LIVE, CACHE_KEYS.ICONS, CACHE_KEYS.NAMES, CACHE_KEYS.CHANGELOG, CACHE_KEYS.BUNDLE_INDEX])
  localStorage.removeItem('morphe_versions')
  localStorage.setItem(APP_VERSION_KEY, APP_VERSION)
  log('[migrate] cache cleared, version updated')
  return true
}

async function fetchIconAndNameCaches(dispatch: React.Dispatch<AppAction>) {
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading icons...' })
  log('[icons] fetching icon cache...')
  const iconData = await fetchIconCache()
  const iconCount = Object.keys(iconData).length
  log(`icon cache: ${iconCount} entries`)
  dispatch({ type: 'SET_ICON_CACHE', payload: iconData })
  if (iconCount !== lastIconCacheSize) {
    idbSet(CACHE_KEYS.ICONS, iconData)
    lastIconCacheSize = iconCount
    log(`  ✓ saved ${iconCount} icons to IDB`)
  } else {
    log(`  ✓ icon cache unchanged (${iconCount}), skipping IDB write`)
  }

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading app names...' })
  log('[names] fetching name cache...')
  const nameData = await fetchNameCache()
  const nameCount = nameData ? Object.keys(nameData).length : 0
  if (nameData && nameCount > 0) {
    dispatch({ type: 'SET_NAME_CACHE', payload: nameData })
    if (nameCount !== lastNameCacheSize) {
      idbSet(CACHE_KEYS.NAMES, nameData)
      lastNameCacheSize = nameCount
      log(`  ✓ saved ${nameCount} names to IDB`)
    } else {
      log(`  ✓ name cache unchanged (${nameCount}), skipping IDB write`)
    }
  } else {
    log('  ✓ name cache empty')
  }
  return iconData
}

function startIconPreload(
  iconData: Record<string, string>,
  dispatch: React.Dispatch<AppAction>,
  priorityPkgs?: string[],
) {
  log('[icons] loading icons...')
  preloadIcons(iconData, (loaded, total) => {
    log(`[icons] ${loaded}/${total} icons loaded`)
  }, priorityPkgs?.length ? priorityPkgs : undefined).then(() => {
    log('[icons] all icons loaded')
  }).finally(() => {
    dispatch({ type: 'SET_ICONS_READY', payload: true })
  })
}

async function runLoad(dispatch: React.Dispatch<AppAction>) {
  log('loadData started')
  dispatch({ type: 'SET_LOADING', payload: true })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 })
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Initializing...' })
  log('[init] starting data load...')

  try {
  // Version migration: clear stale caches on first visit after deploy
  const migrated = await migrateIfNeeded()

  log('checking IndexedDB cache...')
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Checking cache...' })
  log('[cache] reading IndexedDB...')
  const [cachedLive, cachedIcons, cachedNames, cachedChangelog, cachedBundleIndex] = await Promise.all([
    idbGet<any>(CACHE_KEYS.LIVE),
    idbGet<Record<string, string>>(CACHE_KEYS.ICONS),
    idbGet<Record<string, string>>(CACHE_KEYS.NAMES),
    idbGet<ChangelogEntry[]>(CACHE_KEYS.CHANGELOG),
    idbGet<Record<string, BundleIndexEntry>>(CACHE_KEYS.BUNDLE_INDEX),
  ])
  log(`IndexedDB: live=${!!cachedLive}, icons=${!!cachedIcons}, names=${!!cachedNames}, bundleIndex=${!!cachedBundleIndex}`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 8 })

  const hasCache = cachedLive && cachedIcons

  // ── Render from cache immediately ──
  if (hasCache) {
    log('rendering from IndexedDB cache...')
    dispatch({ type: 'SET_BUNDLES', payload: cachedLive.bundles || {} })
    dispatch({ type: 'SET_ICON_CACHE', payload: cachedIcons })
    if (cachedNames) dispatch({ type: 'SET_NAME_CACHE', payload: cachedNames })
    if (cachedChangelog) {
      dispatch({ type: 'SET_CHANGELOG', payload: limitChangelogDays(cachedChangelog) })
      idbSet(CACHE_KEYS.CHANGELOG, limitChangelogDays(cachedChangelog))
    }
    dispatch({ type: 'SET_STATS', payload: cachedLive.stats || null })
    dispatch({ type: 'SET_CHANGES', payload: cachedLive.changes || null })
    dispatch({
      type: 'SET_METADATA',
      payload: {
        liveDataDate: cachedLive.date || '',
        lastChecked: cachedLive.lastChecked || cachedLive.last_run || '',
      },
    })
    log('[cache] loaded cached data from IndexedDB')
  } else {
    log('no IndexedDB cache available — first visit')
  }
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 15 })

  if (!hasCache) {
    // ═══════════════════════════════════════════
    //  FIRST VISIT — Progressive Load
    // ═══════════════════════════════════════════
    log('=== FIRST VISIT: progressive load ===')

    // Fire-and-forget: icons + names (don't block loading screen)
    const iconDataPromise = fetchIconAndNameCaches(dispatch)

    // Fire-and-forget: changelog + lastChecked
    const changelogPromise = fetchChangelog().then((rawCl) => {
      const cl = limitChangelogDays(rawCl as ChangelogEntry[])
      dispatch({ type: 'SET_CHANGELOG', payload: cl })
      idbSet(CACHE_KEYS.CHANGELOG, cl)
      log(`  ✓ changelog (${cl.length} entries)`)
      return cl
    })

    // Phase 1: Core + stats + changes (tiny files, show real content fast)
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching data...' })
    log('[fetch] core.json + stats.json + changes.json (parallel)')
    const [core, stats, changes] = await Promise.all([fetchCore(), fetchStats(), fetchChanges()])
    log(`core fetched: date=${core?.date}`)
    log(`stats fetched, changes: ${changes?.affected_bundles?.length ?? 0} affected`)
    dispatch({ type: 'SET_STATS', payload: stats || null })
    dispatch({ type: 'SET_CHANGES', payload: changes || null })
    notifyWatchedUpdates(changes)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 25 })

    const lastChecked = core?.lastChecked || core?.last_run || ''
    dispatch({ type: 'SET_METADATA', payload: { liveDataDate: core?.date || '', lastChecked } })

    // Phase 2: Bundles — batched with streaming progress
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching bundles...' })
    log('[fetch] loading bundles in batches...')
    const { bundles, errors: bundleErrors } = await fetchBundlesBatched((loaded, total, batchBundles) => {
      log(`[bundles] ${loaded}/${total} loaded`)
      const pct = 25 + Math.round((loaded / total) * 65)
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: pct })
      // Stream partial bundles to state so UI renders progressively
      dispatch({ type: 'MERGE_BUNDLES', payload: batchBundles })
    })
    const bundleCount = Object.keys(bundles).length
    log(`  ✓ ${bundleCount} bundles`)

    // Phase 3: Final state update + dismiss loading
    dispatch({ type: 'SET_BUNDLES', payload: bundles })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading complete!' })

    // Collect fetch errors
    const allErrors = [...bundleErrors]
    dispatch({ type: 'SET_FETCH_ERRORS', payload: allErrors })

    // Dismiss loading screen — don't wait for icons/changelog
    dispatch({ type: 'SET_LOADING', payload: false })

    // Background: wait for fire-and-forget promises, then cache to IDB
    const [iconData, rawCl] = await Promise.all([iconDataPromise, changelogPromise])
    startIconPreload(iconData, dispatch)
    const bundleIndex = await fetchBundleIndex()
    const livePayload = {
      date: core?.date || '',
      last_run: core?.last_run || '',
      lastChecked,
      stats,
      changes,
      bundles,
    }
    idbSet(CACHE_KEYS.LIVE, livePayload)
    idbSet(CACHE_KEYS.CHANGELOG, rawCl ? limitChangelogDays(rawCl as ChangelogEntry[]) : [])
    idbSet(CACHE_KEYS.BUNDLE_INDEX, bundleIndex)
    log(`[done] first visit complete — ${bundleCount} bundles`)
    return
  }

  // ═══════════════════════════════════════════
  //  RETURNING VISIT — Smart Conditional Fetch
  // ═══════════════════════════════════════════
  log('=== RETURNING VISIT: smart conditional fetch ===')

  // Fire-and-forget: icons + names (don't block loading screen)
  const iconDataPromise = fetchIconAndNameCaches(dispatch)

  // Phase 1: Check core.json to see if data changed
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Checking for updates...' })
  log('[check] fetching core.json to compare timestamps...')
  const core = await fetchCore()
  const cachedRun = cachedLive.last_run || ''
  const freshRun = core?.last_run || ''
  log(`cached last_run: "${cachedRun}", fresh last_run: "${freshRun}"`)
  log(`[check] cached=${cachedRun || 'none'}, fresh=${freshRun || 'none'}`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 20 })

  if (freshRun && freshRun === cachedRun) {
    // ── Same data, nothing to update ──
    log('data is up to date, skipping fetch')
    log('[check] ✓ data is current, no fetch needed')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Up to date!' })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING', payload: false })
    // Still wait for icons in background
    iconDataPromise.then((iconData) => startIconPreload(iconData, dispatch))
    return
  }

  // ── New data available — fetch diffs ──
  log('new data detected, fetching updates...')
  log('[update] new data detected, fetching diffs...')

  // Fire-and-forget: changelog
  const changelogPromise = fetchChangelog().then((rawCl) => {
    const cl = limitChangelogDays(rawCl as ChangelogEntry[])
    dispatch({ type: 'SET_CHANGELOG', payload: cl })
    idbSet(CACHE_KEYS.CHANGELOG, cl)
    log(`  ✓ changelog (${cl.length} entries)`)
    return cl
  })

  // Phase 2: Stats + changes (lightweight)
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching updates...' })
  log('[fetch] stats.json + changes.json')
  const [stats, changes] = await Promise.all([fetchStats(), fetchChanges()])
  log(`stats fetched, changes: ${changes?.affected_bundles?.length ?? 0} affected`)
  log(`  ✓ changes (${changes?.affected_bundles?.length ?? 0} affected bundles)`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 40 })

  const lastChecked = core?.lastChecked || core?.last_run || ''

  // Phase 3: Incremental bundle fetch — only changed versions
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Updating bundles...' })
  log('[fetch] comparing bundle index...')
  const { bundles, index: newIndex } = await fetchBundlesIncremental(
    cachedLive.bundles || {},
    cachedBundleIndex,
    (loaded, total) => {
      log(`[bundles] ${loaded}/${total} updated`)
      const pct = 40 + Math.round((loaded / total) * 50)
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: pct })
    },
  )
  const bundleCount = Object.keys(bundles).length
  log(`bundles after incremental: ${bundleCount}`)
  log(`  ✓ ${bundleCount} bundles (incremental update)`)

  // Phase 4: Update state + dismiss loading
  dispatch({ type: 'SET_BUNDLES', payload: bundles })
  dispatch({ type: 'SET_STATS', payload: stats || null })
  dispatch({ type: 'SET_CHANGES', payload: changes || null })
  notifyWatchedUpdates(changes)
  dispatch({
    type: 'SET_METADATA',
    payload: { liveDataDate: core?.date || '', lastChecked },
  })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading complete!' })

  // Dismiss loading screen — don't wait for icons/changelog
  dispatch({ type: 'SET_LOADING', payload: false })

  // Background: wait for fire-and-forget promises, then cache to IDB
  const [iconData] = await Promise.all([iconDataPromise, changelogPromise])
  const priorityPkgs: string[] = []
  if (changes?.affected_bundles?.length) {
    for (const ab of changes.affected_bundles) {
      for (const a of ab.apps || []) {
        if (a.package) priorityPkgs.push(a.package)
      }
    }
  }
  startIconPreload(iconData, dispatch, priorityPkgs)

  const livePayload = {
    date: core?.date || '',
    last_run: core?.last_run || '',
    lastChecked,
    stats,
    changes,
    bundles,
  }
  idbSet(CACHE_KEYS.LIVE, livePayload)
  idbSet(CACHE_KEYS.BUNDLE_INDEX, newIndex)
  log(`[done] update complete — ${bundleCount} bundles`)
  } catch (err) {
    console.error('[useDataFetching] runLoad failed:', err)
    log('loadData FAILED — clearing loading screen')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Error loading data' })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING', payload: false })
  }
}

export function useDataFetching() {
  const { state, dispatch } = useAppContext()

  useEffect(() => {
    if (loadedOnce) return
    if (!loadPromise) {
      loadPromise = runLoad(dispatch)
      loadPromise.finally(() => {
        loadedOnce = true
        loadPromise = null
      })
    }
  }, [dispatch])

  useEffect(() => {
    const handler = () => {
      log('DATA_UPDATED message received from SW, refreshing...')
      const data = fetchAllData()
      const cl = fetchChangelog()
      const lc = fetchLastChecked()
      Promise.all([data, cl, lc]).then(([d, c, l]) => {
        log('SW refresh complete')
        dispatch({ type: 'SET_BUNDLES', payload: d.bundles || {} })
        dispatch({ type: 'SET_STATS', payload: d.stats || null })
        dispatch({ type: 'SET_CHANGES', payload: d.changes || null })
        notifyWatchedUpdates(d.changes)
        const limitedCl = limitChangelogDays((c as ChangelogEntry[]) || [])
        dispatch({ type: 'SET_CHANGELOG', payload: limitedCl })
        const lastChecked = l || d.lastChecked || ''
        dispatch({
          type: 'SET_METADATA',
          payload: { liveDataDate: d.date || '', lastChecked },
        })
        dispatch({ type: 'SET_FETCH_ERRORS', payload: d.errors || [] })
        idbSet(CACHE_KEYS.LIVE, d)
        idbSet(CACHE_KEYS.CHANGELOG, limitedCl)
      })
    }
    navigator.serviceWorker?.addEventListener('message', (msg) => {
      if (msg.data?.type === 'DATA_UPDATED') handler()
    })
    return () => navigator.serviceWorker?.removeEventListener('message', handler as unknown as EventListener)
  }, [dispatch])

  return { loading: state.loading }
}
