const VERBOSE = true

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[indexedDB]', ...args)
}

const DB_NAME = 'MorpheTrackerCache'
const STORE_NAME = 'store'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      log('creating object store')
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      log(`openDB error: ${req.error}`)
      reject(req.error)
    }
  })
}

export async function idbSet<T>(key: string, val: T): Promise<void> {
  log(`idbSet("${key}")`)
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(val, key)
      tx.oncomplete = () => { db.close(); log(`idbSet("${key}") OK`); resolve() }
      tx.onerror = () => { db.close(); log(`idbSet("${key}") tx error`); resolve() }
    })
  } catch (err) {
    log(`idbSet("${key}") exception: ${err}`)
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  log(`idbGet("${key}")`)
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME).get(key)
      store.onsuccess = () => {
        db.close()
        const result = store.result ?? null
        log(`idbGet("${key}") => ${result ? 'found' : 'null'}`)
        resolve(result)
      }
      store.onerror = () => {
        db.close()
        log(`idbGet("${key}") store error`)
        resolve(null)
      }
    })
  } catch (err) {
    log(`idbGet("${key}") exception: ${err}`)
    return null
  }
}

export async function clearAllCaches(): Promise<void> {
  log('clearAllCaches')
  try {
    const db = await openDB()
    db.close()
    indexedDB.deleteDatabase(DB_NAME)
    log('clearAllCaches done')
  } catch (err) {
    log(`clearAllCaches error: ${err}`)
  }
}
