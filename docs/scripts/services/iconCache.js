/**
 * Icon cache — IndexedDB + canvas resize to WebP.
 */

import { idbGet, idbSetMany, idbKeys, idbDeleteMany } from './indexedDB.js'

/** @type {Object<string, string>} */
const imageCache = {}
/** @type {Object<string, string>} */
const urlToPkg = {}

const MAX_STORED_IMAGES = 600
const ICON_MAX = 96

function pkgKey(pkg) {
  return `icon_${pkg}`
}

function hashStr(s) {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0
  }
  return 'img_' + Math.abs(hash).toString(36)
}

function resolveIdbKey(iconUrl) {
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
    const inUse = new Set()
    for (const url of Object.keys(imageCache)) inUse.add(resolveIdbKey(url))
    let toDelete = allKeys.length - MAX_STORED_IMAGES
    const del = []
    for (const k of allKeys) {
      if (toDelete <= 0) break
      if (!inUse.has(k)) {
        del.push(k)
        toDelete--
      }
    }
    if (del.length) {
      await idbDeleteMany(del)
    }
  } catch {
    /* ignore */
  }
}

function loadImage(url) {
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

export async function loadIconImage(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') return null
  if (iconUrl.startsWith('data:')) return iconUrl
  if (imageCache[iconUrl]) return imageCache[iconUrl]
  const idbKey = resolveIdbKey(iconUrl)
  const cached = await idbGet(idbKey)
  if (cached) {
    imageCache[iconUrl] = cached
    return cached
  }
  return null
}

export async function fetchAndCacheIcon(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') return null
  if (iconUrl.startsWith('data:')) return iconUrl
  if (imageCache[iconUrl]) return imageCache[iconUrl]
  const idbKey = resolveIdbKey(iconUrl)
  const cached = await idbGet(idbKey)
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

async function batchFetchIcons(urls, concurrency, onProgress) {
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

export async function preloadIcons(iconMap, onProgress, priorityPackages) {
  let dataUrlCount = 0
  let httpCount = 0
  const httpUrls = []
  const priorityUrls = []

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

  const priorityToFetch = priorityUrls.filter((url) => !imageCache[url])
  const restToFetch = httpUrls.filter((url) => !imageCache[url])

  if (priorityToFetch.length) {
    await batchFetchIcons(priorityToFetch, 4, (loaded, total) => {
      onProgress?.(loaded, total + restToFetch.length)
    })
  }

  if (restToFetch.length) {
    const offset = priorityToFetch.length
    await batchFetchIcons(restToFetch, 4, (loaded, total) => {
      onProgress?.(offset + loaded, offset + total)
    })
  }

  await pruneStoredImages()
}

export async function preloadIconsFromPackages(packages, iconMap) {
  const httpUrls = []
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

export function getCachedIconDataUrl(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') return undefined
  if (iconUrl.startsWith('data:')) return iconUrl
  return imageCache[iconUrl]
}
