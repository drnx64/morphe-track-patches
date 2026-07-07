import { useState, useEffect } from 'react'
import { getNextScanTime, getScanBatch } from '../utils/misc'
import { padNum, getTimeAgo } from '../utils/format'

export function useScanClocks(lastChecked: string, liveDataDate: string) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const utcStr = `${padNum(now.getUTCHours())}:${padNum(now.getUTCMinutes())}:${padNum(now.getUTCSeconds())}`

  const localH = now.getHours() % 12 || 12
  const localAmpm = now.getHours() >= 12 ? 'PM' : 'AM'
  const localStr = `${localH}:${padNum(now.getMinutes())}:${padNum(now.getSeconds())} ${localAmpm}`

  const nextScan = lastChecked
    ? new Date(new Date(lastChecked).getTime() + 3 * 3600000)
    : getNextScanTime()
  const diffMs = nextScan.getTime() - now.getTime()
  const totalSec = Math.max(0, Math.floor(diffMs / 1000))
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  const isScanning = now.getUTCMinutes() <= 3 && now.getUTCSeconds() < 30
  const countdownStr = isScanning ? 'SCANNING...' : `${padNum(hrs)}:${padNum(mins)}:${padNum(secs)}`
  const isUrgent = !isScanning && totalSec < 300

  const isToday = liveDataDate === now.toISOString().split('T')[0]

  return {
    utcStr,
    localStr,
    countdownStr,
    isScanning,
    isUrgent,
    isFresh: isToday,
    batch: getScanBatch(),
    lastCheckedAgo: getTimeAgo(lastChecked),
  }
}
