import { useAppContext } from '../../context/AppContext'

const LABELS: [number, string][] = [
  [0, 'Initializing...'],
  [10, 'Checking cache...'],
  [20, 'Loading icons...'],
  [40, 'Loading app names...'],
  [55, 'Fetching live data...'],
  [80, 'Processing data...'],
  [90, 'Finalizing...'],
]

function getLabel(progress: number): string {
  for (let i = LABELS.length - 1; i >= 0; i--) {
    if (progress >= LABELS[i][0]) return LABELS[i][1]
  }
  return 'Loading...'
}

export default function LoadingOverlay() {
  const { state } = useAppContext()

  if (!state.loading) return null

  return (
    <div className="loading-overlay" id="loading-overlay">
      <div className="loading-box">
        <div className="loading-logo">MT</div>
        <div className="loading-spinner" />
        <div className="loading-progress-text">{getLabel(state.loadingProgress)} {state.loadingProgress}%</div>
        <div className="loading-progress-bar-track">
          <div className="loading-progress-bar-fill" style={{ width: state.loadingProgress + '%' }} />
        </div>
      </div>
    </div>
  )
}