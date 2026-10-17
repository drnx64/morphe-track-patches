/**
 * Fetch functions for JSON data files.
 */

const VERBOSE = window.location.hostname === 'localhost'

function log(...args) {
  if (VERBOSE) console.log('[fetchData]', ...args)
}

function fetchJson(url, fallback, errors) {
  log(`fetching ${url}...`)
  return fetch(url)
    .then((r) => {
      if (r.ok) {
        log(`OK ${url} (${r.status})`)
        return r.json()
      }
      const msg = `${url} returned ${r.status}`
      log(`FAIL ${msg} — using fallback`)
      if (errors) errors.push(msg)
      return fallback
    })
    .catch((err) => {
      const msg = `${url}: ${err.message}`
      log(`ERROR ${msg} — using fallback`)
      if (errors) errors.push(msg)
      return fallback
    })
}

export function fetchBundleIndex() {
  return fetchJson('data/bundles/_index.json', {})
}

export async function fetchBundleData(bundleKey) {
  const filename = bundleKey.replace(':', '_') + '.json'
  return fetchJson(`data/bundles/${filename}`, null)
}

export async function fetchAllBundlesMerged() {
  return fetchJson('data/bundles.json', {})
}

export async function fetchAllBundlesFromIndex(errors) {
  const merged = await fetchAllBundlesMerged()
  if (Object.keys(merged).length > 0) return merged

  const index = await fetchBundleIndex()
  const keys = Object.keys(index)
  if (keys.length === 0) return {}

  const results = await Promise.all(
    keys.map(async (key) => {
      const data = await fetchBundleData(key)
      return [key, data]
    })
  )

  const bundles = {}
  for (const [key, data] of results) {
    if (data) bundles[key] = data
  }
  return bundles
}

export function fetchAllData() {
  const ts = Date.now()
  const errors = []
  return Promise.all([
    fetchJson(`data/core.json?_t=${ts}`, {}, errors),
    fetchJson(`data/stats.json?_t=${ts}`, {}, errors),
    fetchJson(`data/changes.json?_t=${ts}`, {}, errors),
    fetchAllBundlesFromIndex(errors),
  ]).then(([core, stats, changes, bundles]) => {
    return {
      date: core?.date || '',
      last_run: core?.last_run || '',
      lastChecked: core?.lastChecked || '',
      stats,
      changes,
      bundles,
      errors,
    }
  })
}

export function fetchCore() {
  return fetchJson(`data/core.json?_t=${Date.now()}`, {})
}

export function fetchStats() {
  return fetchJson(`data/stats.json?_t=${Date.now()}`, {})
}

export function fetchChanges() {
  return fetchJson(`data/changes.json?_t=${Date.now()}`, {})
}

export function fetchBundles() {
  return fetchAllBundlesFromIndex()
}

export function fetchLastChecked() {
  return fetch('data/state/last_run.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.lastChecked ?? null)
    .catch(() => null)
}

export async function fetchIconAndNameCaches() {
  const raw = await fetchJson('data/state/app_cache.json', {})
  const iconCache = {}
  const nameCache = {}
  for (const [pkg, entry] of Object.entries(raw)) {
    if (entry && typeof entry === 'object') {
      if (entry.icon_url) iconCache[pkg] = entry.icon_url
      if (entry.name) nameCache[pkg] = entry.name
    }
  }
  return { iconCache, nameCache }
}

export function fetchChangelog() {
  return fetchJson('data/changelog.json', [])
}

export async function fetchBundlesIncremental(cachedBundles, cachedIndex, onProgress) {
  const newIndex = await fetchBundleIndex()
  const newKeys = Object.keys(newIndex)

  const keysToFetch = []
  for (const key of newKeys) {
    const cached = cachedIndex?.[key]
    const fresh = newIndex[key]
    if (!cached || cached.version !== fresh.version) {
      keysToFetch.push(key)
    }
  }

  if (keysToFetch.length === 0) {
    return { bundles: cachedBundles, index: newIndex }
  }

  const BATCH = 50
  const bundles = { ...cachedBundles }
  for (let i = 0; i < keysToFetch.length; i += BATCH) {
    const batch = keysToFetch.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (key) => {
      const data = await fetchBundleData(key)
      return [key, data]
    }))
    for (const [key, data] of results) {
      if (data) bundles[key] = data
    }
    onProgress?.(Math.min(i + BATCH, keysToFetch.length), keysToFetch.length)
  }

  for (const key of Object.keys(bundles)) {
    if (!newIndex[key]) delete bundles[key]
  }

  return { bundles, index: newIndex }
}

export function fetchBundlesBatched(onProgress) {
  const errors = []
  return fetchBundleIndex().then(async (index) => {
    const keys = Object.keys(index)
    if (keys.length === 0) return { bundles: {}, errors }

    const BATCH = 50
    const bundles = {}
    for (let i = 0; i < keys.length; i += BATCH) {
      const batch = keys.slice(i, i + BATCH)
      const results = await Promise.all(batch.map(async (key) => {
        const data = await fetchBundleData(key)
        return [key, data]
      }))
      const batchBundles = {}
      for (const [key, data] of results) {
        if (data) {
          bundles[key] = data
          batchBundles[key] = data
        }
      }
      onProgress?.(Math.min(i + BATCH, keys.length), keys.length, batchBundles)
    }
    return { bundles, errors }
  })
}

export function fetchReleaseCache() {
  return fetchJson('data/state/release_cache.json', {})
}
