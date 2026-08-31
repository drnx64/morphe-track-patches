import type { AppData } from '../../../types/bundles'
import { SHAPE_CIRCLE, SHAPE_CROSS, SHAPE_TRIANGLE } from '../../../utils/svg'

interface AppChipsProps {
  app: AppData
  compact?: boolean
}

interface Chip {
  shape?: string
  symbol?: string
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

  // Triangle — major update (5+ patches changed)
  if (app.badge_type === 'MAJOR UPDATE') {
    chips.push({
      shape: SHAPE_TRIANGLE,
      label: 'Major update',
      className: 'app-chip-major',
    })
  }

  // Circle — removed from bundle
  if (app.badge_type === 'REMOVED APP') {
    chips.push({
      shape: SHAPE_CIRCLE,
      label: 'Removed',
      className: 'app-chip-removed',
    })
  }

  // Cross — promoted from dev to stable
  if (app.promoted_from) {
    chips.push({
      shape: SHAPE_CROSS,
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
      {chips.map((chip, i) => (
        <span
          key={i}
          className={`app-chip ${chip.className}`}
          title={chip.label}
        >
          {chip.shape
            ? <span className="app-chip-icon" dangerouslySetInnerHTML={{ __html: chip.shape }} />
            : chip.symbol
          }
        </span>
      ))}
    </span>
  )
}

export const CHIP_LEGEND: { shape?: string; symbol?: string; label: string; className: string }[] = [
  { symbol: '!', label: 'Scan updates (count = number of scans)', className: 'app-chip-scan-count' },
  { shape: SHAPE_TRIANGLE, label: 'Major update (5+ patches)', className: 'app-chip-major' },
  { shape: SHAPE_CIRCLE, label: 'Removed from bundle', className: 'app-chip-removed' },
  { shape: SHAPE_CROSS, label: 'Promoted from dev', className: 'app-chip-promoted' },
]
