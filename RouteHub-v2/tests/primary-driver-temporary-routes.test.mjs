import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  chooseDefaultAssignee,
  isTemporaryRouteAssignee,
  locationFreshness,
  routeExecutionRoles,
} from '../lib/route-assignment.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the branch Primary Driver is the default without excluding team coverage', () => {
  const assignees = [
    {user_id:'sales-1', role:'sales_representative'},
    {user_id:'driver-1', role:'driver'},
    {user_id:'driver-2', role:'driver'},
  ]
  assert.equal(chooseDefaultAssignee(assignees, 'driver-2')?.user_id, 'driver-2')
  assert.deepEqual(assignees.map(person => person.user_id), ['sales-1','driver-1','driver-2'])
})

test('default assignment falls back to a permanent Driver but never silently chooses temporary coverage', () => {
  assert.equal(chooseDefaultAssignee([{user_id:'sales',role:'sales_representative'},{user_id:'driver',role:'driver'}])?.user_id, 'driver')
  assert.equal(chooseDefaultAssignee([{user_id:'sales',role:'sales_representative'}]), undefined)
  assert.equal(chooseDefaultAssignee([{user_id:'sales',role:'sales_representative'},{user_id:'former-driver',role:'sales_representative'}], 'former-driver'), undefined)
})

test('temporary execution roles are explicit and do not include unrelated roles', () => {
  assert.equal(isTemporaryRouteAssignee('sales_representative'), true)
  assert.equal(isTemporaryRouteAssignee('operations_manager'), true)
  assert.equal(isTemporaryRouteAssignee('counter_sales'), true)
  assert.equal(isTemporaryRouteAssignee('driver'), false)
  assert.deepEqual(routeExecutionRoles.sort(), ['branch_manager','counter_sales','driver','operations_manager','sales_representative'].sort())
})

test('operational location freshness never overstates stale coordinates', () => {
  const now = new Date('2026-08-13T16:00:00Z').getTime()
  assert.equal(locationFreshness('2026-08-13T15:56:00Z', now), 'recent')
  assert.equal(locationFreshness('2026-08-13T15:50:00Z', now), 'approximate')
  assert.equal(locationFreshness('2026-08-13T15:40:00Z', now), 'last_known')
  assert.equal(locationFreshness(null, now), 'unavailable')
})

test('migration represents Primary Driver without duplicating company users', () => {
  const sql = read('../supabase/migrations/025_primary_driver_and_temporary_route_execution.sql')
  assert.match(sql, /add column if not exists primary_driver_id uuid references public\.users\(id\)/i)
  assert.match(sql, /member\.role = 'driver'/)
  assert.match(sql, /clear_invalid_branch_primary_driver/)
  assert.match(sql, /after delete on public\.company_users/)
  assert.doesNotMatch(sql, /insert\s+into\s+public\.company_users/i)
})

test('temporary execution RLS is assigned-user scoped and protects dispatch fields', () => {
  const sql = read('../supabase/migrations/025_primary_driver_and_temporary_route_execution.sql')
  assert.match(sql, /driver_id = auth\.uid\(\)/)
  assert.match(sql, /member\.company_id = routes\.company_id/)
  assert.match(sql, /member\.branch_id is null or routes\.branch_id is null or member\.branch_id = routes\.branch_id/)
  assert.match(sql, /to_jsonb\(new\) - allowed_columns/)
  assert.match(sql, /allowed_columns text\[\] := array\[\s*'status','updated_version'/)
})

test('temporary location is mission-scoped and stores no GPS history', () => {
  const sql = read('../supabase/migrations/025_primary_driver_and_temporary_route_execution.sql')
  assert.match(sql, /session_kind in \('driving_day','temporary_route'\)/)
  assert.match(sql, /route\.driver_id = new\.driver_id/)
  assert.match(sql, /end_temporary_route_session/)
  assert.match(sql, /new\.status in \('completed','issue','cancelled'\)/)
  assert.match(sql, /old\.status = 'active'[\s\S]*new\.status = 'ended'[\s\S]*return new/)
  assert.doesNotMatch(sql, /create table[^;]*(location_history|gps_history|driver_breadcrumbs)/i)
})

test('team workspaces expose assigned routes while keeping their normal workspace', () => {
  for (const page of ['../app/operations/page.tsx','../app/sales/page.tsx','../app/counter/page.tsx','../app/manager/page.tsx']) {
    assert.match(read(page), /TemporaryRouteAssignments/)
  }
  const access = read('../app/auth-access.ts')
  assert.match(access, /pathname === '\/driver'/)
  assert.match(access, /case 'sales_representative': return '\/sales'/)
  assert.match(access, /case 'counter_sales': return '\/counter'/)
})

test('a permanent Driver can start a driving day independently of a current route', () => {
  const source = read('../app/driver/page.tsx')
  assert.match(source, /startDrivingDay\(\{companyId:membership\.company_id/)
  assert.doesNotMatch(source, /if\(!driverId\|\|!current\|\|busy\)return[\s\S]{0,240}startDrivingDay\(\{companyId:membership\.company_id/)
})

test('Live Route is driven by active sessions rather than active route status', () => {
  const source = read('../app/routes/live-route.tsx')
  assert.doesNotMatch(source, /activeDriverIds/)
  assert.match(source, /sessionResult\.data/)
  assert.match(source, /selected\.route_id/)
  assert.match(source, /selectedNext/)
})
