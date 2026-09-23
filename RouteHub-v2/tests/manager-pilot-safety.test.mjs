import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const issueEditor = read('../app/routes/manage/issue-reschedule.tsx')
const issuesPage = read('../app/routes/issues/page.tsx')
const routesScreen = read('../app/routes/routes-screen.tsx')
const routesCore = read('../app/routes/routes-workspace-core.tsx')
const migration = read('../supabase/migrations/20260923143000_pilot_manager_reschedule_and_function_hardening.sql')
const layout = read('../app/layout.tsx')
const login = read('../app/login/page.tsx')
const errorListener = read('../app/app-error-listener.tsx')
const support = read('../lib/support.ts')
const routesDerived = read('../app/routes/routes-workspace-derived.tsx')

test('Manager reschedules an issue through one atomic database operation', () => {
  assert.match(issueEditor, /rpc\('reschedule_issue_route'/)
  assert.doesNotMatch(issueEditor, /from\('routes'\)\.update/)
  assert.match(migration, /create or replace function public\.reschedule_issue_route/)
  assert.match(migration, /where route_row\.id = p_route_id\s+for update/)
  assert.match(migration, /insert into public\.activity_logs/)
})

test('Issue recovery remains visible and localized to the Manager', () => {
  assert.match(issuesPage, /driver_note/)
  assert.match(issuesPage, /Nota del driver/)
  assert.match(issuesPage, /href="\/routes"/)
  assert.doesNotMatch(issuesPage, /href="\/routes\/manage"/)
})

test('Editing a route preserves the receiver instead of copying the destination name', () => {
  assert.match(routesCore, /destination_phone,destination_contact_name,scheduled_at/)
  assert.match(routesScreen, /stop_contact_name: route\.destination_contact_name \|\| ''/)
  assert.doesNotMatch(routesScreen, /stop_contact_name: route\.destination_name/)
})

test('Theme boot and login flows do not fight React hydration', () => {
  assert.match(layout, /<html lang="en" suppressHydrationWarning>/)
  assert.doesNotMatch(login, /document\.createElement|appendChild|querySelector/)
  assert.match(login, /credentialFlow === 'invite'/)
  assert.match(login, /setCredentialFlow\('recovery'\)/)
})

test('Global error reporting ignores framework and browser control signals', () => {
  assert.match(errorListener, /message === 'NEXT_REDIRECT'/)
  assert.match(errorListener, /message === 'Script error\.'/)
  assert.match(errorListener, /message\.startsWith\('ResizeObserver loop'\)/)
})

test('Support requests use a category accepted by the deployed schema', () => {
  assert.match(support, /category: 'question'/)
  assert.doesNotMatch(support, /category: 'general'/)
  assert.match(support, /subject: 'RouteHub support request'/)
})

test('Legacy contacts without an address cannot crash Manager route search', () => {
  assert.match(routesDerived, /\(item\.address \|\| ''\)\.toLowerCase\(\)/)
  assert.doesNotMatch(routesDerived, /item\.address\.toLowerCase\(\)/)
})
