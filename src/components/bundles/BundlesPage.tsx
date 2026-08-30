import { useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { usePageMeta } from '../../hooks/usePageMeta'
import { isNewScan } from '../../utils/lastVisit'
import PageShell from '../layout/PageShell'
import StatsSection from '../dashboard/StatsSection'
import ScanInfoSection from '../dashboard/ScanInfoSection'
import ControlsSection from '../dashboard/ControlsSection'
import BundlesGrid from '../dashboard/BundlesGrid'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'

export default function BundlesPage() {
  const { state, dispatch } = useAppContext()
  const { loading } = useDataFetching()
  usePageMeta(
    'Bundles',
    'Browse Morphe patch bundles across stable and dev channels with full version and release history.',
  )
  const [searchParams, setSearchParams] = useSearchParams()

  const showNewScan = isNewScan(state.lastChecked, state.lastVisitScan)

  const dismissNewScan = useCallback(() => {
    dispatch({ type: 'SET_LAST_VISIT_SCAN', payload: state.lastChecked })
  }, [dispatch, state.lastChecked])

  // Read URL params on mount to seed filter state
  useEffect(() => {
    const search = searchParams.get('search') || ''
    const channel = (searchParams.get('channel') as 'all' | 'stable' | 'dev') || 'all'
    dispatch({ type: 'SET_FILTERS', payload: { search, channel } })
    const searchInput = document.getElementById('search-input') as HTMLInputElement
    if (searchInput) searchInput.value = search
  }, [])

  // Sync filter state back to URL
  useEffect(() => {
    const { search, channel } = state.filters
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (search) {
        next.set('search', search)
      } else {
        next.delete('search')
      }
      if (channel && channel !== 'all') {
        next.set('channel', channel)
      } else {
        next.delete('channel')
      }
      return next
    }, { replace: true })
  }, [state.filters.search, state.filters.channel, setSearchParams])

  return (
    <>
      <PageShell>
        {showNewScan && (
          <div className="new-scan-banner" onClick={dismissNewScan}>
            <span className="updates-new-scan-dot" />
            <span>New data since your last visit</span>
          </div>
        )}
        <div className="top-info-row">
          <StatsSection />
          <ScanInfoSection />
        </div>
        <ControlsSection />
        <BundlesGrid loading={loading} />
      </PageShell>
      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}
