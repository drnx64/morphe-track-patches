/**
 * Bundle state cache — one IndexedDB record holding the last known
 * _index.json + per-bundle records. Boots paint instantly from it while
 * the network revalidates per-key versions (stale-while-revalidate).
 */
import { idbGet, idbSet } from './indexedDB.js'

const CACHE_KEY = 'bundle_state_v1'
// Guards against files rewritten without a version bump (e.g. pipeline fixes)
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * @returns {Promise<{index: Object, records: Object}|null>}
 */
export async function loadBundleState() {
  try {
    const cached = await idbGet(CACHE_KEY)
    if (!cached || typeof cached !== 'object') return null
    if (!cached.index || !cached.records) return null
    if (Date.now() - (cached.savedAt || 0) > MAX_AGE_MS) return null
    return { index: cached.index, records: cached.records }
  } catch {
    return null
  }
}

/**
 * Persist current bundle state. `index` should omit keys whose record is
 * incomplete (failed fetches) so they revalidate on the next boot.
 * @param {Object} index
 * @param {Object} records
 */
export async function saveBundleState(index, records) {
  try {
    await idbSet(CACHE_KEY, { savedAt: Date.now(), index, records })
  } catch {
    /* cache is best-effort */
  }
}
