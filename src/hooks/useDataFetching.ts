const VERBOSE = import.meta.env.DEV

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[useDataFetching]', ...args)
}

import { useEffect } from 'react'
import { useAppContext, type AppAction } from '../context/AppContext'
import { idbGet, idbSet } from '../services/indexedDB'
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
import { CACHE_KEYS } from '../types/utils'
import { limitChangelogDays } from '../utils/changelog'
import type { ChangelogEntry } from '../types/changelog'

let loadedOnce = false
let loadPromise: Promise<void> | null = null

async function fetchIconAndNameCaches(dispatch: React.Dispatch<AppAction>) {
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading icons...' })
  log('[icons] fetching icon cache...')
  const iconData = await fetchIconCache()
  log(`icon cache: ${Object.keys(iconData).length} entries`)
  dispatch({ type: 'SET_ICON_CACHE', payload: iconData })
  idbSet(CACHE_KEYS.ICONS, iconData)
  log(`  ✓ ${Object.keys(iconData).length} icons`)

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading app names...' })
  log('[names] fetching name cache...')
  const nameData = await fetchNameCache()
  if (nameData && Object.keys(nameData).length > 0) {
    dispatch({ type: 'SET_NAME_CACHE', payload: nameData })
    idbSet(CACHE_KEYS.NAMES, nameData)
    log(`  ✓ ${Object.keys(nameData).length} app names`)
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

    // Phase 1: Icons + names (big caches)
    const iconData = await fetchIconAndNameCaches(dispatch)
    startIconPreload(iconData, dispatch)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 30 })

    // Phase 2: Core metadata
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching core data...' })
    log('[fetch] /data/core.json')
    const core = await fetchCore()
    log(`core fetched: date=${core?.date}`)
    log(`  ✓ core metadata (date: ${core?.date || 'unknown'})`)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 38 })

    // Phase 3: Stats + changes (small files)
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching statistics...' })
    const [stats, changes] = await Promise.all([fetchStats(), fetchChanges()])
    log(`stats fetched, changes: ${changes?.affected_bundles?.length ?? 0} affected`)
    log(`  ✓ stats + changes (${changes?.affected_bundles?.length ?? 0} affected)`)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 45 })

    // Phase 4: Changelog + last_run (small files)
    const [rawCl, lc] = await Promise.all([fetchChangelog(), fetchLastChecked()])
    const cl = limitChangelogDays(rawCl as ChangelogEntry[])
    const lastChecked = lc || core?.lastChecked || core?.last_run || ''
    dispatch({ type: 'SET_CHANGELOG', payload: cl })
    log(`  ✓ changelog (${cl.length} entries) + last_run`)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 50 })

    // Phase 5: Bundles — batched with progress
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching bundles...' })
    log('[fetch] loading bundles in batches...')
    const bundles = await fetchBundlesBatched((loaded, total) => {
      log(`[bundles] ${loaded}/${total} loaded`)
      const pct = 50 + Math.round((loaded / total) * 40)
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: pct })
    })
    const bundleCount = Object.keys(bundles).length
    log(`bundles fetched: ${bundleCount}`)
    log(`  ✓ ${bundleCount} bundles`)

    // Phase 6: Save everything
    dispatch({ type: 'SET_BUNDLES', payload: bundles })
    dispatch({ type: 'SET_STATS', payload: stats || null })
    dispatch({ type: 'SET_CHANGES', payload: changes || null })
    notifyWatchedUpdates(changes)
    dispatch({ type: 'SET_METADATA', payload: { liveDataDate: core?.date || '', lastChecked } })

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
    idbSet(CACHE_KEYS.CHANGELOG, cl)
    idbSet(CACHE_KEYS.BUNDLE_INDEX, bundleIndex)
    log(`[done] first visit complete — ${bundleCount} bundles`)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING', payload: false })
    return
  }

  // ═══════════════════════════════════════════
  //  RETURNING VISIT — Smart Conditional Fetch
  // ═══════════════════════════════════════════
  log('=== RETURNING VISIT: smart conditional fetch ===')

  // Phase 1: Icons + names (parallel, non-blocking feel)
  const iconDataPromise = fetchIconAndNameCaches(dispatch)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 20 })

  // Phase 2: Check core.json to see if data changed
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Checking for updates...' })
  log('[check] fetching core.json to compare dates...')
  const core = await fetchCore()
  const cachedDate = cachedLive.date || ''
  const freshDate = core?.date || ''
  log(`cached date: "${cachedDate}", fresh date: "${freshDate}"`)
  log(`[check] cached=${cachedDate || 'none'}, fresh=${freshDate || 'none'}`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 35 })

  // Wait for icon/name caches to finish fetching
  const iconData = await iconDataPromise

  if (freshDate && freshDate === cachedDate) {
    // ── Same data, nothing to update ──
    log('data is up to date, skipping fetch')
    log('[check] ✓ data is current, no fetch needed')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Up to date!' })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING', payload: false })
    return
  }

  // ── New data available — fetch diffs ──
  log('new data detected, fetching updates...')
  log('[update] new data detected, fetching diffs...')

  // Phase 3: Stats + changes (lightweight)
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching updates...' })
  log('[fetch] stats.json + changes.json')
  const [stats, changes] = await Promise.all([fetchStats(), fetchChanges()])
  log(`stats fetched, changes: ${changes?.affected_bundles?.length ?? 0} affected`)
  log(`  ✓ changes (${changes?.affected_bundles?.length ?? 0} affected bundles)`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 50 })

  // Phase 4: Changelog + last_run
  const [rawCl, lc] = await Promise.all([fetchChangelog(), fetchLastChecked()])
  const cl = limitChangelogDays(rawCl as ChangelogEntry[])
  const lastChecked = lc || core?.lastChecked || core?.last_run || ''
  dispatch({ type: 'SET_CHANGELOG', payload: cl })

  // Start icon preloading with priority from fresh changes
  const priorityPkgs: string[] = []
  if (changes?.affected_bundles?.length) {
    for (const ab of changes.affected_bundles) {
      for (const a of ab.apps || []) {
        if (a.package) priorityPkgs.push(a.package)
      }
    }
  }
  startIconPreload(iconData, dispatch, priorityPkgs)

  // Phase 5: Incremental bundle fetch — only changed versions
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Updating bundles...' })
  log('[fetch] comparing bundle index...')
  const { bundles, index: newIndex } = await fetchBundlesIncremental(
    cachedLive.bundles || {},
    cachedBundleIndex,
    (loaded, total) => {
      log(`[bundles] ${loaded}/${total} updated`)
      const pct = 50 + Math.round((loaded / total) * 40)
      dispatch({ type: 'SET_LOADING_PROGRESS', payload: pct })
    },
  )
  const bundleCount = Object.keys(bundles).length
  log(`bundles after incremental: ${bundleCount}`)
  log(`  ✓ ${bundleCount} bundles (incremental update)`)

  // Phase 6: Update state + IDB
  dispatch({ type: 'SET_BUNDLES', payload: bundles })
  dispatch({ type: 'SET_STATS', payload: stats || null })
  dispatch({ type: 'SET_CHANGES', payload: changes || null })
  notifyWatchedUpdates(changes)
  dispatch({
    type: 'SET_METADATA',
    payload: { liveDataDate: freshDate, lastChecked },
  })

  const livePayload = {
    date: freshDate,
    last_run: core?.last_run || '',
    lastChecked,
    stats,
    changes,
    bundles,
  }
  idbSet(CACHE_KEYS.LIVE, livePayload)
  idbSet(CACHE_KEYS.CHANGELOG, cl)
  idbSet(CACHE_KEYS.BUNDLE_INDEX, newIndex)
  log(`[done] update complete — ${bundleCount} bundles`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
  dispatch({ type: 'SET_LOADING', payload: false })
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
