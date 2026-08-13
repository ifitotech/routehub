import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const claimSql=readFileSync(new URL('../supabase/migrations/019_fix_invitation_acceptance.sql',import.meta.url),'utf8')
const rosterSql=readFileSync(new URL('../supabase/migrations/020_sync_team_members_and_route_drivers.sql',import.meta.url),'utf8')

test('invitation claim is authenticated, email-scoped and idempotent',()=>{
  assert.match(claimSql,/auth\.uid\(\) is null/i)
  assert.match(claimSql,/lower\(invitation\.email\) = authenticated_email/i)
  assert.match(claimSql,/on conflict \(company_id, user_id\)/i)
  assert.match(claimSql,/grant execute.+authenticated/is)
})

test('invitation claim accepts only known company roles',()=>{
  assert.match(claimSql,/branch_manager/)
  assert.match(claimSql,/operations_manager/)
  assert.match(claimSql,/driver/)
  assert.match(claimSql,/status = 'accepted'/)
})

test('team invitation creation is restricted to dispatch managers',()=>{
  assert.match(rosterSql,/create_team_invitation/)
  assert.match(rosterSql,/membership\.role in \('branch_manager','operations_manager'\)/)
  assert.match(rosterSql,/Manager access required/)
  assert.match(rosterSql,/revoke all on function public\.create_team_invitation/)
})

test('existing invited accounts are synchronized into the route assignment roster',()=>{
  assert.match(rosterSql,/from auth\.users/i)
  assert.match(rosterSql,/insert into public\.users/i)
  assert.match(rosterSql,/insert into public\.company_users/i)
  assert.match(rosterSql,/on conflict \(company_id, user_id\)/i)
  assert.match(rosterSql,/workspace members can read team roster/i)
})
