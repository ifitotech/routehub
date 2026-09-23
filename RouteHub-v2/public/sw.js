// Bump this whenever the worker's caching contract changes. Old caches are
// removed during activate so an installed PWA cannot keep stale shell assets.
const STATIC_CACHE = 'routehub-static-v29'
const STATIC_CACHE_PREFIX = 'routehub-static-v'
const STATIC_ASSETS = ['/manifest.json?v=22', '/manifest-driver.json?v=22', '/manifest-driver-v3.json', '/manifest-manager.json?v=1', '/routehub-driver-pwa-192.png', '/routehub-driver-pwa-512.png', '/routehub-manager-pwa-192.png', '/routehub-manager-pwa-512.png']
const MAX_RUNTIME_ASSETS = 180

function isCacheableAsset(request, url) {
  // Never cache server-rendered/private/API responses. In particular, an
  // image destination does not guarantee that the URL is a public asset.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/storage/') || url.pathname.startsWith('/_next/image')) return false
  return url.pathname.startsWith('/_next/static/') || request.destination === 'font' || (
    request.destination === 'image' && /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(url.pathname)
  )
}

async function cacheAsset(request, response) {
  if (!response.ok || response.type !== 'basic') return
  const cacheControl = response.headers.get('Cache-Control') || ''
  if (/\b(?:private|no-store)\b/i.test(cacheControl)) return
  const cache = await caches.open(STATIC_CACHE)
  await cache.put(request, response.clone())
  const keys = await cache.keys()
  if (keys.length > MAX_RUNTIME_ASSETS) {
    await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ASSETS).map(key => cache.delete(key)))
  }
}

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => Promise.all(STATIC_ASSETS.map(asset => cache.add(asset).catch(() => null)))))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(STATIC_CACHE_PREFIX) && key !== STATIC_CACHE).map(key => caches.delete(key))))
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
    icon: '/routehub-driver-new.jpg?v=21',
    badge: '/routehub-driver-new.jpg?v=21',
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
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f1d35"><title>RouteHub · Offline</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(155deg,#102c53,#07152a);color:#f7faff;font:16px/1.5 system-ui,-apple-system,sans-serif}.card{width:min(100%,420px);padding:28px;border:1px solid #38577c;border-radius:24px;background:rgba(13,37,70,.82);box-shadow:0 20px 60px #0005}h1{margin:0 0 8px;font-size:26px}p{color:#c1d0e4}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}a,button{min-height:46px;padding:11px 16px;border:1px solid #5b83b2;border-radius:14px;background:#1667f2;color:white;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}a{background:transparent}@media(prefers-color-scheme:light){body{background:linear-gradient(155deg,#f4f8ff,#e5efff);color:#0f1d35}.card{background:#ffffffed;border-color:#cbd8e8;box-shadow:0 20px 60px #1e3a5f1f}p{color:#536783}a{color:#1557c0;border-color:#b6c8e0}}</style><main class="card"><h1>You’re offline · Sin conexión</h1><p>Reconnect to verify your session and load the latest routes.<br>Conéctate para verificar tu sesión y cargar las rutas actualizadas.</p><div class="actions"><button onclick="location.reload()">Try again · Reintentar</button><a href="/login">Sign in · Iniciar sesión</a></div></main></html>',
      {headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}},
    )))
    return
  }

  if (!isCacheableAsset(request, url)) return

  // Next's production assets are content-hashed and immutable: cache-first
  // avoids redownloading the same JS/CSS on every PWA launch. Public images
  // and fonts use network-first so a replaced branding asset is refreshed.
  const immutableBuildAsset = url.pathname.startsWith('/_next/static/')
  if (immutableBuildAsset) {
    const responsePromise = caches.open(STATIC_CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request))
    event.waitUntil(responsePromise.then(response => response ? cacheAsset(request, response) : undefined).catch(() => undefined))
    event.respondWith(responsePromise.catch(() => Response.error()))
    return
  }

  const responsePromise = fetch(request)
  event.waitUntil(responsePromise.then(response => cacheAsset(request, response)).catch(() => undefined))
  event.respondWith(responsePromise.catch(() => caches.match(request).then(cached => cached || Response.error())))
})
