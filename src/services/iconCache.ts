const VERBOSE = import.meta.env.DEV || window.location.hostname === 'localhost'

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[iconCache]', ...args)
}

import { idbGet, idbSetMany, idbKeys, idbDeleteMany } from './indexedDB'

const imageCache: Record<string, string> = {}
const urlToPkg: Record<string, string> = {}

const MAX_STORED_IMAGES = 600

function pkgKey(pkg: string): string {
  return `icon_${pkg}`
}

function hashStr(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0
  }
  return 'img_' + Math.abs(hash).toString(36)
}

function resolveIdbKey(iconUrl: string): string {
  const pkg = urlToPkg[iconUrl]
  if (pkg) return pkgKey(pkg)
  return hashStr(iconUrl)
}

async function pruneStoredImages() {
  try {
    const keys = await idbKeys('icon_')
    const hashKeys = await idbKeys('img_')
    const allKeys = [...keys, ...hashKeys]
    if (allKeys.length <= MAX_STORED_IMAGES) return
    const inUse = new Set<string>()
    for (const url of Object.keys(imageCache)) inUse.add(resolveIdbKey(url))
    let toDelete = allKeys.length - MAX_STORED_IMAGES
    const del: string[] = []
    for (const k of allKeys) {
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
    /* ignore */
  }
}

const ICON_MAX = 96

function loadImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > ICON_MAX || h > ICON_MAX) {
          const ratio = Math.min(ICON_MAX / w, ICON_MAX / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, w, h)
        const webpUrl = canvas.toDataURL('image/webp', 0.8)
        if (webpUrl.length > 23) {
          resolve(webpUrl)
        } else {
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function loadIconImage(iconUrl: string): Promise<string | null> {
  if (!iconUrl) return null

  if (iconUrl.startsWith('data:')) return iconUrl

  if (imageCache[iconUrl]) return imageCache[iconUrl]

  const idbKey = resolveIdbKey(iconUrl)
  const cached = await idbGet<string>(idbKey)
  if (cached) {
    imageCache[iconUrl] = cached
    return cached
  }

  return null
}

export async function ensureIconLoaded(iconUrl: string): Promise<string | null> {
  if (!iconUrl) return null
  return loadIconImage(iconUrl)
}

export async function fetchAndCacheIcon(iconUrl: string): Promise<string | null> {
  if (!iconUrl) return null

  if (iconUrl.startsWith('data:')) return iconUrl

  if (imageCache[iconUrl]) return imageCache[iconUrl]

  const idbKey = resolveIdbKey(iconUrl)
  const cached = await idbGet<string>(idbKey)
  if (cached) {
    imageCache[iconUrl] = cached
    return cached
  }

  if (iconUrl.startsWith('http')) {
    const dataUrl = await loadImage(iconUrl)
    if (dataUrl) {
      imageCache[iconUrl] = dataUrl
      idbSetMany([[idbKey, dataUrl]])
      return dataUrl
    }
  }

  return null
}

async function batchFetchIcons(
  urls: string[],
  concurrency: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  let idx = 0
  let active = 0
  let loaded = 0

  return new Promise((resolve) => {
    function next() {
      while (active < concurrency && idx < urls.length) {
        const i = idx++
        active++
        fetchAndCacheIcon(urls[i]).finally(() => {
          active--
          loaded++
          if (loaded % 10 === 0 || loaded === urls.length) {
            log(`batchFetchIcons: ${loaded}/${urls.length}`)
            onProgress?.(loaded, urls.length)
          }
          if (idx >= urls.length && active === 0) {
            resolve()
          } else {
            next()
          }
        })
      }
      if (idx >= urls.length && active === 0) {
        resolve()
      }
    }
    next()
  })
}

export async function preloadIcons(
  iconMap: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
  priorityPackages?: string[],
): Promise<void> {
  let dataUrlCount = 0
  let httpCount = 0
  const httpUrls: string[] = []
  const priorityUrls: string[] = []

  for (const [pkg, val] of Object.entries(iconMap)) {
    if (!val || typeof val !== 'string') continue
    if (val.startsWith('data:')) {
      imageCache[val] = val
      dataUrlCount++
    } else if (val.startsWith('http')) {
      urlToPkg[val] = pkg
      httpCount++
      if (priorityPackages?.includes(pkg)) {
        priorityUrls.push(val)
      } else {
        httpUrls.push(val)
      }
    }
  }

  log(`preloadIcons: ${dataUrlCount} data URLs (instant), ${httpCount} HTTP URLs (${priorityUrls.length} priority)`)

  const priorityToFetch = priorityUrls.filter((url) => !imageCache[url])
  const restToFetch = httpUrls.filter((url) => !imageCache[url])

  if (priorityToFetch.length) {
    log(`fetching ${priorityToFetch.length} priority icons first...`)
    await batchFetchIcons(priorityToFetch, 4, (loaded, total) => {
      onProgress?.(loaded, total + restToFetch.length)
    })
  }

  if (restToFetch.length) {
    log(`fetching ${restToFetch.length} remaining icons...`)
    const offset = priorityToFetch.length
    await batchFetchIcons(restToFetch, 4, (loaded, total) => {
      onProgress?.(offset + loaded, offset + total)
    })
  }

  await pruneStoredImages()
  log('preloadIcons done')
}

export async function preloadIconsFromPackages(
  packages: string[],
  iconMap: Record<string, string>,
): Promise<void> {
  const httpUrls: string[] = []
  for (const pkg of packages) {
    const val = iconMap[pkg]
    if (!val) continue
    if (val.startsWith('data:')) {
      imageCache[val] = val
    } else if (val.startsWith('http')) {
      urlToPkg[val] = pkg
      httpUrls.push(val)
    }
  }
  if (!httpUrls.length) return

  const toFetch = httpUrls.filter((url) => !imageCache[url])
  await batchFetchIcons(toFetch, 4)
  await pruneStoredImages()
}

export function getCachedIconDataUrl(iconUrl: string): string | undefined {
  if (iconUrl && iconUrl.startsWith('data:')) return iconUrl
  return imageCache[iconUrl]
}
