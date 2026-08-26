const VERBOSE = true

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[iconCache]', ...args)
}

import { idbGet, idbGetMany, idbSetMany, idbKeys, idbDeleteMany } from './indexedDB'

const imageCache: Record<string, string> = {}

const MAX_STORED_IMAGES = 600
const MAX_CONCURRENT = 6
const RETRY_BASE_MS = 800
const MAX_RETRIES = 2

function hashStr(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0
  }
  return 'img_' + Math.abs(hash).toString(36)
}

async function pruneStoredImages() {
  try {
    const keys = await idbKeys('img_')
    if (keys.length <= MAX_STORED_IMAGES) return
    const inUse = new Set<string>()
    for (const url of Object.keys(imageCache)) inUse.add(hashStr(url))
    let toDelete = keys.length - MAX_STORED_IMAGES
    const del: string[] = []
    for (const k of keys) {
      if (toDelete <= 0) break
      if (!inUse.has(k)) {
        del.push(k)
        toDelete--
      }
    }
    if (del.length) {
      log(`pruning ${del.length} cached icon(s)`)
      await idbDeleteMany(del)
    }
  } catch {
    /* ignore prune errors */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function loadIconImage(iconUrl: string, retries = MAX_RETRIES): Promise<string | null> {
  if (!iconUrl) return null
  if (imageCache[iconUrl]) return imageCache[iconUrl]

  const cacheKey = hashStr(iconUrl)
  const cached = await idbGet<string>(cacheKey)
  if (cached) {
    imageCache[iconUrl] = cached
    return cached
  }

  log(`fetching icon: ${iconUrl}`)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.responseType = 'blob'
        xhr.onload = () => {
          if (xhr.status === 200) {
            const reader = new FileReader()
            reader.onloadend = () => {
              resolve(reader.result as string)
            }
            reader.readAsDataURL(xhr.response)
          } else if (xhr.status === 429) {
            log(`icon rate-limited (429): ${iconUrl}`)
            resolve(null)
          } else {
            log(`icon fetch FAIL ${iconUrl}: ${xhr.status}`)
            resolve(null)
          }
        }
        xhr.onerror = () => {
          log(`icon fetch ERROR ${iconUrl}`)
          resolve(null)
        }
        xhr.open('GET', iconUrl, true)
        xhr.send()
      })

      if (dataUrl) {
        imageCache[iconUrl] = dataUrl
        idbSetMany([[cacheKey, dataUrl]])
        return dataUrl
      }

      if (attempt < retries) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt)
        log(`retrying icon ${attempt + 1}/${retries} after ${delay}ms: ${iconUrl}`)
        await sleep(delay)
      }
    } catch {
      if (attempt < retries) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }
  return null
}

function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    let idx = 0
    let active = 0
    let done = false

    function next() {
      while (active < limit && idx < items.length) {
        const i = idx++
        active++
        fn(items[i]).finally(() => {
          active--
          if (done) return
          if (idx >= items.length && active === 0) {
            done = true
            resolve()
          } else {
            next()
          }
        })
      }
      if (idx >= items.length && active === 0 && !done) {
        done = true
        resolve()
      }
    }
    next()
  })
}

export async function preloadIcons(iconMap: Record<string, string>): Promise<void> {
  const urls = new Set<string>()
  for (const url of Object.values(iconMap)) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      urls.add(url)
    }
  }
  const unique = [...urls]
  log(`preloadIcons: ${unique.length} unique icon URLs`)
  if (!unique.length) return

  const missing: string[] = []
  const entries = await idbGetMany<string>(unique.map(hashStr))
  for (const url of unique) {
    const cached = entries.get(hashStr(url))
    if (cached) {
      imageCache[url] = cached
    } else {
      missing.push(url)
    }
  }
  log(`preloadIcons: ${missing.length} missing after cache read`)

  await runWithConcurrency(missing, MAX_CONCURRENT, async (url) => { await loadIconImage(url) })
  log('preloadIcons done')
  await pruneStoredImages()
}

export async function preloadIconsFromPackages(
  packages: string[],
  iconCache: Record<string, string>
): Promise<void> {
  const urls: string[] = []
  for (const pkg of packages) {
    const url = iconCache[pkg]
    if (url && url.startsWith('http')) {
      urls.push(url)
    }
  }
  if (!urls.length) return

  const missing: string[] = []
  const entries = await idbGetMany<string>(urls.map(hashStr))
  for (const url of urls) {
    const cached = entries.get(hashStr(url))
    if (cached) {
      imageCache[url] = cached
    } else {
      missing.push(url)
    }
  }

  await runWithConcurrency(missing, MAX_CONCURRENT, async (url) => { await loadIconImage(url) })
  await pruneStoredImages()
}

export function getCachedIconDataUrl(iconUrl: string): string | undefined {
  return imageCache[iconUrl]
}
