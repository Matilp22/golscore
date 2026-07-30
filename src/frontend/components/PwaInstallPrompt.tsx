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
    document.documentElement.dataset.pwaInstallListener = 'ready'

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      delete document.documentElement.dataset.pwaInstallListener
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
    <section
      className="hf-pwa-install-prompt"
      role="dialog"
      aria-labelledby="hf-pwa-install-title"
    >
      <div>
        <div>
          <p id="hf-pwa-install-title">Instalar Hay Fulbo</p>
          <p>
            {installPrompt
              ? 'Agregá Hay Fulbo a tu pantalla de inicio para volver más rápido.'
              : 'En iPhone: Compartir y después Agregar a pantalla de inicio.'}
          </p>
        </div>

        <button
          type="button"
          onClick={dismissPrompt}
          className="hf-pwa-install-close"
          aria-label="Cerrar aviso de instalación"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {installPrompt ? (
        <button
          type="button"
          onClick={installApp}
          className="hf-pwa-install-action"
        >
          Instalar Hay Fulbo
        </button>
      ) : null}
    </section>
  )
}
