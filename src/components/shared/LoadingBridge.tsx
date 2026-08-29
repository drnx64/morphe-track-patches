import { useEffect, useRef } from 'react'
import { useAppContext } from '../../context/AppContext'

export default function LoadingBridge() {
  const { state } = useAppContext()
  const removedRef = useRef(false)

  useEffect(() => {
    if (removedRef.current) return

    const textEl = document.getElementById('loading-progress-text')
    const barEl = document.getElementById('loading-progress-bar')
    if (textEl) textEl.textContent = state.loadingStatus
    if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, state.loadingProgress))}%`
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
