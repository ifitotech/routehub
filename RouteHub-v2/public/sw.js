const STATIC_CACHE = 'routehub-static-v18'
const STATIC_ASSETS = ['/manifest.json', '/manifest-driver.json', '/manifest-driver-v3.json', '/routehub-regular-new.jpg', '/routehub-driver-new.jpg?v=19']

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

// Push must live in the same worker that controls the installed PWA.  A
// second worker at the root scope prevents iOS/Android from keeping a stable
// push subscription once the app is closed.
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {body: event.data?.text() || ''}
  }
  const title = data.title || 'RouteHub'
  const options = {
    body: data.body || 'You have a new route update.',
    icon: '/routehub-driver-new.jpg?v=19',
    badge: '/routehub-driver-new.jpg?v=19',
    tag: data.tag || 'routehub-update',
    renotify: true,
    data: {href: data.href || '/driver'},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const href = event.notification.data?.href || '/driver'
  event.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (existing) return existing.focus().then(() => existing.navigate(href))
    return clients.openWindow(href)
  }))
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
