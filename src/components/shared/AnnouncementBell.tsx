import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnnouncements, type Announcement } from './useAnnouncements'
import { INFO_ICON, WARNING_ICON, ARROW_RIGHT, CLOSE_ICON } from '../../utils/svg'

const PRIORITY_ICON: Record<string, string> = {
  info: INFO_ICON,
  warning: WARNING_ICON,
  urgent: WARNING_ICON,
}

export default function AnnouncementBell() {
  const ctx = useAnnouncements()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  const handleDismiss = useCallback((id: string) => {
    ctx?.dismiss(id)
  }, [ctx])

  const handleDismissAll = useCallback(() => {
    ctx?.dismissAll()
  }, [ctx])

  const handleCtaClick = useCallback((url: string) => {
    setModalOpen(false)
    if (url.startsWith('/')) {
      navigate(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }, [navigate])

  if (!ctx || ctx.all.length === 0) return null

  return (
    <>
      <button className="announcement-bell" aria-label={`${ctx.unreadCount} unread announcement${ctx.unreadCount !== 1 ? 's' : ''}`} onClick={() => setModalOpen(true)}>
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6Zm0 16a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z" />
        </svg>
        {ctx.unreadCount > 0 && <span className="announcement-bell-badge">{ctx.unreadCount}</span>}
      </button>

      {modalOpen && (
        <div className="announcement-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="announcement-modal-header">
              <h3 className="announcement-modal-title">Announcements</h3>
              <div className="announcement-modal-header-actions">
                {ctx.unreadCount > 0 && (
                  <button className="announcement-dismiss-all-btn" onClick={handleDismissAll}>Dismiss all</button>
                )}
                <button className="announcement-modal-close" aria-label="Close" onClick={() => setModalOpen(false)} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
              </div>
            </div>
            <div className="announcement-modal-body">
              {ctx.unread.map((msg) => (
                <AnnouncementItem key={msg.id} msg={msg} isRead={false} onDismiss={handleDismiss} onCta={handleCtaClick} />
              ))}
              {ctx.read.length > 0 && ctx.unread.length > 0 && (
                <div className="announcement-modal-divider"><span>Previously seen</span></div>
              )}
              {ctx.read.map((msg) => (
                <AnnouncementItem key={msg.id} msg={msg} isRead={true} onDismiss={handleDismiss} onCta={handleCtaClick} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AnnouncementItem({ msg, isRead, onDismiss, onCta }: { msg: Announcement; isRead: boolean; onDismiss: (id: string) => void; onCta: (url: string) => void }) {
  const icon = PRIORITY_ICON[msg.priority] || INFO_ICON
  return (
    <div className={`announcement-modal-item${isRead ? ' read' : ''}`}>
      <div className="announcement-modal-item-header">
        <span className={`announcement-modal-item-icon priority-${msg.priority}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
        <strong className="announcement-modal-item-title">{msg.title}</strong>
        <button className="announcement-modal-item-dismiss" aria-label="Dismiss" onClick={() => onDismiss(msg.id)} dangerouslySetInnerHTML={{ __html: CLOSE_ICON }} />
      </div>
      <p className="announcement-modal-item-body">{msg.body}</p>
      <div className="announcement-modal-item-footer">
        <span className="announcement-modal-item-date">{msg.date}</span>
        {msg.url && (
          <button className={`announcement-cta-btn compact priority-${msg.priority}`} onClick={() => onCta(msg.url!)}>
            View <span dangerouslySetInnerHTML={{ __html: ARROW_RIGHT }} />
          </button>
        )}
      </div>
    </div>
  )
}
