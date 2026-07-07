interface SkeletonProps {
  width?: string
  height?: string
  style?: React.CSSProperties
  className?: string
}

export function SkeletonBlock({ width, height, style, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{ ...style, width, height }}
    />
  )
}

export function SkeletonText({ width = '60%', height = '14px', style, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-block skeleton-text ${className}`}
      style={{ ...style, width, height }}
    />
  )
}

export function SkeletonBadge({ style }: SkeletonProps) {
  return <div className="skeleton-block skeleton-badge" style={style} />
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div style={{ flex: 1 }}>
          <SkeletonText height="18px" style={{ marginBottom: '6px' }} />
          <SkeletonBadge />
        </div>
        <SkeletonBlock width="32px" height="32px" style={{ borderRadius: '50%' }} />
      </div>
      <SkeletonText className="short" height="12px" />
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

export function SkeletonUpdates() {
  return (
    <>
      <div className="skeleton-update-row">
        <SkeletonBadge />
        <SkeletonText height="16px" style={{ margin: 0 }} />
      </div>
      <div className="skeleton-update-row" style={{ marginLeft: '1rem' }}>
        <SkeletonBadge />
        <SkeletonText className="long" height="14px" style={{ margin: 0 }} />
      </div>
      <div className="skeleton-update-row" style={{ marginLeft: '1rem' }}>
        <SkeletonBadge />
        <SkeletonText height="14px" style={{ margin: 0 }} />
      </div>
    </>
  )
}

export function SkeletonChangelog() {
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    backdropFilter: 'blur(10px)',
    borderRadius: 'var(--border-radius)',
    padding: '1.25rem',
    marginBottom: '1rem',
    border: '1px solid var(--border-color)',
  }
  return (
    <>
      <div style={cardStyle}>
        <SkeletonText height="18px" width="30%" style={{ marginBottom: '1rem' }} />
        <SkeletonText height="14px" width="50%" style={{ marginBottom: '0.5rem' }} />
        <SkeletonText height="12px" width="80%" style={{ marginLeft: '1rem', marginBottom: '0.4rem' }} />
        <SkeletonText height="12px" width="65%" style={{ marginLeft: '1rem' }} />
      </div>
      <div style={{ ...cardStyle, marginTop: '1rem' }}>
        <SkeletonText height="18px" width="25%" style={{ marginBottom: '1rem' }} />
        <SkeletonText height="14px" width="45%" style={{ marginBottom: '0.5rem' }} />
        <SkeletonText height="12px" width="70%" style={{ marginLeft: '1rem', marginBottom: '0.4rem' }} />
        <SkeletonText height="12px" width="55%" style={{ marginLeft: '1rem' }} />
      </div>
    </>
  )
}
