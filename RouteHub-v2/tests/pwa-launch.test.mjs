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
