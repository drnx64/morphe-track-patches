interface BadgeProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Badge({ children, className = '', style }: BadgeProps) {
  return (
    <span className={`badge ${className}`} style={style}>
      {children}
    </span>
  )
}

export const BADGE_CLASSES = {
  NEW_BUNDLE: 'badge-new-bundle',
  UPDATED_BUNDLE: 'badge-updated-bundle',
  NEW_APP: 'badge-new',
  UPDATED_APP: 'badge-updated',
  REMOVED_APP: 'badge-removed',
  PRE_RELEASE: 'badge-pre-release',
  PROMOTED: 'badge-promoted',
  NEW_PATCH: 'badge-new-patch',
  DEV: 'badge-dev',
  SCAN: 'badge-scan',
} as const
