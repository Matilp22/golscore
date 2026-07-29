'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'

type MobileSheetProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function MobileSheet({
  open,
  title,
  onClose,
  children,
  className = '',
}: MobileSheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      FOCUSABLE_SELECTOR
    )
    focusable?.focus({ preventScroll: true })

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      const first = focusableElements[0]
      const last = focusableElements.at(-1)
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeydown)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="hf-sheet-root">
      <button
        type="button"
        className="hf-sheet-scrim"
        aria-label={`Cerrar ${title}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`hf-sheet-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="hf-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>
        <div className="hf-sheet-body">{children}</div>
      </div>
    </div>
  )
}
