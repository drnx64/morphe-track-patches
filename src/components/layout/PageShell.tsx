import Header from './Header'
import Footer from './Footer'
import BackToTopButton from './BackToTopButton'
import ToastNotification from './ToastNotification'
import AnnouncementBanner from '../shared/AnnouncementBanner'
import { FetchErrorBanner } from '../shared/FetchErrorBanner'
import { AnnouncementsProvider } from '../shared/useAnnouncements'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export default function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <AnnouncementsProvider>
      <Header />
      <AnnouncementBanner />
      <FetchErrorBanner />
      <main className={`dashboard-container${className ? ' ' + className : ''}`}>
        {children}
      </main>
      <Footer />
      <BackToTopButton />
      <ToastNotification />
    </AnnouncementsProvider>
  )
}
