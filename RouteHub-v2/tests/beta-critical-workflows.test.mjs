import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildMissionInsert} from '../lib/mission-payload.ts'
import {selectDriverTodayQueue} from '../lib/driver-queue.ts'
import {reorder} from '../lib/planner.ts'
import {chooseDefaultAssignee, isTemporaryRouteAssignee} from '../lib/route-assignment.ts'
import {groupRouteQueues} from '../lib/route-queue.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const createRouteSource = read('../app/routes/page.tsx')
const dataSource = read('../lib/data.ts')
const driverSource = read('../app/driver-v3/page.tsx')
const driverDataSource = read('../lib/driver-v3/use-driver-data.ts')
const drivingDaySource = read('../app/driver-v3/driving-day/page.tsx')
const liveRouteSource = read('../app/routes/live-route.tsx')
const realtimeSource = read('../lib/realtime-sync.ts')
const middlewareSource = read('../middleware.ts')
const atomicSql = read('../supabase/migrations/023_atomic_route_queue_reordering.sql')
const sessionsSql = read('../supabase/migrations/015_driving_sessions.sql')
const temporarySql = read('../supabase/migrations/025_primary_driver_and_temporary_route_execution.sql')

const mission = (id, position, overrides = {}) => ({
  id,
  type:'delivery',
  status:'published',
  origin:position === 1 ? 'Branch' : `Stop ${position - 1}`,
  destination:`Stop ${position}`,
  priority:'normal',
  position,
  company_id:'company-a',
  branch_id:'branch-a',
  route_date:'2026-08-13',
  driver_id:'carlos',
  ...overrides,
})

const driverRoute = (id, status, position, overrides = {}) => ({
  id,
  status,
  position,
  route_date:'2026-08-13',
  driver_id:'carlos',
  ...overrides,
})

test('critical create flow uses the branch Primary Driver and correct route scope', () => {
  const assignees = [
    {user_id:'mike', role:'sales_representative'},
    {user_id:'carlos', role:'driver'},
  ]
  const primary = chooseDefaultAssignee(assignees, 'carlos')
  const payload = buildMissionInsert({
    type:'delivery',
    driver_id:primary.user_id,
    origin_address:'Miami Branch',
    destination_address:'ABC Supply',
    priority:'normal',
    status:'published',
    scheduled_at:'2026-08-13T14:00:00.000Z',
  }, {company_id:'company-a', branch_id:'branch-a'}, 1)

  assert.equal(payload.company_id, 'company-a')
  assert.equal(payload.branch_id, 'branch-a')
  assert.equal(payload.route_date, '2026-08-13')
  assert.equal(payload.driver_id, 'carlos')
  assert.equal(payload.position, 1)
  assert.equal(payload.status, 'published')
})

test('new routes append without duplicate positions or gaps in their exact queue', () => {
  const created = ['A','B','C'].map((destination, index) => buildMissionInsert({
    type:'delivery',
    driver_id:'carlos',
    origin_address:index ? String.fromCharCode(64 + index) : 'Miami Branch',
    destination_address:destination,
    priority:'normal',
    status:'published',
    scheduled_at:'2026-08-13T14:00:00.000Z',
  }, {company_id:'company-a', branch_id:'branch-a'}, index + 1))
  assert.deepEqual(created.map(route => route.position), [1,2,3])
  assert.equal(new Set(created.map(route => route.position)).size, 3)

  // Regression: both production creation paths must calculate MAX(position)
  // inside company + branch + route_date + assignee, including null branch.
  for (const source of [createRouteSource, dataSource]) {
    assert.match(source, /\.eq\('company_id'/)
    assert.match(source, /\.eq\('driver_id'/)
    assert.match(source, /\.eq\('route_date'/)
    assert.match(source, /\.eq\('branch_id'/)
    assert.match(source, /\.is\('branch_id',\s*null\)/)
  }
})

test('reorder produces the requested database order while preserving other queues', () => {
  const routes = [
    ...['A','B','C','D','E'].map((id, index) => mission(id, index + 1)),
    mission('X', 1, {driver_id:'mike', destination:'Mike stop'}),
    mission('Tomorrow C', 1, {route_date:'2026-08-14'}),
  ]
  const queues = groupRouteQueues(routes)
  const carlosToday = queues.find(queue => queue.routes[0].driver_id === 'carlos' && queue.routes[0].route_date === '2026-08-13')
  const mike = queues.find(queue => queue.routes[0].driver_id === 'mike')
  const tomorrow = queues.find(queue => queue.routes[0].route_date === '2026-08-14')

  const reordered = reorder(carlosToday.routes, 4, 1)
  assert.deepEqual(reordered.map(route => route.id), ['A','E','B','C','D'])
  assert.deepEqual(reordered.map(route => route.position), [1,2,3,4,5])
  assert.deepEqual(mike.routes.map(route => [route.id, route.position, route.origin]), [['X',1,'Branch']])
  assert.deepEqual(tomorrow.routes.map(route => [route.id, route.position]), [['Tomorrow C',1]])
})

test('active work survives manager reorder and latest authoritative order selects Next', () => {
  const before = selectDriverTodayQueue([
    driverRoute('A','completed',1),
    driverRoute('B','active',2),
    driverRoute('C','published',4),
    driverRoute('D','published',5),
    driverRoute('E','published',3),
  ], 'carlos', '2026-08-13')
  assert.equal(before.current.id, 'B')
  assert.deepEqual(before.upcoming.map(route => route.id), ['E','C','D'])

  const after = selectDriverTodayQueue([
    driverRoute('A','completed',1),
    driverRoute('B','completed',2),
    driverRoute('C','published',4),
    driverRoute('D','published',5),
    driverRoute('E','published',3),
  ], 'carlos', '2026-08-13')
  assert.equal(after.current.id, 'E')
})

test('temporary assignment grants only assigned execution and never changes the permanent role', () => {
  const mike = {user_id:'mike', role:'sales_representative'}
  assert.equal(isTemporaryRouteAssignee(mike.role), true)
  assert.equal(mike.role, 'sales_representative')
  assert.match(temporarySql, /driver_id = auth\.uid\(\)/)
  assert.match(temporarySql, /member\.company_id = routes\.company_id/)
  assert.match(temporarySql, /member\.branch_id is null or routes\.branch_id is null or member\.branch_id = routes\.branch_id/)
  assert.match(temporarySql, /to_jsonb\(new\) - allowed_columns/)
  assert.doesNotMatch(temporarySql, /update\s+public\.company_users[\s\S]*set\s+role/i)
})

test('temporary completion ends only its mission session and a Driver workday remains explicit', () => {
  const triggerStart = temporarySql.indexOf('create or replace function public.end_temporary_route_session')
  const triggerEnd = temporarySql.indexOf('revoke all on function public.validate_branch_primary_driver')
  const completionTrigger = temporarySql.slice(triggerStart, triggerEnd)
  assert.match(completionTrigger, /session_kind = 'temporary_route'/)
  assert.match(completionTrigger, /new\.status in \('completed','issue','cancelled'\)/)
  assert.doesNotMatch(completionTrigger, /session_kind = 'driving_day'/)
  assert.match(drivingDaySource, /startDrivingDay\(/)
  assert.match(drivingDaySource, /endDrivingDay\(/)
})

test('Live Route uses operational sessions even when no route is active', () => {
  assert.match(liveRouteSource, /sessionResult\.data/)
  assert.match(liveRouteSource, /selected\.route_id/)
  assert.match(liveRouteSource, /selectedNext/)
  assert.match(liveRouteSource, /selectedRoute\?[\s\S]*:t\.noActiveRoutes/)
  assert.doesNotMatch(liveRouteSource, /activeDriverIds/)
})

test('security contracts isolate company, branch, assignee, and driving-session reads', () => {
  assert.match(atomicSql, /cu\.company_id = v_anchor\.company_id/)
  assert.match(atomicSql, /cu\.branch_id is null or cu\.branch_id is not distinct from v_anchor\.branch_id/)
  assert.match(atomicSql, /r\.driver_id = v_anchor\.driver_id/)
  assert.match(sessionsSql, /viewer\.company_id = driving_sessions\.company_id/)
  assert.match(sessionsSql, /viewer\.branch_id is null or driving_sessions\.branch_id is null or viewer\.branch_id = driving_sessions\.branch_id/)
  assert.match(temporarySql, /old\.driver_id is distinct from actor/)
})

test('invalid or mixed atomic reorder input fails before any queue write', () => {
  assert.match(atomicSql, /Route queue was not found/)
  assert.match(atomicSql, /Route order contains duplicate route IDs/)
  assert.match(atomicSql, /route queue changed or contains routes from another queue/i)
  const validation = atomicSql.indexOf("raise exception 'The route queue changed")
  const firstPositionWrite = atomicSql.indexOf('set position = r.position + 1000000')
  assert.ok(validation > 0)
  assert.ok(firstPositionWrite > validation, 'queue membership must be validated before positions are written')
  assert.match(atomicSql, /pg_advisory_xact_lock/)
  assert.match(atomicSql, /for update/)
})

test('Driver refresh reconstructs current work from backend and realtime follows assignment changes', () => {
  const restored = selectDriverTodayQueue([
    driverRoute('B','active',2),
    driverRoute('C','published',3),
    driverRoute('tomorrow','published',1,{route_date:'2026-08-14'}),
    driverRoute('other-driver','active',1,{driver_id:'mike'}),
  ], 'carlos', '2026-08-13')
  assert.equal(restored.current.id, 'B')
  assert.deepEqual(restored.upcoming.map(route => route.id), ['C'])
  assert.match(driverDataSource, /table: 'routes', filter: `driver_id=eq\.\$\{driverId\}`/)
  assert.match(liveRouteSource, /table:'driving_sessions',filter:`company_id=eq\.\$\{companyId\}`/)
  assert.match(liveRouteSource, /table:'routes',filter:`company_id=eq\.\$\{companyId\}`/)
  assert.match(driverDataSource, /select\('id,status,completed_at,finalized_at,updated_version'\)/)
  assert.match(driverDataSource, /current \? \[\{\.\.\.route, \.\.\.current\} as DriverV3Route\] : \[\]/)
  assert.match(middlewareSource, /NextResponse\.rewrite\(url\)[\s\S]*Cache-Control', 'private, no-store/)
})

test('realtime refresh coalesces bursts and is disposed with the subscription', () => {
  assert.match(realtimeSource, /Coalesces bursts of Supabase Realtime events/)
  assert.match(realtimeSource, /if \(disposed \|\| timer\) return/)
  assert.match(realtimeSource, /void refresh\(\)/)
  assert.match(liveRouteSource, /createRealtimeRefresh\(/)
  assert.match(driverDataSource, /createRealtimeRefresh\(/)
})
