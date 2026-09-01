import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canDriverStartRoute, operationalDate, selectDriverTodayQueue} from '../lib/driver-queue.ts'

const route = (id, status, position, routeDate = '2026-08-13', driverId = 'driver-a') => ({
  id,
  status,
  position,
  route_date: routeDate,
  driver_id: driverId,
})

test('uses the local operational date instead of UTC date conversion', () => {
  const lateEvening = new Date(2026, 7, 13, 23, 45)
  assert.equal(operationalDate(lateEvening), '2026-08-13')
})

test('today queue never promotes tomorrow route to current mission', () => {
  const queue = selectDriverTodayQueue([
    route('today-a', 'published', 1),
    route('today-b', 'pending', 2),
    route('tomorrow-first', 'published', 1, '2026-08-14'),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'today-a')
  assert.deepEqual(queue.upcoming.map(item => item.id), ['today-b'])
})

test('an unfinished past-due route remains visible without blocking current work', () => {
  const queue = selectDriverTodayQueue([
    route('today-first', 'published', 1, '2026-08-13'),
    route('past-due', 'pending', 4, '2026-08-12'),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'past-due')
  assert.deepEqual(queue.upcoming.map(item => item.id), ['today-first'])
})

test('a future active record cannot override today work', () => {
  const queue = selectDriverTodayQueue([
    route('today', 'published', 1),
    route('future-active', 'active', 1, '2026-08-14'),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'today')
})

test('active route wins over lower-position upcoming work', () => {
  const queue = selectDriverTodayQueue([
    route('done', 'completed', 1),
    route('active', 'active', 2),
    route('up-next', 'published', 3),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'active')
  assert.deepEqual(queue.upcoming.map(item => item.id), ['up-next'])
  assert.deepEqual(queue.completed.map(item => item.id), ['done'])
})

test('a paused route remains current today and does not jump to the next route', () => {
  const queue = selectDriverTodayQueue([
    route('paused', 'paused', 2),
    route('next', 'published', 3),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'paused')
  assert.deepEqual(queue.upcoming.map(item => item.id), ['next'])
})

test('manager reorder is reflected by selecting the latest authoritative next route', () => {
  const beforeCompletion = selectDriverTodayQueue([
    route('current', 'active', 2),
    route('c', 'published', 4),
    route('d', 'published', 5),
    route('e', 'published', 3),
  ], 'driver-a', '2026-08-13')
  assert.equal(beforeCompletion.current?.id, 'current')
  const afterCompletion = selectDriverTodayQueue([
    route('current', 'completed', 2),
    route('c', 'published', 4),
    route('d', 'published', 5),
    route('e', 'published', 3),
  ], 'driver-a', '2026-08-13')
  assert.equal(afterCompletion.current?.id, 'e')
})

test('driver queue excludes routes assigned to another driver', () => {
  const queue = selectDriverTodayQueue([
    route('a1', 'published', 1),
    route('b1', 'published', 1, '2026-08-13', 'driver-b'),
  ], 'driver-a', '2026-08-13')
  assert.equal(queue.current?.id, 'a1')
  assert.equal(queue.upcoming.length, 0)
})

test('driver cannot start a future, completed, or cancelled route', () => {
  assert.equal(canDriverStartRoute(route('future', 'published', 1, '2026-08-14'), '2026-08-13'), false)
  assert.equal(canDriverStartRoute(route('done', 'completed', 1), '2026-08-13'), false)
  assert.equal(canDriverStartRoute(route('cancelled', 'cancelled', 1), '2026-08-13'), false)
  assert.equal(canDriverStartRoute(route('today', 'published', 1), '2026-08-13'), true)
})

test('database migration protects the one-active-route driver invariant', () => {
  const sql = readFileSync(new URL('../supabase/migrations/024_one_active_route_per_driver.sql', import.meta.url), 'utf8')
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /A driver can have only one active route at a time/)
  assert.match(sql, /before insert or update of status, driver_id, company_id/i)
})

test('expired assigned routes are escalated to a manager issue every day', () => {
  const sql = readFileSync(new URL('../supabase/migrations/037_escalate_expired_driver_routes.sql', import.meta.url), 'utf8')
  assert.match(sql, /route_date < v_cutoff_date/)
  assert.match(sql, /status = 'issue'/)
  assert.match(sql, /status in \('draft', 'pending', 'published', 'active', 'paused'\)/)
  assert.match(sql, /routehub-escalate-expired-driver-routes/)
  assert.match(sql, /cron\.schedule/)
})
