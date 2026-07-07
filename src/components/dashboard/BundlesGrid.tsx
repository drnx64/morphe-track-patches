import { useMemo } from 'react'
import { useAppContext } from '../../context/AppContext'
import { resolveAppName, sortBundleNames } from '../../utils/misc'
import BundleCard from './BundleCard'
import { SkeletonGrid } from '../shared/Skeleton'
import type { BundleEntry } from '../../types/bundles'

interface BundlesGridProps {
  loading: boolean
}

export default function BundlesGrid({ loading }: BundlesGridProps) {
  const { state } = useAppContext()

  const grouped: Record<string, BundleEntry> = useMemo(() => {
    const g: Record<string, BundleEntry> = {}
    for (const b of Object.values(state.bundles)) {
      if (state.filters.channel !== 'all' && b.channel !== state.filters.channel) continue
      if (!g[b.bundle]) {
        g[b.bundle] = {
          bundle: b.bundle,
          channels: [b.channel],
          repo_url: b.repo_url,
          version: b.version || '',
          created_at: b.created_at,
          apps: [...(b.apps || [])],
        }
      } else {
        if (b.version && !g[b.bundle].version) g[b.bundle].version = b.version
        if (!g[b.bundle].channels.includes(b.channel)) g[b.bundle].channels.push(b.channel)
        const existingPkgs = new Set(g[b.bundle].apps.map((a) => a.package))
        for (const app of b.apps || []) {
          if (!existingPkgs.has(app.package)) {
            g[b.bundle].apps.push(app)
            existingPkgs.add(app.package)
          }
        }
      }
    }
    return g
  }, [state.bundles, state.filters.channel])

  const filtered = useMemo(() => {
    let list = Object.values(grouped)
    if (state.filters.search) {
      const q = state.filters.search
      list = list.filter((b) => {
        if (b.bundle.toLowerCase().includes(q)) return true
        return b.apps?.some(
          (app) =>
            resolveAppName(app, state.nameCache).toLowerCase().includes(q) ||
            app.package.toLowerCase().includes(q),
        )
      })
    }
    return sortBundleNames(list)
  }, [grouped, state.filters.search, state.nameCache])

  if (loading && Object.keys(state.bundles).length === 0) {
    return (
      <section className="bundles-section" aria-labelledby="bundles-heading">
        <h2 className="section-title" id="bundles-heading">Patch Bundles</h2>
        <div className="bundles-grid" id="bundles-grid-container">
          <SkeletonGrid />
        </div>
      </section>
    )
  }

  return (
    <section className="bundles-section" aria-labelledby="bundles-heading">
      <h2 className="section-title" id="bundles-heading">Patch Bundles</h2>
      <div className={`bundles-grid${state.viewMode === 'list' ? ' list-view' : ''}`} id="bundles-grid-container">
        {filtered.length === 0 ? (
          <div className="loading-state">No matching Morphe bundles found.</div>
        ) : (
          filtered.map((b) => <BundleCard key={b.bundle} bundle={b} />)
        )}
      </div>
    </section>
  )
}
