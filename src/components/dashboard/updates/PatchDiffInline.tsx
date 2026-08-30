import type { PatchDiff } from '../../../types/bundles'

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
    const parts: string[] = []
    if (added.length) parts.push(`+${added.length}`)
    if (removed.length) parts.push(`-${removed.length}`)
    if (modified.length) parts.push(`~${modified.length}`)
    return (
      <span className="patch-diff-inline">
        {parts.map((p, i) => (
          <span key={i} className={`badge ${p.startsWith('+') ? 'badge-patches-added' : p.startsWith('-') ? 'badge-patches-removed' : 'badge-updated'}`}>
            {p} patch{p.slice(1) !== '1' ? 'es' : ''}
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className="patch-diff-names">
      {added.map((p, i) => (
        <span key={`a-${i}`} className="patch-diff-name added">+ {getPatchName(p)}</span>
      ))}
      {removed.map((p, i) => (
        <span key={`r-${i}`} className="patch-diff-name removed">- {getPatchName(p)}</span>
      ))}
      {modified.map((p, i) => (
        <span key={`m-${i}`} className="patch-diff-name modified">~ {getPatchName(p)}</span>
      ))}
    </div>
  )
}
