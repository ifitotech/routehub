import {getSupabase} from './supabase'

export type DrivingSession={
 id:string
 company_id:string
 branch_id:string|null
 driver_id:string
 status:'active'|'ended'
 started_at:string
 ended_at:string|null
 last_lat:number|null
 last_lng:number|null
 last_accuracy:number|null
 last_updated_at:string
}

export type SessionCoordinates={lat:number;lng:number;accuracy?:number}

const sessionFields='id,company_id,branch_id,driver_id,status,started_at,ended_at,last_lat,last_lng,last_accuracy,last_updated_at'

export async function getActiveDrivingSession(driverId:string){
 const{data,error}=await getSupabase().from('driving_sessions').select(sessionFields).eq('driver_id',driverId).eq('status','active').maybeSingle()
 return{data:data as DrivingSession|null,error}
}

export async function startDrivingSession(input:{companyId:string;branchId?:string|null;driverId:string}){
 const existing=await getActiveDrivingSession(input.driverId)
 if(existing.error||existing.data)return existing
 const{data,error}=await getSupabase().from('driving_sessions').insert({company_id:input.companyId,branch_id:input.branchId||null,driver_id:input.driverId,status:'active'}).select(sessionFields).single()
 return{data:data as DrivingSession|null,error}
}

export async function updateDrivingLocation(sessionId:string,driverId:string,coordinates:SessionCoordinates){
 const{data,error}=await getSupabase().from('driving_sessions').update({last_lat:coordinates.lat,last_lng:coordinates.lng,last_accuracy:coordinates.accuracy??null,last_updated_at:new Date().toISOString()}).eq('id',sessionId).eq('driver_id',driverId).eq('status','active').select(sessionFields).maybeSingle()
 return{data:data as DrivingSession|null,error}
}

export async function endDrivingSession(sessionId:string,driverId:string){
 const{data,error}=await getSupabase().from('driving_sessions').update({status:'ended',ended_at:new Date().toISOString(),last_updated_at:new Date().toISOString()}).eq('id',sessionId).eq('driver_id',driverId).eq('status','active').select(sessionFields).maybeSingle()
 return{data:data as DrivingSession|null,error}
}

export async function loadActiveDrivingSessions(companyId:string,branchId?:string|null){
 let query=getSupabase().from('driving_sessions').select(sessionFields).eq('company_id',companyId).eq('status','active').order('last_updated_at',{ascending:false})
 if(branchId)query=query.or(`branch_id.eq.${branchId},branch_id.is.null`)
 const{data,error}=await query
 return{data:(data||[]) as DrivingSession[],error}
}
