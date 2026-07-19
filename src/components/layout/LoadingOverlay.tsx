import { useState, useEffect, useRef } from 'react'
import { useAppContext } from '../../context/AppContext'

export default function LoadingOverlay() {
  const { state } = useAppContext()
  const [forceHide, setForceHide] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.loading) return
    setForceHide(false)
    setElapsed(0)
    const timer = setTimeout(() => setForceHide(true), 30000)
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => { clearTimeout(timer); clearInterval(interval) }
  }, [state.loading])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.loadingLog])

  if (!state.loading || forceHide) return null

  return (
    <div className="loading-overlay" id="loading-overlay">
      <div className="loading-box">
        <div className="loading-logo">MT</div>
        <div className="loading-spinner" />
        <div className="loading-progress-text">{state.loadingStatus} {state.loadingProgress}%</div>
        <div className="loading-progress-bar-track">
          <div className="loading-progress-bar-fill" style={{ width: state.loadingProgress + '%' }} />
        </div>
        {state.loadingLog.length > 0 && (
          <div className="loading-console">
            {state.loadingLog.map((msg, i) => (
              <div key={i} className={
                msg.startsWith('Fetching') ? 'loading-console-line loading-console-line--fetch' :
                msg.includes('✓') ? 'loading-console-line loading-console-line--ok' :
                msg.startsWith('Processing') || msg.startsWith('Building') ? 'loading-console-line loading-console-line--work' :
                msg.startsWith('─') ? 'loading-console-line loading-console-line--sep' :
                msg.startsWith('[done]') || msg.startsWith('✓ done') ? 'loading-console-line loading-console-line--done' :
                msg.startsWith('[diff]') || msg.startsWith('  ') && !msg.includes('✓') ? 'loading-console-line loading-console-line--sub' :
                'loading-console-line'
              }>
                <span>{msg}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
        {elapsed > 5 && state.loadingLog.length === 0 && (
          <div className="loading-hint">
            {elapsed > 15 ? 'Still working... this may take a moment on first visit' : 'Loading patches data...'}
          </div>
        )}
      </div>
    </div>
  )
}