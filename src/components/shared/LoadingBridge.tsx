import { useEffect, useRef } from 'react'
import { useAppContext } from '../../context/AppContext'

export default function LoadingBridge() {
  const { state } = useAppContext()
  const removedRef = useRef(false)

  useEffect(() => {
    if (removedRef.current) return

    const textEl = document.getElementById('loading-progress-text')
    const barEl = document.getElementById('loading-progress-bar')
    const pctEl = document.getElementById('loading-progress-pct')
    const pct = Math.min(100, Math.max(0, state.loadingProgress))
    if (textEl) textEl.textContent = state.loadingStatus
    if (barEl) barEl.style.width = `${pct}%`
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
  }, [state.loadingProgress, state.loadingStatus])

  useEffect(() => {
    if (state.loading || removedRef.current) return

    const el = document.getElementById('loading-screen')
    if (!el) return

    el.classList.add('hidden')
    removedRef.current = true
    const timer = setTimeout(() => el.remove(), 600)
    return () => clearTimeout(timer)
  }, [state.loading])

  return null
}
