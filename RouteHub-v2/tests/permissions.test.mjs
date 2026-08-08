import test from 'node:test'
import assert from 'node:assert/strict'
const rules={create_route:['ceo','branch_manager','operations_manager','sales_representative'],manage_routes:['ceo','branch_manager','operations_manager','sales_representative'],create_request:['ceo','branch_manager','operations_manager','sales_representative','counter_sales'],manage_team:['ceo','branch_manager'],manage_companies:['ceo'],drive_mission:['ceo','driver'],view_reports:['ceo','branch_manager','operations_manager','sales_representative'],view_contacts:['ceo','branch_manager','operations_manager','sales_representative','counter_sales']}
const can=(role,action)=>rules[action].includes(role)
test('driver cannot manage dispatch',()=>{assert.equal(can('driver','drive_mission'),true);assert.equal(can('driver','manage_routes'),false);assert.equal(can('driver','manage_companies'),false)})
test('counter can create requests but not routes',()=>{assert.equal(can('counter_sales','create_request'),true);assert.equal(can('counter_sales','create_route'),false)})
test('ceo can test all workspaces',()=>{for(const action of Object.keys(rules))assert.equal(can('ceo',action),true)})
