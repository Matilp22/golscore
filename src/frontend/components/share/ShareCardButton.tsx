'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useShareCardAsImage } from '@/frontend/hooks/useShareCardAsImage'

type ShareCardButtonProps = {
  targetId: string
  fileName: string
  title: string
  text: string
  url: string
  ariaLabel?: string
  buttonTitle?: string
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function ShareCardButton({
  targetId,
  fileName,
  title,
  text,
  url,
  ariaLabel = 'Compartir',
  buttonTitle = 'Compartir',
}: ShareCardButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localMessage, setLocalMessage] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const absoluteUrl = typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url
  const shareOptions = useMemo(
    () => ({
      fileName,
      title,
      text,
      url: absoluteUrl,
    }),
    [absoluteUrl, fileName, text, title]
  )
  const {
    isGenerating,
    message,
    error,
    downloadImage,
    openImage,
    shareImage,
  } = useShareCardAsImage(targetId, shareOptions)
  const encodedText = encodeURIComponent(`${text}\n${absoluteUrl}`)

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const triggerElement = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ]

      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      ;(previouslyFocused ?? triggerElement)?.focus()
    }
  }, [isOpen])

  return (
    <div data-share-exclude="true" data-share-ignore="true">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setLocalMessage('')
          setIsOpen((current) => !current)
        }}
        className="hf-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#dce7f2] transition hover:text-white"
        aria-label={ariaLabel}
        title={buttonTitle}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4" />
          <path d="m15.4 6.5-6.8 4" />
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="hf-share-modal fixed inset-0 z-[1100] isolate flex items-end justify-center px-3 py-4 sm:items-center"
              data-share-exclude="true"
              data-share-ignore="true"
            >
              <button
                type="button"
                className="hf-share-backdrop absolute inset-0 z-0 cursor-default"
                aria-label="Cerrar compartir"
                tabIndex={-1}
                onClick={() => setIsOpen(false)}
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Opciones para compartir"
                tabIndex={-1}
                className="hf-share-dialog relative z-10 w-full max-w-sm p-4 text-sm"
              >
                <div className="hf-share-dialog-header mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="hf-type-overline">
                      Compartir imagen
                    </p>
                    <p className="mt-1 text-xs">
                      Genera una imagen de esta card.
                    </p>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="hf-share-close inline-flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-black transition"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    x
                  </button>
                </div>

                <div className="hf-share-actions grid gap-2">
                  <button
                    type="button"
                    onClick={shareImage}
                    disabled={isGenerating}
                    className="hf-button h-10 rounded-xl px-3 text-left text-sm font-black disabled:cursor-wait disabled:opacity-60"
                  >
                    {isGenerating ? 'Generando...' : 'Compartir imagen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openExternal(`https://wa.me/?text=${encodedText}`)}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => openExternal(`https://twitter.com/intent/tweet?text=${encodedText}`)}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold"
                  >
                    Twitter/X
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalMessage('Instagram web no permite adjuntar la imagen directo. Descarga la imagen para subirla a Instagram.')}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold"
                  >
                    Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => openExternal(`mailto:?subject=${encodeURIComponent(title)}&body=${encodedText}`)}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold"
                  >
                    Mail
                  </button>
                  <button
                    type="button"
                    onClick={downloadImage}
                    disabled={isGenerating}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
                  >
                    Descargar PNG
                  </button>
                  <button
                    type="button"
                    onClick={openImage}
                    disabled={isGenerating}
                    className="hf-button-secondary h-10 rounded-xl px-3 text-left text-sm font-semibold disabled:cursor-wait disabled:opacity-60"
                  >
                    Abrir PNG
                  </button>
                </div>
                {localMessage || message || error ? (
                  <p className={`hf-share-feedback mt-3 text-xs ${error ? 'is-error' : ''}`}>
                    {error || message || localMessage}
                  </p>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
