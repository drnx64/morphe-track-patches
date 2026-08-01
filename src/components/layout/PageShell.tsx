import Header from './Header'
import Footer from './Footer'
import BackToTopButton from './BackToTopButton'
import ToastNotification from './ToastNotification'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export default function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <>
      <Header />
      <main className={`dashboard-container${className ? ' ' + className : ''}`}>
        {children}
      </main>
      <Footer />
      <BackToTopButton />
      <ToastNotification />
    </>
  )
}
