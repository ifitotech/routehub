/** Serializes critical Driver operations without changing their backend semantics. */
export class DriverActionCoordinator {
  private active = new Set<string>()

  isBusy(action: string) { return this.active.has(action) }

  async run<T>(action: string, operation: () => Promise<T>): Promise<T | undefined> {
    if (this.active.has(action)) return undefined
    this.active.add(action)
    try { return await operation() } finally { this.active.delete(action) }
  }
}

export const driverActions = new DriverActionCoordinator()

import {getSupabase} from '../supabase'
import {completeMission} from '../data'
import {uploadMissionEvidence} from '../mission-evidence'
import {saveCustomerSignature} from '../signature'
import {uploadTruckReceipt} from '../truck-receipts'
import {startDrivingDay as coreStartDrivingDay, endDrivingDay as coreEndDrivingDay} from '../driving-session'

export type DriverMutationContext = {routeId:string; driverId:string; companyId:string}

export async function startDrivingDay(ctx:{driverId:string; companyId:string; branchId?:string|null}) {
  return driverActions.run(`driving-day:start:${ctx.driverId}`, async()=>{
    const result=await coreStartDrivingDay(ctx)
    if(result.error) throw result.error
    return result.data
  })
}

export async function endDrivingDay(ctx:{driverId:string; sessionId:string}) {
  return driverActions.run(`driving-day:end:${ctx.driverId}`, async()=>{
    const result=await coreEndDrivingDay(ctx.sessionId,ctx.driverId)
    if(result.error) throw result.error
    if(!result.data) throw new Error('Driving day is no longer active.')
    return result.data
  })
}

export async function startRoute(ctx:DriverMutationContext, today:string) {
  return driverActions.run(`start-route:${ctx.routeId}`, async()=>{
    const client=getSupabase()
    const route=await client.from('routes').select('id,status,route_date,route_started_at').eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).maybeSingle()
    if(route.error) throw route.error
    if(!route.data || !['pending','published','paused'].includes(route.data.status) || (route.data.route_date||'').slice(0,10)>today) throw new Error('This route cannot be started.')
    const result=await client.from('routes').update({status:'active',route_started_at:route.data.route_started_at||new Date().toISOString(),updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function updateRouteStatus(ctx:DriverMutationContext, status:string, today:string, issue?:{note?:string;photo?:File}) {
  return driverActions.run(`status:${ctx.routeId}:${status}`, async()=>{
    const client=getSupabase()
    const current=await client.from('routes').select('id,status,route_date,route_started_at').eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).maybeSingle()
    if(current.error) throw current.error
    if(!current.data) throw new Error('Route not found.')
    if(status==='active') {
      if(!['pending','published','paused'].includes(current.data.status)||(current.data.route_date||'').slice(0,10)>today) throw new Error('This route cannot be started.')
      const others=await client.from('routes').select('id').eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).eq('status','active').neq('id',ctx.routeId)
      if(others.error) throw others.error
      if(others.data?.length){const paused=await client.from('routes').update({status:'paused',updated_version:Date.now()}).in('id',others.data.map(item=>item.id)).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId);if(paused.error)throw paused.error}
    }
    if(status==='issue'&&issue?.photo) await uploadMissionEvidence(issue.photo,ctx.routeId,{kind:'issue',attachAsCompletionPhoto:false})
    const payload:Record<string,unknown>={status,updated_version:Date.now()}
    if(status==='active'&&!current.data.route_started_at) payload.route_started_at=new Date().toISOString()
    if(status==='issue') payload.driver_note=issue?.note?.trim()||null
    const result=await client.from('routes').update(payload).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function markArrived(ctx:DriverMutationContext) {
  return driverActions.run(`arrived:${ctx.routeId}`, async()=>{
    const result=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).is('arrived_at',null).select('id,arrived_at').maybeSingle()
    if(result.error) throw result.error
    if(!result.data) throw new Error('Arrival was already recorded.')
    return result.data
  })
}

export async function completeStop(ctx:DriverMutationContext, options?:{driverNote?:string; location?:{lat:number;lng:number;accuracy:number}}) {
  return driverActions.run(`complete:${ctx.routeId}`, async()=>completeMission(ctx.routeId, options?.location, options?.driverNote===undefined?undefined:{driverNote:options.driverNote}))
}

export const completePickup = completeStop
export const completeDelivery = completeStop
export const completeReturn = completeStop

export async function completePickupWithEvidence(ctx:DriverMutationContext, photo?:File) {
  return driverActions.run(`pickup:${ctx.routeId}`, async()=>{
    if(photo) await uploadMissionEvidence(photo,ctx.routeId,{kind:'photo',attachAsCompletionPhoto:false})
    const arrival=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).is('arrived_at',null).select('id').maybeSingle()
    if(arrival.error) throw arrival.error
    // Arrived may already exist from the normal Start → Arrived → Complete flow.
    return completeMission(ctx.routeId)
  })
}

export async function completeDeliveryWithRecipient(ctx:DriverMutationContext, recipient:string, existingNote='', location?:{lat:number;lng:number;accuracy:number}) {
  const name=recipient.trim()
  if(!name) throw new Error('Recipient is required.')
  const recipientNote=`Received by: ${name}`
  const driverNote=existingNote&&!existingNote.startsWith('Received by:')?`${recipientNote}\n${existingNote}`:recipientNote
  return completeStop(ctx,{driverNote,location})
}

export async function uploadStopPhoto(ctx:DriverMutationContext, file:File) {
  return driverActions.run(`photo:${ctx.routeId}`, async()=>uploadMissionEvidence(file,ctx.routeId))
}

export async function saveFuel(ctx:DriverMutationContext & {truckId:string;branchId:string;odometer:number;amount:number;photo?:File}) {
  return driverActions.run(`fuel:${ctx.truckId}`, async()=>{
    const recordId=crypto.randomUUID(); const receipt_path=ctx.photo?await uploadTruckReceipt(ctx.photo,{companyId:ctx.companyId,branchId:ctx.branchId,truckId:ctx.truckId,recordId}):null
    const result=await getSupabase().from('truck_fuel_logs').insert({id:recordId,truck_id:ctx.truckId,company_id:ctx.companyId,branch_id:ctx.branchId,recorded_by:ctx.driverId,odometer:ctx.odometer,amount:ctx.amount,receipt_path}).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function saveMaintenance(ctx:DriverMutationContext & {truckId:string;branchId:string;maintenanceType:string;odometer:number;amount?:number;photo?:File}) {
  return driverActions.run(`maintenance:${ctx.truckId}`, async()=>{
    const recordId=crypto.randomUUID(); const receipt_path=ctx.photo?await uploadTruckReceipt(ctx.photo,{companyId:ctx.companyId,branchId:ctx.branchId,truckId:ctx.truckId,recordId}):null
    const result=await getSupabase().from('truck_maintenance_logs').insert({id:recordId,truck_id:ctx.truckId,company_id:ctx.companyId,branch_id:ctx.branchId,recorded_by:ctx.driverId,maintenance_type:ctx.maintenanceType.trim(),odometer:ctx.odometer,amount:ctx.amount??null,receipt_path}).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function reportIssue(ctx:DriverMutationContext, note:string, photo?:File) {
  return driverActions.run(`issue:${ctx.routeId}`, async()=>{
    if(photo) await uploadMissionEvidence(photo,ctx.routeId,{kind:'issue',attachAsCompletionPhoto:false})
    const result=await getSupabase().from('routes').update({status:'issue',driver_note:note.trim()||null,updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function saveStopNote(ctx:DriverMutationContext, note:string) {
  return driverActions.run(`note:${ctx.routeId}`, async()=>{
    const result=await getSupabase().from('routes').update({driver_note:note.trim(),updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).select().single()
    if(result.error) throw result.error
    return result.data
  })
}

export async function saveStopSignature(ctx:DriverMutationContext, canvas:HTMLCanvasElement) {
  return driverActions.run(`signature:${ctx.routeId}`, async()=>saveCustomerSignature(canvas,{companyId:ctx.companyId,userId:ctx.driverId,missionId:ctx.routeId}))
}

export async function finalizeRoute(ctx:DriverMutationContext, method:'normal'|'photo'|'issue', note='', issue='', photo?:File) {
  return driverActions.run(`finalize:${ctx.routeId}`, async()=>{
    const {canFinalizeRoute}=await import('../stop-workflow')
    const client=getSupabase()
    const current=await client.from('routes').select('id,route_date,company_id,driver_id').eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).maybeSingle()
    if(current.error) throw current.error
    if(!current.data) throw new Error('Route not found.')
    const siblings=await client.from('routes').select('id,position,status,mission_type,completed_at,finalized_at').eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).eq('route_date',current.data.route_date)
    if(siblings.error) throw siblings.error
    if(!canFinalizeRoute((siblings.data||[]) as any)) throw new Error('Required stops remain.')
    let photoPath:string|undefined
    if(photo) photoPath=(await uploadMissionEvidence(photo,ctx.routeId,{kind:method==='issue'?'issue':'finalization',attachAsCompletionPhoto:false})).path
    const result=await getSupabase().from('routes').update({finalized_at:new Date().toISOString(),route_completed_at:new Date().toISOString(),finalization_method:method,finalization_note:note.trim()||null,finalization_issue:method==='issue'?issue||'Other':null,finalization_photo_path:photoPath||null,updated_version:Date.now()}).eq('id',ctx.routeId).eq('driver_id',ctx.driverId).eq('company_id',ctx.companyId).is('finalized_at',null).select('id,finalized_at,route_completed_at').maybeSingle()
    if(result.error) throw result.error
    if(!result.data) throw new Error('This route was already completed.')
    return result.data
  })
}
