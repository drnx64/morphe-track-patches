import { useEffect, useCallback, useRef } from 'react'

interface ModalProps {
  id: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  ariaLabel?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export default function Modal({ id, open, onClose, children, wide, ariaLabel }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab' || !boxRef.current) return
    const focusables = boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey) {
      if (active === first || !boxRef.current.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last || !boxRef.current.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [onClose])

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      const closeBtn = document.querySelector(`#${id} .modal-close`) as HTMLElement
      closeBtn?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      prevFocus.current?.focus()
      prevFocus.current = null
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
      <div ref={boxRef} className={`modal-box${wide ? ' modal-box--wide' : ''}`}>
        {children}
      </div>
    </div>
  )
}
