/**
 * Modal — accessible focus-trap modal with ESC close.
 */
import { el } from '../ui.js'
import { CLOSE_ICON } from '../utils/svg.js'

let activeModal = null

/**
 * Open a modal with content.
 * @param {Object} options
 * @param {string} options.title
 * @param {string|Node} options.content
 * @param {string} [options.className]
 * @param {number} [options.maxWidth]
 */
export function openModal({ title, content, className = '', maxWidth = 700 }) {
  closeModal()

  const overlay = el('div', { class: `modal-overlay ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title })

  const modalBox = el('div', { class: 'modal-box', style: { maxWidth: maxWidth + 'px' } })

  const header = el('div', { class: 'modal-header' }, [
    el('h2', { class: 'modal-title' }, [title]),
    el('button', { class: 'modal-close', 'aria-label': 'Close modal', dangerouslySetInnerHTML: CLOSE_ICON }),
  ])

  const body = el('div', { class: 'modal-body' })
  if (typeof content === 'string') {
    body.innerHTML = content
  } else if (content instanceof Node) {
    body.appendChild(content)
  }

  modalBox.appendChild(header)
  modalBox.appendChild(body)
  overlay.appendChild(modalBox)

  // Close handlers
  const closeBtn = header.querySelector('.modal-close')
  closeBtn.addEventListener('click', closeModal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal()
  })

  document.addEventListener('keydown', handleEsc)
  document.addEventListener('keydown', handleFocusTrap)

  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  document.body.style.overflow = 'hidden'
  activeModal = overlay

  // Focus trap
  requestAnimationFrame(() => {
    const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (focusable.length) focusable[0].focus()
  })

  return overlay
}

export function closeModal() {
  if (!activeModal) return
  activeModal.classList.remove('open')
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleEsc)
  document.removeEventListener('keydown', handleFocusTrap)
  const ref = activeModal
  activeModal = null
  setTimeout(() => ref.remove(), 300)
}

function handleEsc(e) {
  if (e.key === 'Escape') closeModal()
}

function handleFocusTrap(e) {
  if (e.key !== 'Tab' || !activeModal) return
  const focusable = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

export function isModalOpen() {
  return !!activeModal
}
