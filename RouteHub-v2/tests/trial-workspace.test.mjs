import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const migrationUrl = new URL('../supabase/migrations/010_public_trial_workspace.sql', import.meta.url)
const loginUrl = new URL('../app/login/page.tsx', import.meta.url)

test('trial workspace migration creates a manager workspace without waiting for approval', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.match(sql, /create_trial_workspace/i)
  assert.match(sql, /interval '7 days'/i)
  assert.match(sql, /'branch_manager'/i)
  assert.match(sql, /'pending'/i)
  assert.match(sql, /lower\(email\)\s*=\s*current_email/i)
  assert.match(sql, /security definer/i)
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from/i)
})

test('landing page collects the necessary access request details and starts the trial workspace', async () => {
  const page = await readFile(loginUrl, 'utf8')
  for (const field of ['Your name', 'Company name', 'Phone number', 'Create password']) assert.match(page, new RegExp(field))
  assert.match(page, /create_trial_workspace/)
  assert.match(page, /Start 7-day trial/)
})
