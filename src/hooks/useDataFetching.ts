const VERBOSE = true

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[useDataFetching]', ...args)
}

import { useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { idbGet, idbSet } from '../services/indexedDB'
import { fetchAllData, fetchLastChecked, fetchIconCache, fetchNameCache } from '../services/fetchData'
import { preloadIcons } from '../services/iconCache'
import { CACHE_KEYS } from '../types/utils'

export function useDataFetching() {
  const { state, dispatch } = useAppContext()

  const loadData = async () => {
    log('loadData started')
    dispatch({ type: 'CLEAR_LOADING_LOG' })
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 0 })
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Initializing...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[init] starting data load...' })

    log('checking IndexedDB cache...')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Checking cache...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[cache] reading IndexedDB...' })
    const [cachedLive, cachedIcons, cachedNames] = await Promise.all([
      idbGet<any>(CACHE_KEYS.LIVE),
      idbGet<Record<string, string>>(CACHE_KEYS.ICONS),
      idbGet<Record<string, string>>(CACHE_KEYS.NAMES),
    ])
    log(`IndexedDB: cachedLive=${!!cachedLive}, cachedIcons=${!!cachedIcons}, cachedNames=${!!cachedNames}`)
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 10 })

    if (cachedLive && cachedIcons) {
      log('rendering from IndexedDB cache...')
      dispatch({ type: 'SET_BUNDLES', payload: cachedLive.bundles || {} })
      dispatch({ type: 'SET_ICON_CACHE', payload: cachedIcons })
      if (cachedNames) dispatch({ type: 'SET_NAME_CACHE', payload: cachedNames })
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
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 20 })

    log('fetching icon cache...')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading icons...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[icons] fetching icon cache...' })
    const iconData = await fetchIconCache()
    log(`icon cache: ${Object.keys(iconData).length} entries`)
    dispatch({ type: 'SET_ICON_CACHE', payload: iconData })
    idbSet(CACHE_KEYS.ICONS, iconData)
    dispatch({ type: 'SET_LOADING_LOG', payload: `[icons] fetched ${Object.keys(iconData).length} icons` })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 30 })

    log('preloading icons...')
    dispatch({ type: 'SET_LOADING_LOG', payload: '[icons] preloading icons in background...' })
    preloadIcons(iconData).then(() => {
      log('icon preloading done, marking icons ready')
      dispatch({ type: 'SET_ICONS_READY', payload: true })
    }).catch(() => {})
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 40 })

    log('fetching name cache...')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Loading app names...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[names] fetching name cache...' })
    const nameData = await fetchNameCache()
    log(`name cache: ${nameData ? Object.keys(nameData).length : 0} entries`)
    if (nameData) {
      dispatch({ type: 'SET_NAME_CACHE', payload: nameData })
      idbSet(CACHE_KEYS.NAMES, nameData)
      dispatch({ type: 'SET_LOADING_LOG', payload: `[names] loaded ${Object.keys(nameData).length} app names` })
    } else {
      dispatch({ type: 'SET_LOADING_LOG', payload: '[names] name cache empty' })
    }
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 55 })

    log('fetching live data (core + stats + changes + bundles)...')
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Fetching patch data...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[live] fetching core, stats, changes, bundles...' })
    const [data, lc] = await Promise.all([fetchAllData(), fetchLastChecked()])
    const lastChecked = lc || data.lastChecked || data.last_run || ''
    log(`live data fetched: date=${data.date}, bundles=${Object.keys(data.bundles || {}).length}, lastChecked=${lastChecked}`)
    dispatch({ type: 'SET_LOADING_LOG', payload: `[live] loaded ${Object.keys(data.bundles || {}).length} bundles (date: ${data.date})` })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 80 })

    dispatch({ type: 'SET_BUNDLES', payload: data.bundles || {} })
    dispatch({ type: 'SET_METADATA', payload: { liveDataDate: data.date || '', lastChecked } })
    dispatch({ type: 'SET_STATS', payload: data.stats || null })
    dispatch({ type: 'SET_CHANGES', payload: data.changes || null })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 90 })
    dispatch({ type: 'SET_LOADING_STATUS', payload: 'Finalizing...' })
    dispatch({ type: 'SET_LOADING_LOG', payload: '[done] finalizing...' })

    idbSet(CACHE_KEYS.LIVE, data)
    log('loadData complete')
    dispatch({ type: 'SET_LOADING_LOG', payload: `[done] load complete — ${Object.keys(data.bundles || {}).length} bundles` })
    dispatch({ type: 'SET_LOADING_PROGRESS', payload: 100 })
    dispatch({ type: 'SET_LOADING', payload: false })
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handler = () => {
      log('DATA_UPDATED message received from SW, refreshing...')
      const lc = fetchLastChecked()
      const data = fetchAllData()
      Promise.all([data, lc]).then(([d, l]) => {
        log('SW refresh complete')
        dispatch({ type: 'SET_BUNDLES', payload: d.bundles || {} })
        dispatch({ type: 'SET_STATS', payload: d.stats || null })
        dispatch({ type: 'SET_CHANGES', payload: d.changes || null })
        dispatch({
          type: 'SET_METADATA',
          payload: { liveDataDate: d.date || '', lastChecked: l || d.lastChecked || '' },
        })
        idbSet(CACHE_KEYS.LIVE, d)
      })
    }
    navigator.serviceWorker?.addEventListener('message', (msg) => {
      if (msg.data?.type === 'DATA_UPDATED') handler()
    })
    return () => navigator.serviceWorker?.removeEventListener('message', handler as unknown as EventListener)
  }, [dispatch])

  return { loading: state.loading }
}