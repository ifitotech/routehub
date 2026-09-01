import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canFinalizeRoute,nextRequiredStop,routeProgress,stopAction,stopKind} from '../lib/stop-workflow.ts'

const stop=(id,type,status,position,extra={})=>({id,mission_type:type,status,position,...extra})
const driverPage=()=>readFileSync(new URL('../app/driver-v3/page.tsx',import.meta.url),'utf8')
const completedPage=()=>readFileSync(new URL('../app/driver-v3/completed/page.tsx',import.meta.url),'utf8')
const driverData=()=>readFileSync(new URL('../lib/driver-v3/use-driver-data.ts',import.meta.url),'utf8')
const driverActions=()=>readFileSync(new URL('../lib/driver/driver-actions.ts',import.meta.url),'utf8')
const routesPage=()=>readFileSync(new URL('../app/routes/page.tsx',import.meta.url),'utf8')
const managePage=()=>readFileSync(new URL('../app/routes/manage/page.tsx',import.meta.url),'utf8')
const migration=()=>readFileSync(new URL('../supabase/migrations/026_stop_workflow_and_finalization.sql',import.meta.url),'utf8')

test('legacy return and transfer route records keep a stable stop meaning',()=>{
  assert.equal(stopKind('pickup'),'pickup')
  assert.equal(stopKind('delivery'),'delivery')
  assert.equal(stopKind('return'),'branch')
  assert.equal(stopKind('branch'),'branch')
  assert.equal(stopKind('transfer'),'delivery')
})

test('a delivery-only route follows Arrived then Complete Delivery',()=>{
  assert.equal(stopAction('delivery',false),'arrived')
  assert.equal(stopAction('delivery',true),'complete_delivery')
  assert.equal(canFinalizeRoute([stop('delivery','delivery','completed',1)]),true)
})

test('a pickup-only route follows Arrived then Confirm Pickup',()=>{
  assert.equal(stopAction('pickup',false),'arrived')
  assert.equal(stopAction('pickup',true),'confirm_pickup')
  assert.equal(canFinalizeRoute([stop('pickup','pickup','completed',1)]),true)
})

test('a pickup followed by delivery advances in ordered sequence',()=>{
  const queue=[stop('pickup','pickup','completed',1),stop('delivery','delivery','published',2)]
  assert.equal(nextRequiredStop(queue)?.id,'delivery')
  assert.equal(canFinalizeRoute(queue),false)
})

test('a branch after pickup and delivery is still a required stop',()=>{
  const queue=[stop('pickup','pickup','completed',1),stop('delivery','delivery','completed',2),stop('branch','return','published',3)]
  assert.equal(nextRequiredStop(queue)?.id,'branch')
  assert.equal(canFinalizeRoute(queue),false)
})

test('a pickup, delivery, branch, delivery, branch sequence advances correctly',()=>{
  const queue=[
    stop('pickup','pickup','completed',1),
    stop('delivery-a','delivery','completed',2),
    stop('branch-a','return','completed',3),
    stop('delivery-b','delivery','completed',4),
    stop('branch-b','return','published',5),
  ]
  assert.equal(nextRequiredStop(queue)?.id,'branch-b')
  assert.equal(canFinalizeRoute(queue),false)
})

test('a branch in the middle completes only that stop and advances to delivery',()=>{
  const stops=[
    stop('pickup','pickup','completed',1),
    stop('branch','return','completed',2),
    stop('delivery','delivery','published',3),
    stop('final-branch','return','published',4),
  ]
  assert.equal(stopAction('branch',false),'complete_branch')
  assert.equal(nextRequiredStop(stops)?.id,'delivery')
  assert.equal(canFinalizeRoute(stops),false)
})

test('the final branch enables route finish only after it is completed',()=>{
  const before=[stop('one','pickup','completed',1),stop('two','delivery','completed',2),stop('three','return','published',3)]
  assert.equal(canFinalizeRoute(before),false)
  const after=before.map(item=>item.id==='three'?{...item,status:'completed'}:item)
  assert.equal(canFinalizeRoute(after),true)
  assert.deepEqual(routeProgress(after),{total:3,completed:3,next:undefined,readyToFinalize:true})
})

test('V3 route finalization is a separate guarded backend write',()=>{
  const source=completedPage()
  assert.match(source,/const finish = async \(\) =>/)
  assert.match(source,/if \(!last \|\| busy \|\| !ready\) return/)
  assert.match(source,/finalizeRoute\(\{routeId: last\.id, driverId, companyId: last\.company_id\}, 'normal'\)/)
})

test('normal route finalization only becomes available after every required stop',()=>{
  const queue=[stop('a','pickup','completed',1,{arrived_at:'2026-08-22T10:00:00Z'}),stop('b','delivery','completed',2)]
  assert.equal(routeProgress(queue).readyToFinalize,true)
  const source=completedPage()
  assert.match(source,/canFinalizeRoute\(dayRoutes as any\)/)
  assert.match(source,/disabled=\{busy \|\| !ready \|\| !last\}/)
})

test('Complete with Photo stores separate final evidence without replacing delivery POD',()=>{
  const source=driverActions()
  assert.match(source,/finalization_photo_path:photoPath\|\|null/)
  assert.match(source,/kind:method==='issue'\?'issue':'finalization',attachAsCompletionPhoto:false/)
  assert.match(source,/finalization_method:method/)
})

test('Report an Issue uses the shared mutation with a note and optional photo',()=>{
  const source=driverPage()
  const actions=driverActions()
  assert.match(source,/setIssueOpen\(true\)/)
  assert.match(source,/setIssueNote/)
  assert.match(source,/reportIssue\(ctx\(\), issueNote\.trim\(\)\|\|'Issue reported on delivery'\)/)
  assert.match(actions,/export async function reportIssue/)
  assert.match(actions,/kind:'issue',attachAsCompletionPhoto:false/)
})

test('delivery retains photo and customer signature proof while pickup remains lighter',()=>{
  const source=driverPage()
  assert.match(source,/if\(photo\) await uploadStopPhoto\(ctx\(\), photo\)/)
  assert.match(source,/if\(signed && canvas\.current\) await saveStopSignature\(ctx\(\), canvas\.current\)/)
  assert.match(source,/completeDeliveryWithRecipient\(ctx\(\), name, issueNote, location\)/)
  assert.match(source,/completePickupWithEvidence\(ctx\(\)\)/)
})

test('pickup PO is captured in both the builder and focused driver display',()=>{
  assert.match(routesPage(),/form\.type==='pickup'&&<label[^>]*><span>\{c\.po\}/)
  assert.match(driverPage(),/kind!=='return'&&route\.order_number/)
  assert.match(driverPage(),/PO \{route\.order_number\}/)
})

test('manager can edit pickup, delivery, and branch data without replacing the queue',()=>{
  const source=managePage()
  // The manager editor is localized, so assert the semantic controls and their
  // English copy source rather than a hard-coded rendered label.
  assert.match(source,/\{copy\.stopType\}<select/)
  assert.match(source,/pickupFrom:'Pickup from \/ location'/)
  assert.match(source,/deliveryAddress:'Delivery address'/)
  assert.match(source,/return:'Return to branch'/)
  assert.match(source,/destination_phone/)
})

test('driver refresh and realtime loading include persisted workflow state',()=>{
  const source=driverData()+driverActions()
  for(const field of ['arrived_at','destination_phone','customer_signature_path','finalized_at','finalization_method'])assert.match(source,new RegExp(field))
  assert.match(source,/postgres_changes/)
  assert.match(source,/createRealtimeRefresh\(/)
  assert.match(source,/void load\(\)/)
})

test('database finalization is additive, atomic, and double-submit safe',()=>{
  const sql=migration()
  assert.doesNotMatch(sql,/drop\s+table|truncate\s+table|delete\s+from/i)
  assert.match(sql,/add column if not exists arrived_at/i)
  assert.match(sql,/create trigger enforce_route_queue_finalization/i)
  assert.match(sql,/route\.status not in \('completed','cancelled'\)/i)
  assert.match(sql,/This route queue is already completed/i)
  assert.match(sql,/new\.finalization_method not in \('normal','photo','issue'\)/i)
  assert.match(sql,/Store route completion on the final stop in the queue/i)
  assert.match(readFileSync(new URL('../lib/driver/driver-actions.ts',import.meta.url),'utf8'),/\.is\('finalized_at',null\)\.select\('id,finalized_at,route_completed_at'\)\.maybeSingle\(\)/)
  assert.match(readFileSync(new URL('../lib/data.ts',import.meta.url),'utf8'),/\.in\('status',\['pending','published','active','paused','issue'\]\)\.select\(\)\.maybeSingle\(\)/)
})

test('cancelled stops do not block a route, but issues do',()=>{
  assert.equal(canFinalizeRoute([stop('done','delivery','completed',1),stop('cancelled','pickup','cancelled',2)]),true)
  assert.equal(canFinalizeRoute([stop('done','delivery','completed',1),stop('issue','pickup','issue',2)]),false)
  assert.match(readFileSync(new URL('../lib/driver/driver-selectors.ts',import.meta.url),'utf8'),/status !== 'cancelled'/)
})
