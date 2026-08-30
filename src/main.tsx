import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import App from './App'
import LoadingBridge from './components/shared/LoadingBridge'
import '../assets/style.css'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[MorpheTracker] SW registration failed:', err)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <LoadingBridge />
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
