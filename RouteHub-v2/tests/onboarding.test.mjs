import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('onboarding is versioned per user and role', () => {
  const helper = read('../lib/onboarding.ts')
  assert.match(helper, /ONBOARDING_VERSION = 'v1'/)
  assert.match(helper, /routehub_onboarding_\$\{ONBOARDING_VERSION\}:\$\{audience\}:\$\{userId\}/)
})

test('driver and manager get different three-step tours', () => {
  const gate = read('../app/onboarding-gate.tsx')
  assert.match(gate, /access\.role === 'driver'/)
  assert.match(gate, /'branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'/)
  assert.match(gate, /Confirm the PO at pickup/)
  assert.match(gate, /Live route map and progress/)
  assert.match(gate, /slides\.length - 1/)
})

test('tour can be skipped, completed and replayed from settings', () => {
  const gate = read('../app/onboarding-gate.tsx')
  const settings = read('../app/settings/page.tsx')
  const driverSettings = read('../app/driver/settings/page.tsx')
  assert.match(gate, /localStorage\.setItem\(onboardingStorageKey/)
  assert.match(gate, /onClick=\{complete\}>\{copy\.skip\}/)
  assert.match(settings, /requestOnboardingReplay/)
  assert.match(driverSettings, /requestOnboardingReplay/)
})

test('onboarding does not request notification or location permission on launch', () => {
  const gate = read('../app/onboarding-gate.tsx')
  assert.doesNotMatch(gate, /Notification\.requestPermission/)
  assert.doesNotMatch(gate, /geolocation\.getCurrentPosition/)
})

test('tour dialog supports keyboard dismissal and keeps keyboard focus inside', () => {
  const gate = read('../app/onboarding-gate.tsx')
  assert.match(gate, /event\.key === 'Escape'/)
  assert.match(gate, /event\.key !== 'Tab'/)
  assert.match(gate, /ref=\{dialogRef\}/)
})
