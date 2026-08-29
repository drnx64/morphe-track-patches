import { useState, useEffect, useRef } from 'react'
import { getCachedIconDataUrl, fetchAndCacheIcon } from '../../../services/iconCache'
import { FALLBACK_ICON } from '../../../utils/svg'

const COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#2980b9', '#27ae60', '#8e44ad',
  '#16a085', '#d35400', '#c0392b', '#2c3e50', '#7f8c8d',
]

function hashStr(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0
  }
  return Math.abs(hash)
}

function getLetterColor(pkg: string): string {
  return COLORS[hashStr(pkg) % COLORS.length]
}

function getLetter(pkg: string): string {
  const parts = pkg.split('.')
  const last = parts[parts.length - 1] || pkg
  return last.charAt(0).toUpperCase()
}

interface UpdatesAppIconProps {
  iconUrl: string
  pkg: string
  size?: number
  className?: string
}

export default function UpdatesAppIcon({ iconUrl, pkg, size = 26, className = '' }: UpdatesAppIconProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!iconUrl) {
      setSrc(null)
      setLoaded(false)
      return
    }

    const cached = getCachedIconDataUrl(iconUrl)
    if (cached) {
      setSrc(cached)
      setLoaded(true)
      return
    }

    fetchAndCacheIcon(iconUrl).then((dataUrl) => {
      if (!mountedRef.current) return
      if (dataUrl) setSrc(dataUrl)
      setLoaded(true)
    }).catch(() => {
      if (!mountedRef.current) return
      setLoaded(true)
    })
  }, [iconUrl])

  const style: React.CSSProperties = { width: size, height: size, borderRadius: size > 30 ? 10 : 8 }

  const letter = getLetter(pkg)
  const bgColor = getLetterColor(pkg)

  return (
    <div className={`updates-app-icon-wrap ${className}`} style={{ ...style, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bgColor,
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.45,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          lineHeight: 1,
          borderRadius: 'inherit',
        }}
      >
        {letter}
      </div>
      {src && (
        <img
          src={src}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            borderRadius: 'inherit',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_ICON) e.currentTarget.src = FALLBACK_ICON
          }}
        />
      )}
    </div>
  )
}
