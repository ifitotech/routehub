import assert from 'node:assert/strict'
import test from 'node:test'
import {readFile} from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/20260910185347_manager_route_priority_and_reschedule.sql', import.meta.url), 'utf8')

test('manager priority change is authenticated, branch-scoped, and pauses the active route atomically', () => {
  assert.match(migration, /create or replace function public\.prioritize_route_now/i)
  assert.match(migration, /if auth\.uid\(\) is null/i)
  assert.match(migration, /role in \('branch_manager','operations_manager','sales_representative'\)/i)
  assert.match(migration, /set status = 'paused'/i)
  assert.match(migration, /set status = 'active', priority = 'urgent'/i)
  assert.match(migration, /pg_advisory_xact_lock/i)
  assert.match(migration, /route_prioritized_by_manager/i)
  assert.match(migration, /grant execute on function public\.prioritize_route_now\(uuid\) to authenticated/i)
})

test('moving an unstarted route to tomorrow preserves authoritative day queues', () => {
  assert.match(migration, /create or replace function public\.reschedule_upcoming_route/i)
  assert.match(migration, /status not in \('draft','pending','published'\)/i)
  assert.match(migration, /set route_date = p_route_date/i)
  assert.match(migration, /v_source_lock/i)
  assert.match(migration, /v_target_lock/i)
  assert.match(migration, /perform public\.reorder_route_queue\(v_source_ids\)/i)
  assert.match(migration, /perform public\.reorder_route_queue\(v_target_ids\)/i)
  assert.match(migration, /route_rescheduled_by_manager/i)
  assert.match(migration, /grant execute on function public\.reschedule_upcoming_route\(uuid, date\) to authenticated/i)
})
