import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import ErrorBoundary from './components/layout/ErrorBoundary'
import Background from './components/background/Background'
import AppsPage from './components/apps/AppsPage'
import BundlesPage from './components/bundles/BundlesPage'
import BundleDetailPage from './components/bundles/BundleDetailPage'
import DiffPage from './components/diff/DiffPage'

const ChangelogPage = lazy(() => import('./components/changelog/ChangelogPage'))

export default function App() {
  const { state } = useAppContext()

  useEffect(() => {
    const fallback = setTimeout(() => {
      void import('./components/changelog/ChangelogPage')
    }, 2000)
    return () => clearTimeout(fallback)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', state.reducedMotion)
  }, [state.reducedMotion])

  return (
    <ErrorBoundary>
      <Background />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={
            <ErrorBoundary>
              <AppsPage />
            </ErrorBoundary>
          } />
          <Route path="/apps" element={<Navigate to="/" replace />} />
          <Route path="/bundles" element={
            <ErrorBoundary>
              <BundlesPage />
            </ErrorBoundary>
          } />
          <Route path="/bundle/:bundleName" element={
            <ErrorBoundary>
              <BundleDetailPage />
            </ErrorBoundary>
          } />
          <Route path="/changelog" element={
            <ErrorBoundary>
              <ChangelogPage />
            </ErrorBoundary>
          } />
          <Route path="/diff" element={<DiffPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
