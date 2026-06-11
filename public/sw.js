const STATIC_CACHE = 'hayfulbo-static-assets-v3'
const PAGE_CACHE = 'hayfulbo-pages-assets-v3'
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icons/hay-fulbo-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/hay-fulbo-mark.svg',
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

function isStaticAsset(request, url) {
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/') ||
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

  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
