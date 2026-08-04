import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/layout/ErrorBoundary'
import LoadingOverlay from './components/layout/LoadingOverlay'
import Background from './components/background/Background'
import AppsPage from './components/apps/AppsPage'
import BundlesPage from './components/bundles/BundlesPage'
import DiffPage from './components/diff/DiffPage'

const ChangelogPage = lazy(() => import('./components/changelog/ChangelogPage'))

export default function App() {
  return (
    <ErrorBoundary>
      <Background />
      <LoadingOverlay />
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
