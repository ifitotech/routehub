import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20260910191125_schedule_driver_morning_route_reminders.sql', import.meta.url), 'utf8')
const edgeFunction = await readFile(new URL('../supabase/functions/send-route-push/index.ts', import.meta.url), 'utf8')

test('morning reminders are deduplicated per driver and operational date', () => {
  assert.match(migration, /create table if not exists public\.route_reminder_deliveries/i)
  assert.match(migration, /unique \(company_id, driver_id, route_date\)/i)
  assert.match(migration, /enable row level security/i)
  assert.match(migration, /revoke all on table public\.route_reminder_deliveries from anon, authenticated/i)
})

test('Cron calls the protected reminder job at 7 AM Miami time across daylight saving time', () => {
  assert.match(migration, /create extension if not exists pg_net/i)
  assert.match(migration, /'0 11,12 \* \* \*'/i)
  assert.match(migration, /net\.http_post/i)
  assert.match(migration, /routehub_publishable_key/i)
  assert.match(migration, /routehub_morning_reminder_secret/i)
  assert.match(edgeFunction, /action === 'morning_reminder'/i)
  assert.match(edgeFunction, /x-routehub-cron-secret/i)
  assert.match(edgeFunction, /timeZone: 'America\/New_York'/i)
  assert.match(edgeFunction, /now\.hour !== 7/i)
})

test('the internal reminder path does not weaken authenticated manager route pushes', () => {
  const reminderGuard = edgeFunction.indexOf("action === 'morning_reminder'")
  const callerGuard = edgeFunction.indexOf("if (!authorization) return json({error: 'Unauthorized'}, 401)")
  assert.ok(reminderGuard >= 0 && callerGuard > reminderGuard)
  assert.match(edgeFunction, /Manager access required/)
})
