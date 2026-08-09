import test from 'node:test'
import assert from 'node:assert/strict'
import {actionsFor,can} from '../lib/permissions.ts'
import {workspaceForRole} from '../lib/workspace.ts'

test('driver can complete assigned work but cannot manage dispatch',()=>{
  assert.equal(can('driver','drive_mission'),true)
  assert.equal(can('driver','manage_routes'),false)
  assert.equal(can('driver','manage_companies'),false)
})

test('counter can create requests but not routes',()=>{
  assert.equal(can('counter_sales','create_request'),true)
  assert.equal(can('counter_sales','create_route'),false)
  assert.deepEqual(actionsFor('counter_sales').sort(),['create_request','view_contacts'])
})

test('manager can assign and reorder routes, but cannot manage platform companies',()=>{
  assert.equal(can('branch_manager','manage_routes'),true)
  assert.equal(can('branch_manager','manage_team'),true)
  assert.equal(can('branch_manager','manage_companies'),false)
})

test('CEO can test every workspace and each role has a deterministic home',()=>{
  for(const action of ['create_route','manage_routes','create_request','manage_team','manage_companies','drive_mission','view_reports','view_contacts'])assert.equal(can('ceo',action),true)
  assert.equal(workspaceForRole('branch_manager'),'/manager')
  assert.equal(workspaceForRole('operations_manager'),'/operations')
  assert.equal(workspaceForRole('sales_representative'),'/sales')
  assert.equal(workspaceForRole('counter_sales'),'/counter')
  assert.equal(workspaceForRole('driver'),'/driver')
})
