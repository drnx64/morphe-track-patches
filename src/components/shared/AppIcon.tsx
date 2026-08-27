import { useState, useEffect, useRef } from 'react'
import { FALLBACK_ICON } from '../../utils/svg'
import { getCachedIconDataUrl, fetchAndCacheIcon } from '../../services/iconCache'

interface AppIconProps {
  iconUrl?: string
  sizeClass?: string
  alt?: string
}

export default function AppIcon({ iconUrl, sizeClass = 'app-icon', alt = '' }: AppIconProps) {
  const [src, setSrc] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!iconUrl) {
      setSrc('')
      setLoading(false)
      return
    }

    const cached = getCachedIconDataUrl(iconUrl)
    if (cached) {
      setSrc(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    fetchAndCacheIcon(iconUrl).then((dataUrl) => {
      if (!mountedRef.current) return
      if (dataUrl) {
        setSrc(dataUrl)
      } else {
        setSrc(FALLBACK_ICON)
      }
      setLoading(false)
    }).catch(() => {
      if (!mountedRef.current) return
      setSrc(FALLBACK_ICON)
      setLoading(false)
    })
  }, [iconUrl])

  if (!iconUrl) return null
  if (loading && !src) return null

  return (
    <img
      className={sizeClass}
      src={src || FALLBACK_ICON}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        if (e.currentTarget.src !== FALLBACK_ICON) {
          e.currentTarget.src = FALLBACK_ICON
        }
      }}
    />
  )
}
