import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('installed RouteHub opens the login session gate instead of forcing the public welcome screen', () => {
  const manifest = JSON.parse(read('../public/manifest.json'))
  const login = read('../app/login/page.tsx')

  assert.equal(manifest.start_url, '/login?source=pwa')
  assert.match(login, /get\('source'\) === 'pwa'/)
  assert.match(login, /client\.auth\.getSession\(\)/)
  assert.match(login, /Opening your workspace…/)
  assert.match(login, /workspaceForStrictRole\(access\.role\)/)
})

test('the install identity is RouteHub Driver before authentication', () => {
  const manifest = JSON.parse(read('../public/manifest.json'))
  const rootLayout = read('../app/layout.tsx')

  assert.equal(manifest.id, '/driver')
  assert.equal(manifest.name, 'RouteHub Driver')
  assert.equal(manifest.icons[0].src, '/routehub-driver-new.jpg?v=21')
  assert.equal(manifest.icons[0].type, 'image/jpeg')
  assert.match(rootLayout, /applicationName: 'RouteHub Driver'/)
  assert.match(rootLayout, /routehub-driver-new\.jpg\?v=21/)
})
