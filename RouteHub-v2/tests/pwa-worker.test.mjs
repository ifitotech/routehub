import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const register = readFileSync(new URL('../app/pwa-register.tsx', import.meta.url), 'utf8')

test('PWA worker updates its cache version without deleting unrelated origin caches', () => {
  assert.match(worker, /routehub-static-v29/)
  assert.match(worker, /key\.startsWith\(STATIC_CACHE_PREFIX\).*key !== STATIC_CACHE/)
  assert.match(register, /\/sw\.js\?v=29/)
})

test('PWA worker never caches private API, auth, storage, or optimized image responses', () => {
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/auth\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/storage\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/_next\/image'\)/)
  assert.match(worker, /private\|no-store/)
})

test('PWA worker keeps personalized documents network-only with a branded offline fallback', () => {
  assert.match(worker, /request\.mode === 'navigate'/)
  assert.match(worker, /fetch\(request, \{cache: 'no-store'\}\)/)
  assert.match(worker, /You’re offline · Sin conexión/)
  assert.match(worker, /location\.reload\(\)/)
})
