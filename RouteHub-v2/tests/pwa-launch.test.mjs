import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('installed RouteHub opens the login session gate instead of forcing the public welcome screen', () => {
  const manifest = JSON.parse(read('../public/manifest.json'))
  const login = read('../app/login/page.tsx')

  assert.equal(manifest.start_url, '/login?source=pwa&app=driver')
  assert.match(login, /const launchedFromPwa = params\.get\('source'\) === 'pwa'/)
  assert.match(login, /client\.auth\.getSession\(\)/)
  assert.match(login, /styles\.pwaLoading/)
  assert.match(login, /driver-empty-route-hero\.png/)
  assert.match(login, /workspaceForStrictRole\(access\.role\)/)
})

test('the install identity is RouteHub Driver before authentication', () => {
  const manifest = JSON.parse(read('../public/manifest.json'))
  const rootLayout = read('../app/layout.tsx')

  assert.equal(manifest.id, '/driver')
  assert.equal(manifest.name, 'RouteHub Driver')
  assert.equal(manifest.icons[0].src, '/routehub-driver-pwa-192.png')
  assert.equal(manifest.icons[0].sizes, '192x192')
  assert.equal(manifest.icons[1].src, '/routehub-driver-pwa-512.png')
  assert.equal(manifest.icons[1].sizes, '512x512')
  assert.match(rootLayout, /applicationName: 'RouteHub Driver'/)
  assert.match(rootLayout, /routehub-driver-pwa-512\.png/)
})

test('Manager and Driver install as distinct role-aware PWAs', () => {
  const managerManifest = JSON.parse(read('../public/manifest-manager.json'))
  const managerLayout = read('../app/manager/layout.tsx')
  const login = read('../app/login/page.tsx')

  assert.equal(managerManifest.id, '/manager')
  assert.equal(managerManifest.name, 'RouteHub Manager')
  assert.equal(managerManifest.start_url, '/login?source=pwa&app=manager')
  assert.deepEqual(managerManifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
  assert.match(managerLayout, /manifest-manager\.json/)
  assert.match(managerLayout, /absolute: 'RouteHub Manager'/)
  assert.match(login, /if \(launchedFromPwa\) setDialog\('sign-in'\)/)
})
