'use client'

import { useEffect, useState } from 'react'

const DEVICE_ID_KEY = 'hf:pwa-push-device-id:v1'
const DISMISSED_KEY = 'hf:pwa-push-dismissed:v1'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing

  const next =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(DEVICE_ID_KEY, next)
  return next
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

function canUsePush() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

export default function PwaNotificationOptIn() {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ready' | 'error'>('idle')
  const [message, setMessage] = useState('Activa avisos de partidos, recordatorios y favoritos.')

  useEffect(() => {
    if (!isStandaloneDisplay()) return
    if (window.localStorage.getItem(DISMISSED_KEY) === '1') return
    if (!canUsePush()) return
    if (Notification.permission === 'granted') return

    setVisible(true)
  }, [])

  if (!visible) return null

  async function enableNotifications() {
    if (!canUsePush() || !VAPID_PUBLIC_KEY) {
      setStatus('error')
      setMessage('Notificaciones no configuradas todavia.')
      return
    }

    setStatus('saving')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('error')
        setMessage('Permiso de notificaciones rechazado.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
        }))

      const response = await fetch('/api/pwa/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          subscription: subscription.toJSON(),
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setStatus('ready')
      setMessage('Notificaciones activadas.')
      window.localStorage.setItem(DISMISSED_KEY, '1')
      window.setTimeout(() => setVisible(false), 1400)
    } catch {
      setStatus('error')
      setMessage('No se pudieron activar las notificaciones.')
    }
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="hf-pwa-notification-optin" role="dialog" aria-label="Activar notificaciones">
      <button
        type="button"
        className="hf-pwa-notification-close"
        onClick={dismiss}
        aria-label="Cerrar aviso de notificaciones"
      >
        x
      </button>
      <strong>Notificaciones de HAY FULBO</strong>
      <p>{message}</p>
      <button
        type="button"
        onClick={enableNotifications}
        disabled={status === 'saving' || status === 'ready'}
      >
        {status === 'saving' ? 'Activando...' : status === 'ready' ? 'Listo' : 'Activar'}
      </button>
    </div>
  )
}
