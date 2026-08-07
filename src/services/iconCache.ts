const VERBOSE = true

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[iconCache]', ...args)
}

import { idbGet, idbGetMany, idbSetMany, idbKeys, idbDeleteMany } from './indexedDB'

const imageCache: Record<string, string> = {}

// Hard cap on the number of images persisted in IndexedDB. Icons are stored as
// base64 data URLs (~33% larger than raw bytes); without a cap this can grow to
// hundreds of MB and start evicting other browser storage/quota. We keep only the
// most recently loaded set and drop the overflow.
const MAX_STORED_IMAGES = 600

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

export async function loadIconImage(iconUrl: string): Promise<string | null> {
  if (!iconUrl) return null
  if (imageCache[iconUrl]) return imageCache[iconUrl]

  const cacheKey = hashStr(iconUrl)
  const cached = await idbGet<string>(cacheKey)
  if (cached) {
    imageCache[iconUrl] = cached
    return cached
  }

  log(`fetching icon: ${iconUrl}`)
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'blob'
    xhr.onload = () => {
      if (xhr.status === 200) {
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          imageCache[iconUrl] = dataUrl
          idbSetMany([[cacheKey, dataUrl]])
          resolve(dataUrl)
        }
        reader.readAsDataURL(xhr.response)
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

  const BATCH_SIZE = 20
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(url => loadIconImage(url)))
  }
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

  const BATCH_SIZE = 20
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(url => loadIconImage(url)))
  }
  await pruneStoredImages()
}

export function getCachedIconDataUrl(iconUrl: string): string | undefined {
  return imageCache[iconUrl]
}
