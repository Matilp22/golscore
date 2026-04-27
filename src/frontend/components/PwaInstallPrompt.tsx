'use client'

import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false

  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay())
  const isIos = useMemo(() => isIosDevice(), [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('[pwa] No se pudo registrar el service worker.', error)
    })
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setDismissed(false)
    }

    function handleAppInstalled() {
      setIsStandalone(true)
      setDismissed(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isStandalone || dismissed || (!installPrompt && !isIos)) return null

  async function installApp() {
    if (!installPrompt) return

    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
    setDismissed(true)
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-white/10 bg-[#111418]/95 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Instalar FulboApp</p>
          <p className="mt-1 text-xs leading-5 text-[#8d98a7]">
            {installPrompt
              ? 'Agregá FulboApp a tu pantalla de inicio.'
              : 'iPhone: Compartir -> Agregar a pantalla de inicio.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-sm font-bold text-[#c7d0da] transition hover:bg-white/[0.08]"
          aria-label="Cerrar aviso de instalación"
        >
          ×
        </button>
      </div>

      {installPrompt ? (
        <button
          type="button"
          onClick={installApp}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#25553d] bg-[#163828] px-3 py-2 text-sm font-semibold text-[#7ff0b2] transition hover:bg-[#1b4330]"
        >
          Instalar FulboApp
        </button>
      ) : null}
    </div>
  )
}
