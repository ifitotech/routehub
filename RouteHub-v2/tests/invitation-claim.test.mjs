import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync(new URL('../supabase/migrations/014_claim_team_invitation.sql',import.meta.url),'utf8')

test('invitation claim is authenticated, email-scoped and idempotent',()=>{
  assert.match(sql,/auth\.uid\(\) is null/i)
  assert.match(sql,/lower\(invitation\.email\) = authenticated_email/i)
  assert.match(sql,/on conflict \(company_id, user_id\)/i)
  assert.match(sql,/grant execute.+authenticated/is)
})

test('invitation claim accepts only known company roles',()=>{
  assert.match(sql,/branch_manager/)
  assert.match(sql,/operations_manager/)
  assert.match(sql,/driver/)
  assert.match(sql,/status='accepted'/)
})

test('team invitation creation is restricted to dispatch managers',()=>{
  assert.match(sql,/create_team_invitation/)
  assert.match(sql,/membership\.role in \('branch_manager','operations_manager'\)/)
  assert.match(sql,/Manager access required/)
  assert.match(sql,/revoke all on function public\.create_team_invitation/)
})
