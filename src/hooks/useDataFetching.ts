const VERBOSE = true

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
  fetchBundles,
  fetchChangelog,
  fetchAllData,
  fetchLastChecked,
  fetchIconCache,
  fetchNameCache,
} from '../services/fetchData'
import { preloadIcons } from '../services/iconCache'
import { notifyWatchedUpdates } from '../services/watchlist'
import { CACHE_KEYS } from '../types/utils'
import type { ChangelogEntry } from '../types/changelog'

let loadedOnce = false
let loadPromise: Promise<void> | null = null

async function runLoad(dispatch: React.Dispatch<AppAction>) {
  log('loadData started')
  dispatch({ type: 'CLEAR_LOADING_LOG' })
  dispatch({ type: 'SET_LOADING', payload: true })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 })
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Initializing...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[init] starting data load...' })

  log('checking IndexedDB cache...')
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Checking cache...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[cache] reading IndexedDB...' })
  const [cachedLive, cachedIcons, cachedNames, cachedChangelog] = await Promise.all([
    idbGet<any>(CACHE_KEYS.LIVE),
    idbGet<Record<string, string>>(CACHE_KEYS.ICONS),
    idbGet<Record<string, string>>(CACHE_KEYS.NAMES),
    idbGet<ChangelogEntry[]>(CACHE_KEYS.CHANGELOG),
  ])
  log(`IndexedDB: cachedLive=${!!cachedLive}, cachedIcons=${!!cachedIcons}, cachedNames=${!!cachedNames}`)
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 8 })

  if (cachedLive && cachedIcons) {
    log('rendering from IndexedDB cache...')
    dispatch({ type: 'SET_BUNDLES', payload: cachedLive.bundles || {} })
    dispatch({ type: 'SET_ICON_CACHE', payload: cachedIcons })
    if (cachedNames) dispatch({ type: 'SET_NAME_CACHE', payload: cachedNames })
    if (cachedChangelog) dispatch({ type: 'SET_CHANGELOG', payload: cachedChangelog })
    dispatch({ type: 'SET_STATS', payload: cachedLive.stats || null })
    dispatch({ type: 'SET_CHANGES', payload: cachedLive.changes || null })
    dispatch({
      type: 'SET_METADATA',
      payload: {
        liveDataDate: cachedLive.date || '',
        lastChecked: cachedLive.lastChecked || cachedLive.last_run || '',
      },
    })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[cache] loaded cached data from IndexedDB' })
  } else {
    log('no IndexedDB cache available')
    dispatch({ type: 'SET_LOADING_LOG', payload: '[cache] no cached data found' })
  }
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 15 })

  log('fetching icon cache...')
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading icons...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[icons] fetching icon cache...' })
  const iconData = await fetchIconCache()
  log(`icon cache: ${Object.keys(iconData).length} entries`)
  dispatch({ type: 'SET_ICON_CACHE', payload: iconData })
  idbSet(CACHE_KEYS.ICONS, iconData)
  dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${Object.keys(iconData).length} icons` })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 22 })

  log('preloading icons...')
  dispatch({ type: 'SET_LOADING_LOG', payload: '[icons] preloading icons in background...' })
  preloadIcons(iconData).then(() => {
    log('icon preloading done, marking icons ready')
    dispatch({ type: 'SET_ICONS_READY', payload: true })
  }).catch(() => {})
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 26 })

  log('fetching name cache...')
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading app names...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[names] fetching name cache...' })
  const nameData = await fetchNameCache()
  log(`name cache: ${nameData ? Object.keys(nameData).length : 0} entries`)
  if (nameData && Object.keys(nameData).length > 0) {
    dispatch({ type: 'SET_NAME_CACHE', payload: nameData })
    idbSet(CACHE_KEYS.NAMES, nameData)
    dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${Object.keys(nameData).length} app names` })
  } else {
    dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ name cache empty' })
  }
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 32 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching core data...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/core.json' })
  const core = await fetchCore()
  log(`core fetched: date=${core?.date}`)
  dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ core metadata (date: ${core?.date || 'unknown'})` })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 40 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching statistics...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/stats.json' })
  const stats = await fetchStats()
  log('stats fetched')
  dispatch({ type: 'SET_LOADING_LOG', payload: '  ✓ statistics' })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 48 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching changes...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/changes.json' })
  const changes = await fetchChanges()
  log(`changes fetched: ${changes?.affected_bundles?.length ?? 0} affected bundles`)
  dispatch({
    type: 'SET_LOADING_LOG',
    payload: `  ✓ changes${changes?.affected_bundles?.length ? ` (${changes.affected_bundles.length} affected bundles)` : ''}`,
  })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 56 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching bundles...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/bundles.json' })
  const bundles = await fetchBundles()
  const bundleCount = Object.keys(bundles).length
  log(`bundles fetched: ${bundleCount}`)
  dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${bundleCount} bundles` })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 70 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching changelog...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/changelog.json' })
  const cl = (await fetchChangelog()) as ChangelogEntry[]
  log(`changelog fetched: ${cl.length} entries`)
  dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ ${cl.length} changelog entries` })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 82 })

  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching last run...' })
  dispatch({ type: 'SET_LOADING_LOG', payload: '[fetch] /data/state/last_run.json' })
  const lc = await fetchLastChecked()
  const lastChecked = lc || core?.lastChecked || core?.last_run || ''
  dispatch({ type: 'SET_LOADING_LOG', payload: `  ✓ last checked: ${lastChecked || 'unknown'}` })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 90 })

  dispatch({ type: 'SET_BUNDLES', payload: bundles })
  dispatch({ type: 'SET_STATS', payload: stats || null })
  dispatch({ type: 'SET_CHANGES', payload: changes || null })
  notifyWatchedUpdates(changes)
  dispatch({ type: 'SET_CHANGELOG', payload: cl })
  dispatch({ type: 'SET_METADATA', payload: { liveDataDate: core?.date || '', lastChecked } })
  dispatch({ type: 'SET_LOADING_PROGRESS', payload: 95 })
  dispatch({ type: 'SET_LOADING_STATUS', payload: 'Finalizing...' })

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
  log('loadData complete')
  dispatch({ type: 'SET_LOADING_LOG', payload: `[done] load complete — ${bundleCount} bundles` })
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
        dispatch({ type: 'SET_CHANGELOG', payload: (c as ChangelogEntry[]) || [] })
        dispatch({
          type: 'SET_METADATA',
          payload: { liveDataDate: d.date || '', lastChecked: l || d.lastChecked || '' },
        })
        idbSet(CACHE_KEYS.LIVE, d)
        idbSet(CACHE_KEYS.CHANGELOG, c)
      })
    }
    navigator.serviceWorker?.addEventListener('message', (msg) => {
      if (msg.data?.type === 'DATA_UPDATED') handler()
    })
    return () => navigator.serviceWorker?.removeEventListener('message', handler as unknown as EventListener)
  }, [dispatch])

  return { loading: state.loading }
}
