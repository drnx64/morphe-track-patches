import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import { usePageMeta } from '../../hooks/usePageMeta'
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
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const search = searchParams.get('search') || ''
    const channel = (searchParams.get('channel') as 'all' | 'stable' | 'dev') || 'all'
    dispatch({ type: 'SET_FILTERS', payload: { search, channel } })
    const searchInput = document.getElementById('search-input') as HTMLInputElement
    if (searchInput) searchInput.value = search
  }, [])

  return (
    <>
      <PageShell>
        <StatsSection />
        <ScanInfoSection />
        <ControlsSection />
        <BundlesGrid loading={loading} />
      </PageShell>
      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}
