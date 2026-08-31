import type { PatchDiff } from '../../../types/bundles'
import { SHAPE_SQUARE, SHAPE_CIRCLE, SHAPE_CROSS } from '../../../utils/svg'

function getPatchName(entry: string | { name: string; description?: string }): string {
  return typeof entry === 'string' ? entry : entry.name
}

interface PatchDiffInlineProps {
  patchDiff: PatchDiff
  compact?: boolean
}

export default function PatchDiffInline({ patchDiff, compact = false }: PatchDiffInlineProps) {
  const added = patchDiff.patches_added || []
  const removed = patchDiff.patches_removed || []
  const modified = patchDiff.patches_modified || []

  if (added.length === 0 && removed.length === 0 && modified.length === 0) return null

  if (compact) {
    const items: { count: number; shape: string; cls: string }[] = []
    if (added.length) items.push({ count: added.length, shape: SHAPE_SQUARE, cls: 'diff-added' })
    if (removed.length) items.push({ count: removed.length, shape: SHAPE_CIRCLE, cls: 'diff-removed' })
    if (modified.length) items.push({ count: modified.length, shape: SHAPE_CROSS, cls: 'diff-modified' })
    return (
      <span className="patch-diff-inline">
        {items.map((item, i) => (
          <span key={i} className={`patch-diff-chip ${item.cls}`}>
            <span className="patch-diff-chip-icon" dangerouslySetInnerHTML={{ __html: item.shape }} />
            <span className="patch-diff-chip-count">{item.count}</span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className="patch-diff-names">
      {added.map((p, i) => (
        <span key={`a-${i}`} className="patch-diff-name added">
          <span className="patch-diff-name-icon" dangerouslySetInnerHTML={{ __html: SHAPE_SQUARE }} />
          {getPatchName(p)}
        </span>
      ))}
      {removed.map((p, i) => (
        <span key={`r-${i}`} className="patch-diff-name removed">
          <span className="patch-diff-name-icon" dangerouslySetInnerHTML={{ __html: SHAPE_CIRCLE }} />
          {getPatchName(p)}
        </span>
      ))}
      {modified.map((p, i) => (
        <span key={`m-${i}`} className="patch-diff-name modified">
          <span className="patch-diff-name-icon" dangerouslySetInnerHTML={{ __html: SHAPE_CROSS }} />
          {getPatchName(p)}
        </span>
      ))}
    </div>
  )
}
