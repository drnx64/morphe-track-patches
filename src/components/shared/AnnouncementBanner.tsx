import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnnouncements, type Announcement } from './useAnnouncements'
import { INFO_ICON, WARNING_ICON, ARROW_RIGHT, CLOSE_ICON } from '../../utils/svg'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    handler(mq)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

const PRIORITY_ICON: Record<string, string> = {
  info: INFO_ICON,
  warning: WARNING_ICON,
  urgent: WARNING_ICON,
}

export default function AnnouncementBanner() {
  const ctx = useAnnouncements()
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [closed, setClosed] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    setClosed(false)
    setCurrentIndex(0)
  }, [ctx?.unreadCount])

  const dismiss = useCallback(() => {
    if (!ctx || !ctx.unread[currentIndex]) return
    const msg = ctx.unread[currentIndex]
    ctx.dismiss(msg.id)
    if (msg.autoDismiss) {
      setClosed(true)
    }
    setCurrentIndex(0)
    setExpanded(false)
  }, [ctx, currentIndex])

  const dismissAll = useCallback(() => {
    ctx?.dismissAll()
    setClosed(true)
    setCurrentIndex(0)
    setExpanded(false)
  }, [ctx])

  const next = useCallback(() => {
    if (!ctx) return
    setCurrentIndex((i) => (i + 1) % ctx.unread.length)
    setExpanded(false)
  }, [ctx])

  const handleCtaClick = useCallback((url: string) => {
    if (url.startsWith('/')) {
      navigate(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
    dismiss()
  }, [navigate, dismiss])

  if (!ctx || ctx.unread.length === 0 || closed) return null

  const msg = ctx.unread[currentIndex]
  if (!msg) return null

  const icon = PRIORITY_ICON[msg.priority] || INFO_ICON

  if (isMobile) {
    return (
      <div className="announcement-mobile-overlay" onClick={dismissAll}>
        <div className="announcement-mobile-modal" onClick={(e) => e.stopPropagation()}>
          <div className="announcement-mobile-header">
            <span className={`announcement-mobile-icon priority-${msg.priority}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
            <strong className="announcement-mobile-title">{msg.title}</strong>
            <button className="announcement-mobile-close" aria-label="Dismiss" onClick={dismiss} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
          </div>
          <div className="announcement-mobile-body">
            <span className={expanded ? '' : 'announcement-clamp'}>{msg.body}</span>
            {msg.body.length > 80 && (
              <span className="announcement-expand-hint">{expanded ? 'show less' : 'read more'}</span>
            )}
          </div>
          {msg.url && (
            <div className="announcement-mobile-cta">
              <button className={`announcement-cta-btn priority-${msg.priority}`} onClick={() => handleCtaClick(msg.url!)}>
                Learn more <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} />
              </button>
            </div>
          )}
          {ctx.unread.length > 1 && (
            <div className="announcement-mobile-footer">
              <span className="announcement-mobile-count">{currentIndex + 1} of {ctx.unread.length}</span>
              <div className="announcement-mobile-actions">
                <button className="announcement-next-btn" onClick={next}>Next <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} /></button>
                <button className="announcement-dismiss-all-btn" onClick={dismissAll}>Dismiss all</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="announcement-floating" role="alert">
      <div className="announcement-floating-header">
        <span className={`announcement-floating-icon priority-${msg.priority}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
        <strong className="announcement-floating-title">{msg.title}</strong>
        <div className="announcement-floating-actions">
          {ctx.unread.length > 1 && (
            <span className="announcement-floating-count">{currentIndex + 1}/{ctx.unread.length}</span>
          )}
          <button className="announcement-floating-close" aria-label="Dismiss" onClick={dismiss} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
        </div>
      </div>
      <div className="announcement-floating-body" onClick={() => setExpanded(!expanded)}>
        <span className={expanded ? '' : 'announcement-clamp'}>{msg.body}</span>
        {msg.body.length > 80 && (
          <span className="announcement-expand-hint">{expanded ? 'show less' : 'read more'}</span>
        )}
      </div>
      {msg.url && (
        <div className="announcement-floating-cta">
          <button className={`announcement-cta-btn priority-${msg.priority}`} onClick={() => handleCtaClick(msg.url!)}>
            Learn more <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} />
          </button>
        </div>
      )}
      {ctx.unread.length > 1 && (
        <div className="announcement-floating-footer">
          <button className="announcement-next-btn" onClick={next}>Next <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} /></button>
          <button className="announcement-dismiss-all-btn" onClick={dismissAll}>Dismiss all</button>
        </div>
      )}
    </div>
  )
}
