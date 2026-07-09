const VERBOSE = true

function log(...args: unknown[]) {
  if (VERBOSE) console.log('[iconCache]', ...args)
}

import { idbGet, idbSet } from './indexedDB'

const imageCache: Record<string, string> = {}

function hashStr(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0
  }
  return 'img_' + Math.abs(hash).toString(36)
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
          idbSet(cacheKey, dataUrl)
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

  const BATCH_SIZE = 20
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(url => loadIconImage(url)))
  }
  log('preloadIcons done')
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

  const BATCH_SIZE = 20
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(url => loadIconImage(url)))
  }
}

export function getCachedIconDataUrl(iconUrl: string): string | undefined {
  return imageCache[iconUrl]
}
