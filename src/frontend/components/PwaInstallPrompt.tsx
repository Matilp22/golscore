'use client'

import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const PWA_INSTALL_DISMISSED_KEY = 'hf:pwa-install-dismissed:v1'

function isIosDevice() {
  if (typeof navigator === 'undefined') return false

  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function getStoredDismissed() {
  if (typeof window === 'undefined') return false

  return window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === '1'
}

function storeDismissed() {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, '1')
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
  const [dismissed, setDismissed] = useState(() => getStoredDismissed())
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneDisplay())
  const isIos = useMemo(() => isIosDevice(), [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.update())
      .catch((error: unknown) => {
        console.warn('[pwa] No se pudo registrar el service worker.', error)
      })
  }, [])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    function handleAppInstalled() {
      setIsStandalone(true)
      setDismissed(true)
      storeDismissed()
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
    storeDismissed()
  }

  function dismissPrompt() {
    setDismissed(true)
    storeDismissed()
  }

  return (
    <div className="hf-card fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl p-3 text-white backdrop-blur">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Instalar HAY FULBO</p>
          <p className="mt-1 text-xs leading-5 text-[#8d98a7]">
            {installPrompt
              ? 'Agrega HAY FULBO a tu pantalla de inicio.'
              : 'iPhone: Compartir -> Agregar a pantalla de inicio.'}
          </p>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-sm font-bold text-[#c7d0da] transition hover:bg-white/[0.08]"
          aria-label="Cerrar aviso de instalacion"
        >
          x
        </button>
      </div>

      {installPrompt ? (
        <button
          type="button"
          onClick={installApp}
          className="hf-button mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-black"
        >
          Instalar HAY FULBO
        </button>
      ) : null}
    </div>
  )
}
