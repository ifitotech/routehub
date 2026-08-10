const STATIC_CACHE = 'routehub-static-v7'
const STATIC_ASSETS = ['/manifest.json', '/manifest-driver.json', '/routehub-regular-app.jpg', '/routehub-driver-app.jpg']

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => Promise.all(STATIC_ASSETS.map(asset => cache.add(asset).catch(() => null)))))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== STATIC_CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()))
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, {cache: 'no-store'}).catch(() => new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>RouteHub offline</title><main style="font-family:system-ui;padding:32px;max-width:520px;margin:auto"><h1>RouteHub is offline</h1><p>Reconnect to verify your session and load current routes.</p></main>',
      {headers: {'Content-Type': 'text/html; charset=utf-8'}},
    )))
    return
  }

  const staticRequest = url.pathname.startsWith('/_next/static/') || ['style', 'script', 'font', 'image'].includes(request.destination)
  if (!staticRequest) return
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()))
      return response
    })
    return cached || network
  }))
})
