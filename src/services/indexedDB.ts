const VERBOSE = false

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[indexedDB]', ...args)
}

const DB_NAME = 'MorpheTrackerCache'
const STORE_NAME = 'store'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        log('creating object store')
        req.result.createObjectStore(STORE_NAME)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        log(`openDB error: ${req.error}`)
        dbPromise = null
        reject(req.error)
      }
    })
  }
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore, tx: IDBTransaction) => T | Promise<T>,
): Promise<T | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    return await fn(store, tx)
  } catch (err) {
    log(`transaction exception: ${err}`)
    return null
  }
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => resolve()
    tx.onerror = () => resolve()
  })
}

export async function idbSet<T>(key: string, val: T): Promise<void> {
  log(`idbSet("${key}")`)
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(val, key)
    await txDone(tx)
  } catch (err) {
    log(`idbSet("${key}") exception: ${err}`)
  }
}

export async function idbSetMany(entries: Array<[string, unknown]>): Promise<void> {
  if (!entries.length) return
  log(`idbSetMany(${entries.length})`)
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const [key, val] of entries) store.put(val, key)
    await txDone(tx)
  } catch (err) {
    log(`idbSetMany exception: ${err}`)
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  log(`idbGet("${key}")`)
  return withStore<T | null>('readonly', (store) => {
    return new Promise<T | null>((resolve) => {
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result ?? null) as T | null)
      req.onerror = () => resolve(null)
    })
  })
}

export async function idbGetMany<T>(keys: string[]): Promise<Map<string, T>> {
  const map = new Map<string, T>()
  if (!keys.length) return map
  const result = await withStore('readonly', (store) => {
    return new Promise<Map<string, T>>((resolve) => {
      const tx = store.transaction
      let pending = keys.length
      for (const key of keys) {
        const req = store.get(key)
        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            map.set(key, req.result as T)
          }
          pending -= 1
          if (pending === 0) resolve(map)
        }
        req.onerror = () => {
          pending -= 1
          if (pending === 0) resolve(map)
        }
      }
      tx.onerror = () => resolve(map)
    })
  })
  return result || map
}

export async function clearAllCaches(): Promise<void> {
  log('clearAllCaches')
  try {
    const db = await openDB()
    db.close()
    dbPromise = null
    indexedDB.deleteDatabase(DB_NAME)
    log('clearAllCaches done')
  } catch (err) {
    log(`clearAllCaches error: ${err}`)
  }
}
