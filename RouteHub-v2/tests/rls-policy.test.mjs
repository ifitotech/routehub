import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migrationUrl=new URL('../supabase/migrations/008_driver_assigned_route_updates.sql',import.meta.url)

test('driver route migration is company-scoped and assignment-scoped',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  assert.match(sql,/driver_id\s*=\s*auth\.uid\(\)/i)
  assert.match(sql,/cu\.company_id\s*=\s*routes\.company_id/i)
  assert.match(sql,/cu\.role\s*=\s*'driver'/i)
  assert.match(sql,/for update\s+to authenticated/i)
})

test('driver route migration protects dispatch fields and valid transitions',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  assert.match(sql,/to_jsonb\(new\)\s*-\s*allowed_columns/i)
  assert.match(sql,/old\.status\s*=\s*'active'.*'paused','completed','issue'/is)
  assert.match(sql,/old\.status\s*=\s*'paused'.*'active','completed','issue'/is)
  assert.match(sql,/raise exception 'Drivers may only update route progress/i)
})

test('driver route migration is additive and idempotent',async()=>{
  const sql=await readFile(migrationUrl,'utf8')
  assert.doesNotMatch(sql,/drop\s+table|truncate\s+table|delete\s+from/i)
  assert.match(sql,/drop policy if exists/i)
  assert.match(sql,/create or replace function/i)
  assert.match(sql,/drop trigger if exists/i)
})
