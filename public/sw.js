const CACHE='routehub-v1';
const SHELL=['/','/driver','/routes','/requests','/reports','/manifest.json','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match('/'))));
});
self.addEventListener('message',event=>{if(event.data?.type==='CACHE_ROUTES'){event.waitUntil(caches.open(CACHE).then(c=>c.put(new Request('/offline/routes.json'),new Response(JSON.stringify(event.data.payload),{headers:{'Content-Type':'application/json'}}))))}});
