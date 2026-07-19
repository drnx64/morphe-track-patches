import { useState, useEffect, useCallback, useRef } from 'react'
import { FALLBACK_ICON } from '../../utils/svg'
import { getCachedIconDataUrl } from '../../services/iconCache'

interface AppIconProps {
  iconUrl?: string
  sizeClass?: string
  alt?: string
}

export default function AppIcon({ iconUrl, sizeClass = 'app-icon', alt = '' }: AppIconProps) {
  const [errored, setErrored] = useState(false)
  const [src, setSrc] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!iconUrl) { setSrc(''); return }
    const cached = getCachedIconDataUrl(iconUrl)
    if (cached) {
      setSrc(cached)
    } else {
      setSrc(iconUrl)
      const checkInterval = setInterval(() => {
        const c = getCachedIconDataUrl(iconUrl)
        if (c) {
          if (mountedRef.current) setSrc(c)
          clearInterval(checkInterval)
        }
      }, 300)
      setTimeout(() => clearInterval(checkInterval), 10000)
    }
  }, [iconUrl])

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!errored) {
      setErrored(true)
      e.currentTarget.src = FALLBACK_ICON
    }
  }, [errored])

  if (!iconUrl) return null
  if (!src) return null

  return (
    <img
      className={sizeClass}
      src={src}
      alt={alt}
      loading="lazy"
      onError={handleError}
    />
  )
}
