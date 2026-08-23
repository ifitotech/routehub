/* RouteHub Web Push service worker. */
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() || '' } }
  const title = data.title || 'RouteHub'
  const options = { body: data.body || 'You have a new route update.', icon: '/routehub-driver-new.jpg', badge: '/routehub-driver-new.jpg', tag: data.tag || 'routehub-update', data: { href: data.href || '/driver' }, renotify: true }
  event.waitUntil(self.registration.showNotification(title, options))
})
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.href || '/driver')) })
