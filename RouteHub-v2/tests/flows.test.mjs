import test from 'node:test'
import assert from 'node:assert/strict'
import {selectPrimaryMembership} from '../lib/access.ts'
import {buildCompletionPatch,buildMissionInsert} from '../lib/mission-payload.ts'
import {buildEvidencePath} from '../lib/evidence-path.ts'
import {completionWarning,distanceMeters,withinRadius} from '../lib/location.ts'
import {isReportableDeliveryStatus} from '../lib/report-status.ts'

test('manager membership wins over a secondary driver assignment',()=>{
  const memberships=[
    {company_id:'company',branch_id:'branch',role:'driver'},
    {company_id:'company',branch_id:'branch',role:'branch_manager'},
  ]
  assert.equal(selectPrimaryMembership(memberships).role,'branch_manager')
})

test('route creation payload matches the production routes schema',()=>{
  const payload=buildMissionInsert({
    type:'delivery',driver_id:'driver',origin_address:'Branch',destination_address:'Customer',priority:'urgent',status:'published',scheduled_at:'2026-08-10T09:30:00.000Z',contact_id:'contact',notes:'Handle with care',
  },{company_id:'company',branch_id:'branch'},7,new Date('2026-08-09T10:00:00.000Z'))
  assert.equal(payload.mission_type,'delivery')
  assert.equal(payload.route_date,'2026-08-10')
  assert.equal(payload.scheduled_at,'2026-08-10T09:30:00.000Z')
  assert.equal(payload.mode,'flexible')
  assert.equal(payload.position,7)
  assert.equal(payload.driver_id,'driver')
  assert.equal(payload.contact_id,'contact')
  assert.equal('type' in payload,false)
})

test('completion stores GPS when available and safely falls back to manual',()=>{
  const at=new Date('2026-08-09T12:00:00.000Z')
  const gps=buildCompletionPatch({lat:25.7617,lng:-80.1918,accuracy:12},at)
  assert.deepEqual(gps,{status:'completed',completed_at:at.toISOString(),completion_method:'gps',completion_lat:25.7617,completion_lng:-80.1918,completion_accuracy:12})
  assert.deepEqual(buildCompletionPatch(undefined,at),{status:'completed',completed_at:at.toISOString(),completion_method:'manual'})
})

test('delivery distance records a warning without blocking completion',()=>{
  const nearby=distanceMeters({lat:25.7617,lng:-80.1918},{lat:25.76171,lng:-80.19181})
  assert.equal(withinRadius(nearby,300),true)
  assert.equal(completionWarning(nearby,300),null)
  const far=distanceMeters({lat:25.7617,lng:-80.1918},{lat:25.7717,lng:-80.1918})
  assert.equal(withinRadius(far,300),false)
  assert.match(completionWarning(far,300),/Completed \d+ m from destination/)
})

test('photo evidence path is private-by-company and sanitizes the extension',()=>{
  const path=buildEvidencePath('proof.JPG<script>',{companyId:'company',missionId:'route',userId:'driver'},'fixed-id')
  assert.equal(path,'company/route/driver/fixed-id.jpgscrip')
  assert.equal(path.includes('<'),false)
})

test('history and delivery reports include completed routes and exceptions',()=>{
  assert.equal(isReportableDeliveryStatus('completed'),true)
  assert.equal(isReportableDeliveryStatus('issue'),true)
  assert.equal(isReportableDeliveryStatus('cancelled'),true)
  assert.equal(isReportableDeliveryStatus('active'),false)
})
