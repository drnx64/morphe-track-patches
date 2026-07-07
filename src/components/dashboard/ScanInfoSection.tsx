import { useAppContext } from '../../context/AppContext'
import { useScanClocks } from '../../hooks/useScanClocks'

export default function ScanInfoSection() {
  const { state } = useAppContext()
  const { utcStr, localStr, countdownStr, isScanning, isUrgent, isFresh, batch, lastCheckedAgo } = useScanClocks(
    state.lastChecked,
    state.liveDataDate,
  )

  return (
    <section className="scan-info-section" aria-labelledby="scan-info-heading">
      <h2 className="sr-only" id="scan-info-heading">Scan Schedule</h2>
      <div className="scan-info-card">
        <div className="scan-info-left">
          <div className="scan-info-row scan-info-row-countdown">
            <span className="scan-info-label">Next scan in</span>
            <span
              className={`scan-countdown${isScanning ? ' scan-countdown--scanning' : ''}${isUrgent ? ' scan-countdown--urgent' : ''}`}
              id="scan-countdown"
            >
              {countdownStr}
            </span>
          </div>
          <div className="scan-info-row">
            <span className="scan-info-label">Schedule</span>
            <span className="scan-info-value">Every 3 hours at :01 UTC</span>
          </div>
          <div className="scan-info-row">
            <span className="scan-info-label">Today's scans</span>
            <span className="scan-info-value" id="scan-today-count">Scan {batch} of 8</span>
          </div>
        </div>
        <div className="scan-info-divider" />
        <div className="scan-info-right">
          <div className="scan-info-row">
            <span className="scan-info-label">UTC now</span>
            <span className="scan-info-value mono" id="scan-utc-time">{utcStr}</span>
          </div>
          <div className="scan-info-row">
            <span className="scan-info-label">Local time</span>
            <span className="scan-info-value" id="scan-local-time">{localStr}</span>
          </div>
          <div className="scan-info-row">
            <span className="scan-info-label">Last scan</span>
            <span className="scan-info-value" id="scan-last-run-ago">{lastCheckedAgo}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
