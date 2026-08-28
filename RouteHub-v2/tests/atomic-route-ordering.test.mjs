import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migration=await readFile(new URL('../supabase/migrations/023_atomic_route_queue_reordering.sql',import.meta.url),'utf8')
const startingPointMigration=await readFile(new URL('../supabase/migrations/036_relink_queue_starting_point.sql',import.meta.url),'utf8')
const client=await readFile(new URL('../app/routes/manage/page.tsx',import.meta.url),'utf8')

test('atomic reorder derives and validates one complete queue server-side',()=>{
  assert.match(migration,/create or replace function public\.reorder_route_queue\(p_route_ids uuid\[\]\)/i)
  assert.match(migration,/returns table\(id uuid, "position" integer, origin_address text\)/i)
  assert.match(migration,/auth\.uid\(\)/)
  assert.match(migration,/cu\.company_id = v_anchor\.company_id/)
  assert.match(migration,/r\.branch_id is not distinct from v_anchor\.branch_id/)
  assert.match(migration,/r\.route_date is not distinct from v_anchor\.route_date/)
  assert.match(migration,/r\.driver_id = v_anchor\.driver_id/)
  assert.match(migration,/duplicate route IDs/)
  assert.match(migration,/route queue changed or contains routes from another queue/i)
})

test('atomic reorder locks the queue, preserves locked routes, and relinks origins',()=>{
  assert.match(migration,/pg_advisory_xact_lock/)
  assert.match(migration,/for update/)
  assert.match(migration,/r\.status in \('draft', 'pending', 'published', 'paused'\)/)
  assert.match(migration,/origin_address = case/)
  assert.match(migration,/origin_name = case/)
  assert.match(migration,/updated_version = coalesce\(r\.updated_version, 0\) \+ 1/)
  assert.match(migration,/route_queue_reordered/)
})

test('reordering rebuilds the first starting point and coordinate chain',()=>{
  assert.match(startingPointMigration,/r\.position < \(select min\(slot\) from unnest\(v_position_slots\)/)
  assert.match(startingPointMigration,/r\.status in \('active', 'completed', 'issue'\)/)
  assert.match(startingPointMigration,/from public\.branches b/)
  assert.match(startingPointMigration,/lag\(r\.destination_lat\)/)
  assert.match(startingPointMigration,/origin_lat = case/)
  assert.match(startingPointMigration,/origin_lng = case/)
})

test('reassignment normalizes only source and target queues',()=>{
  assert.match(migration,/create or replace function public\.reassign_upcoming_route/i)
  assert.match(migration,/Only upcoming routes can be reassigned/)
  assert.match(migration,/v_source_ids/)
  assert.match(migration,/v_target_ids/)
  assert.match(migration,/perform public\.reorder_route_queue\(v_source_ids\)/)
  assert.match(migration,/perform public\.reorder_route_queue\(v_target_ids\)/)
  assert.doesNotMatch(migration,/update\s+public\.company_users[\s\S]*set\s+role/i)
})

test('Manage Routes uses one queue RPC, not a client batch of independent order updates',()=>{
  assert.match(client,/rpc\('reorder_route_queue',\{p_route_ids:routeIds\}\)/)
  assert.doesNotMatch(client,/rpc\('reorder_driver_routes'/)
  assert.match(client,/await load\(\)/)
})
