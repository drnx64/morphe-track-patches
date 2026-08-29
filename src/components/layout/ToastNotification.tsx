import { useEffect, useState, useCallback } from 'react'
import { INFO_ICON, CLOSE_ICON } from '../../utils/svg'

export default function ToastNotification() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  const hide = useCallback(() => {
    setVisible(false)
    setMessage('')
  }, [])

  useEffect(() => {
    const handler = (msg: MessageEvent) => {
      if (msg.data?.type === 'DATA_UPDATED') {
        setMessage('New patch data available — refresh to update')
        setVisible(true)
        setTimeout(hide, 8000)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [hide])

  if (!visible) return null

  return (
    <div className={`toast-notification${visible ? ' visible' : ''}`} id="toast-notification">
      <span className="toast-icon" dangerouslySetInnerHTML={{ __html: INFO_ICON }} />
      <span className="toast-message" id="toast-message">{message}</span>
      <button className="toast-close" id="toast-close-btn" aria-label="Dismiss" onClick={hide} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
    </div>
  )
}
