import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const today = read('../app/driver-v3/page.tsx')
const actions = read('../lib/driver/driver-actions.ts')

test('Arrived persists separately before opening a completion flow', () => {
  assert.match(today, /const arriveCurrent=async\(\)=>[\s\S]*await markArrived\(ctx\(\)\)[\s\S]*await refresh\(\)[\s\S]*setSheet\(kind\)/)
  assert.match(today, /if\(!arrived\) return \{label:t\.drvArrived, run:arriveCurrent\}/)
  assert.doesNotMatch(today, /if\(kind==='delivery'&&started\)openDelivery\(\)/)
})

test('Arrival retries reconcile with the authoritative stored timestamp', () => {
  assert.match(actions, /if\(!result\.data\)[\s\S]*select\('id,arrived_at'\)[\s\S]*if\(current\.data\?\.arrived_at\)return current\.data/)
  assert.doesNotMatch(actions, /throw new Error\('Arrival was already recorded\.'\)/)
})

test('Offline Driver mutations stay active instead of claiming success', () => {
  assert.match(today, /const canMutate=\(\)=>/)
  assert.match(today, /navigator\.onLine===false/)
  for (const operation of ['startCurrent', 'arriveCurrent', 'confirmPickup', 'completeReturnNow', 'arriveFromNavigation', 'confirmDelivery', 'savePickupNote']) {
    const start = today.indexOf(`const ${operation}`)
    assert.ok(start >= 0, `${operation} must exist`)
    assert.match(today.slice(start, start + 260), /!canMutate\(\)/, `${operation} must stop before writing while offline`)
  }
})
