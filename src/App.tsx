import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './components/dashboard/DashboardPage'

const ChangelogPage = lazy(() => import('./components/changelog/ChangelogPage'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/changelog.html" element={<ChangelogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
