import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './components/dashboard/DashboardPage'
import ErrorBoundary from './components/layout/ErrorBoundary'
import LoadingOverlay from './components/layout/LoadingOverlay'
import DiffPage from './components/diff/DiffPage'

const ChangelogPage = lazy(() => import('./components/changelog/ChangelogPage'))

export default function App() {
  return (
    <ErrorBoundary>
      <LoadingOverlay />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
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
