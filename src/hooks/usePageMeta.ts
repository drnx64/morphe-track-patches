import { useEffect } from 'react'

const SITE_NAME = 'Morphe Patch Tracker'

function setMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
): void {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (el) {
    el.setAttribute('content', content)
  } else {
    const m = document.createElement('meta')
    m.setAttribute(attr, key)
    m.setAttribute('content', content)
    document.head.appendChild(m)
  }
}

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = `${title} — ${SITE_NAME}`
    setMeta('name', 'description', description || '')
    setMeta('property', 'og:title', `${title} — ${SITE_NAME}`)
    setMeta('property', 'og:description', description || '')
    setMeta('name', 'twitter:title', `${title} — ${SITE_NAME}`)
    setMeta('name', 'twitter:description', description || '')
  }, [title, description])
}