import test from 'node:test'
import assert from 'node:assert/strict'
import {canMove,findCurrent,insertUrgent,interruptActive,reassignUpcoming,relinkOrigins,reorder,upcomingMissions} from '../lib/planner.ts'

const mission=(id,status,origin,destination,position=1)=>({id,type:'delivery',status,origin,destination,priority:'normal',position})
const seed=[
  mission('1','pending','Branch','Supplier',1),
  mission('2','pending','Supplier','Customer A',2),
  mission('3','completed','Customer A','Customer B',3),
]

test('reorders real planner missions and relinks origins',()=>{
  const result=reorder(seed,1,0)
  assert.deepEqual(result.map(item=>item.id),['2','1','3'])
  assert.equal(result[1].origin,result[0].destination)
  assert.deepEqual(result.map(item=>item.position),[1,2,3])
})

test('active, completed and cancelled positions are locked',()=>{
  assert.equal(canMove('active'),false)
  assert.equal(canMove('completed'),false)
  assert.equal(canMove('issue'),false)
  assert.equal(canMove('cancelled'),false)
  assert.strictEqual(reorder(seed,2,0),seed)
  const separated=[mission('a','pending','A','B',1),mission('locked','completed','B','C',2),mission('b','pending','C','D',3)]
  assert.strictEqual(reorder(separated,2,0),separated)
})

test('relinking keeps completed mission data intact',()=>{
  const result=relinkOrigins([mission('a','pending','A','B'),mission('done','completed','Saved origin','C')])
  assert.equal(result[1].origin,'Saved origin')
})

test('urgent mission uses first available slot and appends when all routes are locked',()=>{
  const urgent=mission('urgent','pending','Current','Branch')
  const result=insertUrgent(seed,urgent)
  assert.equal(result[0].id,'urgent')
  assert.equal(result[0].priority,'urgent')
  const locked=[mission('done','completed','A','B'),mission('cancelled','cancelled','B','C')]
  assert.deepEqual(insertUrgent(locked,urgent).map(item=>item.id),['done','cancelled','urgent'])
})

test('interrupting an active route pauses it and activates the urgent route',()=>{
  const routes=[mission('active','active','Branch','Supplier',1),mission('next','published','Supplier','Customer',2)]
  const result=interruptActive(routes,mission('urgent','pending','Current','Branch'))
  assert.equal(result[0].id,'urgent')
  assert.equal(result[0].status,'active')
  assert.equal(result.find(item=>item.id==='active').status,'paused')
})

test('finds current and ordered upcoming missions',()=>{
  const routes=[mission('later','published','B','C',3),mission('now','active','A','B',1),mission('done','completed','C','D',2)]
  assert.equal(findCurrent(routes).id,'now')
  assert.deepEqual(upcomingMissions(routes).map(item=>item.id),['later'])
})

test('normalizes an upcoming queue after moving the last route to position two',()=>{
  const queue=['A','B','C','D','E'].map((id,index)=>mission(id,'published',index?'Previous':'Branch',id,index+1))
  const result=reorder(queue,4,1)
  assert.deepEqual(result.map(item=>item.id),['A','E','B','C','D'])
  assert.deepEqual(result.map(item=>item.position),[1,2,3,4,5])
})

test('an active mission stays locked while its next mission follows the reordered upcoming queue',()=>{
  const active=mission('B','active','Branch','Customer B',2)
  const upcoming=[mission('C','published','Customer B','Customer C',3),mission('D','published','Customer C','Customer D',4),mission('E','published','Customer D','Customer E',5)]
  const result=reorder(upcoming,2,0)
  assert.equal(active.status,'active')
  assert.deepEqual(result.map(item=>item.id),['E','C','D'])
  assert.equal(upcomingMissions([active,...result]).at(0)?.id,'E')
})

test('reassigning an upcoming route normalizes each driver independently',()=>{
  const carlos=[mission('A','published','Branch','A',1),mission('B','pending','A','B',2),mission('C','published','B','C',3)]
  const pedro=[mission('X','published','Branch','X',1)]
  const result=reassignUpcoming(carlos,pedro,'B')
  assert.deepEqual(result.source.map(item=>item.id),['A','C'])
  assert.deepEqual(result.source.map(item=>item.position),[1,2])
  assert.deepEqual(result.target.map(item=>item.id),['X','B'])
  assert.deepEqual(result.target.map(item=>item.position),[1,2])
})
