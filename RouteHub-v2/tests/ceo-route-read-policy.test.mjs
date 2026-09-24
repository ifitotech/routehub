import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20260923170000_platform_admin_route_read.sql', import.meta.url), 'utf8')

test('CEO route visibility is platform-admin-only and read-only', () => {
  assert.match(sql, /create policy "platform admins read routes"/i)
  assert.match(sql, /on public\.routes\s+for select\s+to authenticated/i)
  assert.match(sql, /from public\.platform_admins/i)
  assert.match(sql, /admin\.user_id = \(select auth\.uid\(\)\)/i)
  assert.doesNotMatch(sql, /for\s+(insert|update|delete|all)/i)
})
