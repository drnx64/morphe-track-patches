import type { AppData } from '../../../types/bundles'

interface AppChipsProps {
  app: AppData
  compact?: boolean
}

interface Chip {
  symbol: string
  label: string
  className: string
}

function buildChips(app: AppData): Chip[] {
  const chips: Chip[] = []

  // ! × N — number of scans that updated this app today
  const scanCount = app.scan_numbers?.length ?? 0
  if (scanCount > 0) {
    const symbols = '!'.repeat(scanCount)
    chips.push({
      symbol: symbols,
      label: scanCount === 1 ? '1 scan update' : `${scanCount} scan updates`,
      className: 'app-chip-scan-count',
    })
  }

  // @ — new patches added to this app
  if (app.patch_diff?.patches_added && app.patch_diff.patches_added.length > 0) {
    const count = app.patch_diff.patches_added.length
    chips.push({
      symbol: '@',
      label: count === 1 ? '1 new patch' : `${count} new patches`,
      className: 'app-chip-new-patch',
    })
  }

  // # — major update (5+ patches changed)
  if (app.badge_type === 'MAJOR UPDATE') {
    chips.push({
      symbol: '#',
      label: 'Major update',
      className: 'app-chip-major',
    })
  }

  // $ — removed from bundle
  if (app.badge_type === 'REMOVED APP') {
    chips.push({
      symbol: '$',
      label: 'Removed',
      className: 'app-chip-removed',
    })
  }

  // ~ — promoted from dev to stable
  if (app.promoted_from) {
    chips.push({
      symbol: '~',
      label: 'Promoted from dev',
      className: 'app-chip-promoted',
    })
  }

  return chips
}

export default function AppChips({ app, compact }: AppChipsProps) {
  const chips = buildChips(app)
  if (chips.length === 0) return null

  return (
    <span className={`app-chips${compact ? ' app-chips-compact' : ''}`}>
      {chips.map((chip) => (
        <span
          key={chip.symbol}
          className={`app-chip ${chip.className}`}
          title={chip.label}
        >
          {chip.symbol}
        </span>
      ))}
    </span>
  )
}

export const CHIP_LEGEND: { symbol: string; label: string; className: string }[] = [
  { symbol: '!', label: 'Scan updates (count = number of scans)', className: 'app-chip-scan-count' },
  { symbol: '@', label: 'New patches added', className: 'app-chip-new-patch' },
  { symbol: '#', label: 'Major update (5+ patches)', className: 'app-chip-major' },
  { symbol: '$', label: 'Removed from bundle', className: 'app-chip-removed' },
  { symbol: '~', label: 'Promoted from dev', className: 'app-chip-promoted' },
]
