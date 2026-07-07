import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useDataFetching } from '../../hooks/useDataFetching'
import Header from '../layout/Header'
import Footer from '../layout/Footer'
import BackToTopButton from '../layout/BackToTopButton'
import ToastNotification from '../layout/ToastNotification'
import StatsSection from './StatsSection'
import ScanInfoSection from './ScanInfoSection'
import TodayUpdatesSection from './TodayUpdatesSection'
import ControlsSection from './ControlsSection'
import BundlesGrid from './BundlesGrid'
import AppDetailModal from '../modals/AppDetailModal'
import BundleDetailModal from '../modals/BundleDetailModal'
import BundleHistoryModal from '../modals/BundleHistoryModal'

export default function DashboardPage() {
  const { state, dispatch } = useAppContext()
  const { loading } = useDataFetching()
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
      <Header />
      <main className="dashboard-container">
        <div className="glow-container">
          <div className="glow-orb main-orb" />
          <div className="glow-orb sub-orb" />
        </div>

        <TodayUpdatesSection />
        <ScanInfoSection />
        <StatsSection />
        <ControlsSection />
        <BundlesGrid loading={loading} />
      </main>
      <Footer />
      <BackToTopButton />
      <ToastNotification />
      <AppDetailModal />
      <BundleDetailModal />
      <BundleHistoryModal />
    </>
  )
}
