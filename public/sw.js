const STATIC_CACHE = 'hayfulbo-static-assets-v6'
const PAGE_CACHE = 'hayfulbo-pages-assets-v6'
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icons/hay-fulbo-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/hay-fulbo-mark.svg',
  '/brand/logo/hay-fulbo-logo.png',
]

function isDynamicRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/partido/') ||
    url.pathname.startsWith('/liga/') ||
    url.pathname.startsWith('/equipo/') ||
    url.pathname.startsWith('/jugador/') ||
    url.pathname.startsWith('/seccion/') ||
    url.pathname.includes('/matches') ||
    url.pathname.includes('/fixtures') ||
    url.pathname.includes('/results') ||
    url.pathname.includes('/prode')
  )
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.json'
  )
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE)

  try {
    const response = await fetch(request)

    if (response.ok) {
      await cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cachedResponse = await cache.match(request)
    if (cachedResponse) return cachedResponse
    throw error
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone())
    }

    return response
  })

  return cachedResponse || fetchPromise
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => ![STATIC_CACHE, PAGE_CACHE].includes(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (isDynamicRequest(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})

self.addEventListener('push', (event) => {
  const fallbackPayload = {
    title: 'HAY FULBO',
    body: 'Tenes una novedad de tus partidos.',
    url: '/',
  }
  let payload = fallbackPayload

  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = {
        ...fallbackPayload,
        body: event.data.text() || fallbackPayload.body,
      }
    }
  }
  const title = payload.title || fallbackPayload.title
  const options = {
    body: payload.body || fallbackPayload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url: payload.url || fallbackPayload.url,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus()
          }
        }

        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
        return undefined
      })
  )
})
