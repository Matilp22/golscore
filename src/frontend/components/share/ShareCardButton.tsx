'use client'

import { useEffect, useMemo, useState } from 'react'
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <div data-share-exclude="true" data-share-ignore="true">
      <button
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
              className="fixed inset-0 z-[1100] isolate flex items-end justify-center bg-[#020403]/95 px-3 py-4 backdrop-blur-md sm:items-center"
              data-share-exclude="true"
              data-share-ignore="true"
            >
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default"
                aria-label="Cerrar compartir"
                onClick={() => setIsOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Opciones para compartir"
                className="relative z-10 w-full max-w-sm rounded-2xl border border-[#335142] bg-[#07100d] p-4 text-sm text-white shadow-[0_28px_90px_rgba(0,0,0,0.86),0_0_0_1px_rgba(127,240,178,0.08)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7ff0b2]">
                      Compartir imagen
                    </p>
                    <p className="mt-1 text-xs text-[#9aa7b5]">
                      Genera una imagen de esta card.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition hover:bg-white/[0.08]"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    x
                  </button>
                </div>

                <div className="grid gap-2">
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
                  <p className={`mt-3 text-xs ${error ? 'text-red-200' : 'text-[#9aa7b5]'}`}>
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
