import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('onboarding is versioned per user and role', () => {
  const helper = read('../lib/onboarding.ts')
  assert.match(helper, /ONBOARDING_VERSION = 'v3'/)
  assert.match(helper, /routehub_onboarding_\$\{ONBOARDING_VERSION\}:\$\{audience\}:\$\{userId\}/)
})

test('driver and manager get different three-step tours', () => {
  const gate = read('../app/onboarding-gate.tsx')
  assert.match(gate, /access\.role === 'driver'/)
  assert.match(gate, /'branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'/)
  // Tour copy follows the current Driver/Manager interfaces: the Driver
  // confirms pickup material, while the Manager follows routes by status.
  assert.match(gate, /Confirm materials at pickup/)
  assert.match(gate, /Follow routes by status/)
  assert.match(gate, /onboarding-driver-navigation\.jpg/)
  assert.match(gate, /onboarding-driver-route\.jpg/)
  assert.match(gate, /onboarding-driver-settings\.jpg/)
  assert.match(gate, /slides\.length - 1/)
})

test('tour can be skipped, completed and replayed from settings', () => {
  const gate = read('../app/onboarding-gate.tsx')
  const settings = read('../app/settings/page.tsx')
  const driverSettings = read('../app/driver-v3/settings/page.tsx')
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

test('driver device setup asks permissions only from its explicit action', () => {
  const gate = read('../app/onboarding-gate.tsx')
  const setup = read('../lib/driver-device-setup.ts')
  assert.match(gate, /onClick=\{\(\)=>deviceSetupResult\?setDeviceSetupNeeded\(false\):void prepareDevice\(\)\}/)
  assert.match(setup, /Notification\.requestPermission/)
  assert.match(setup, /getCurrentLocation\(\{maximumAge: 0\}\)/)
})

test('tour dialog supports keyboard dismissal and keeps keyboard focus inside', () => {
  const gate = read('../app/onboarding-gate.tsx')
  assert.match(gate, /event\.key === 'Escape'/)
  assert.match(gate, /event\.key !== 'Tab'/)
  assert.match(gate, /ref=\{dialogRef\}/)
})

test('driver settings keep natural scroll height and internal headers remain unstyled by app chrome', () => {
  const shellStyles = read('../components/driver-v3/driver-v3.module.css')
  const appStyles = read('../app/driver-v3/v3-app.css')
  const preferences = read('../app/driver-v3/driver-preferences.module.css')

  assert.doesNotMatch(shellStyles, /content\s*>\s*div:first-child\s*\{\s*height:\s*100%/)
  assert.doesNotMatch(appStyles, /\.driver-v3-root\s+header[,\s{]/)
  assert.match(appStyles, /\.driver-v3-root\s*>\s*main\s*>\s*header/)
  assert.match(preferences, /\.section\{flex:0 0 auto;/)
})

test('driving day start/end lives inline in Settings, not a separate screen', () => {
  // app/driver-v3/driving-day/page.tsx (a dedicated screen with its own back
  // button) was removed - starting/ending a driving day is now an inline
  // toggle inside Settings itself, so there's no separate screen to
  // navigate back from anymore.
  const source = read('../app/driver-v3/settings/page.tsx')
  assert.match(source, /startDrivingDay\(/)
  assert.match(source, /endDrivingDay\(/)
  assert.doesNotMatch(source, /useRouter/)
})
