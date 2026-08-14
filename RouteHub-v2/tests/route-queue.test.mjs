import test from 'node:test'
import assert from 'node:assert/strict'
import {groupRouteQueues,routeQueueKey,sameRouteQueue} from '../lib/route-queue.ts'
import {reorder} from '../lib/planner.ts'

const route=(id,{company='company-a',branch='branch-a',date='2026-08-13',driver='carlos',position=1,origin='Branch',destination=id}={})=>({
  id,company_id:company,branch_id:branch,route_date:date,driver_id:driver,
  type:'delivery',status:'published',priority:'normal',position,origin,destination
})

test('Driver A reorder leaves Driver B queue unchanged',()=>{
  const routes=[
    route('A1',{position:1}),route('A2',{position:2}),route('A3',{position:3}),
    route('B1',{driver:'pedro',position:1}),route('B2',{driver:'pedro',position:2})
  ]
  const queues=groupRouteQueues(routes)
  const carlos=queues.find(queue=>queue.routes[0].driver_id==='carlos').routes
  const pedro=queues.find(queue=>queue.routes[0].driver_id==='pedro').routes
  const result=reorder(carlos,2,0)
  assert.deepEqual(result.map(item=>item.id),['A3','A1','A2'])
  assert.deepEqual(pedro.map(item=>item.id),['B1','B2'])
  assert.deepEqual(pedro.map(item=>item.position),[1,2])
})

test('date and branch are part of the queue identity',()=>{
  const today=route('today')
  const tomorrow=route('tomorrow',{date:'2026-08-14'})
  const anotherBranch=route('branch-b',{branch:'branch-b'})
  assert.notEqual(routeQueueKey(today),routeQueueKey(tomorrow))
  assert.notEqual(routeQueueKey(today),routeQueueKey(anotherBranch))
  assert.equal(sameRouteQueue(today,{...today,position:99}),true)
  assert.equal(groupRouteQueues([today,tomorrow,anotherBranch]).length,3)
})

test('reorder normalizes a movable queue and relinks only that queue origins',()=>{
  const queue=[
    route('A',{position:1,origin:'Branch',destination:'A'}),
    route('B',{position:2,origin:'A',destination:'B'}),
    route('C',{position:3,origin:'B',destination:'C'})
  ]
  const result=reorder(queue,2,0)
  assert.deepEqual(result.map(item=>item.id),['C','A','B'])
  assert.deepEqual(result.map(item=>item.position),[1,2,3])
  assert.equal(result[1].origin,'C')
  assert.equal(result[2].origin,'A')
})
