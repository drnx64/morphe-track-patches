import { useEffect, useCallback } from 'react'

interface ModalProps {
  id: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  ariaLabel?: string
}

export default function Modal({ id, open, onClose, children, wide, ariaLabel }: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      const closeBtn = document.querySelector(`#${id} .modal-close`) as HTMLElement
      closeBtn?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown, id])

  return (
    <div
      id={id}
      className={`modal-overlay${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`modal-box${wide ? ' modal-box--wide' : ''}`}>
        {children}
      </div>
    </div>
  )
}
