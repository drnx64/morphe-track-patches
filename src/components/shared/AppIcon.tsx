import { useState, useCallback } from 'react'
import { FALLBACK_ICON } from '../../utils/svg'
import { getCachedIconDataUrl } from '../../services/iconCache'

interface AppIconProps {
  iconUrl?: string
  sizeClass?: string
  alt?: string
}

export default function AppIcon({ iconUrl, sizeClass = 'app-icon', alt = '' }: AppIconProps) {
  const [errored, setErrored] = useState(false)

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!errored) {
      setErrored(true)
      e.currentTarget.src = FALLBACK_ICON
    }
  }, [errored])

  if (!iconUrl) return null

  const cached = getCachedIconDataUrl(iconUrl)

  return (
    <img
      className={sizeClass}
      src={cached || iconUrl}
      alt={alt}
      loading="lazy"
      onError={handleError}
    />
  )
}
