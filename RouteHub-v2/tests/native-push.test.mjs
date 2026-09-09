import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('native Android route push does not depend on browser VAPID configuration', async () => {
  const source = await readFile(new URL('../supabase/functions/send-route-push/index.ts', import.meta.url), 'utf8')
  assert.match(source, /if \(!tokens\.length\) return 0/)
  assert.match(source, /Firebase Cloud Messaging secrets are not configured/)
  assert.match(source, /const webPushConfigured = Boolean\(publicKey && privateKey && subject\)/)
  assert.match(source, /const nativeDelivered = await sendNativePush/)
  assert.doesNotMatch(source, /if \(!publicKey \|\| !privateKey \|\| !subject\) return json\(\{error: 'VAPID push secrets are not configured'\}, 503\)/)
})

test('native registration reports Firebase registration errors immediately', async () => {
  const source = await readFile(new URL('../lib/push-notifications.ts', import.meta.url), 'utf8')
  assert.match(source, /'registrationError'/)
  assert.match(source, /Firebase could not register this device for notifications/)
})
