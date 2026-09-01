import {getSupabase} from './supabase'
import type {Role,MissionStatus,Priority} from './types'
import {recordActivity} from './activity'
import {getCurrentLocation} from './location'
import {selectPrimaryMembership} from './access'
import {buildCompletionPatch,buildMissionInsert,type MissionInput} from './mission-payload'
export async function currentUser(){const{data,error}=await getSupabase().auth.getUser();if(error||!data.user)throw new Error('Not signed in');return data.user}
export async function currentMembership(){const user=await currentUser();const{data,error}=await getSupabase().from('company_users').select('company_id,branch_id,role').eq('user_id',user.id);const membership=selectPrimaryMembership(data as any);if(error||!membership)throw new Error('No company membership');return membership}
export async function currentAccess(){const user=await currentUser();const s=getSupabase();const[{data:memberships},{data:admin}]=await Promise.all([s.from('company_users').select('company_id,branch_id,role').eq('user_id',user.id),s.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle()]);if(admin)return{role:'ceo' as const,isCeo:true,membership:selectPrimaryMembership(memberships as any)||null};const membership=selectPrimaryMembership(memberships as any);if(!membership)throw new Error('No company membership');return{role:membership.role,membership,isCeo:false}}
export async function listContacts(){const membership=await currentMembership();return getSupabase().from('contacts').select('id,company_name,contact_name,address,phone').eq('company_id',membership.company_id).order('company_name')}
export async function listTeam(){const membership=await currentMembership();return getSupabase().from('company_users').select('user_id,role,branch_id').eq('company_id',membership.company_id)}
export async function inviteMember(email:string,role:Role){await currentUser();await currentMembership();const client=getSupabase();const normalized=email.trim().toLowerCase();const rpc=await client.rpc('create_team_invitation',{invited_email:normalized,invited_role:role});if(rpc.error)throw rpc.error;return{data:rpc.data,error:null}}
export async function listCompanies(){return getSupabase().from('companies').select('id,name').order('name')}
export async function listBranches(companyId:string){return getSupabase().from('branches').select('id,name,address,company_id').eq('company_id',companyId).order('name')}
export async function createMission(input:MissionInput){
  const membership=await currentMembership()
  const s=getSupabase()
  // Build once so the position lookup and insert use the exact same
  // operational date. Positions belong to one company + branch + date +
  // assignee queue, never to a company-wide driver list.
  const draft=buildMissionInsert(input,membership,0)
  let positionQuery=s.from('routes').select('position')
    .eq('company_id',membership.company_id)
    .eq('driver_id',input.driver_id)
    .eq('route_date',draft.route_date)
    .order('position',{ascending:false})
    .limit(1)
  positionQuery=membership.branch_id
    ? positionQuery.eq('branch_id',membership.branch_id)
    : positionQuery.is('branch_id',null)
  const{data:last,error:positionError}=await positionQuery.maybeSingle()
  if(positionError)return{data:null,error:positionError}
  const payload={...draft,position:Number(last?.position||0)+1}
  return s.from('routes').insert(payload).select().single()
}
export async function updateMission(id:string,patch:Partial<{driver_id:string;status:MissionStatus;priority:Priority;notes:string;position:number}>){const user=await currentUser();const membership=await currentMembership();const result=await getSupabase().from('routes').update(patch).eq('id',id).eq('company_id',membership.company_id).select().single();if(!result.error)await recordActivity({companyId:membership.company_id,userId:user.id,action:'mission_updated',recordId:id,after:patch});return result}
export async function setMissionStatus(id:string,status:MissionStatus){const user=await currentUser();const result=await getSupabase().from('routes').update({status,updated_version:Date.now()}).eq('id',id).eq('driver_id',user.id).select().single();if(result.error)throw result.error;return result.data}
export async function completeMission(id:string,providedLocation?:{lat:number;lng:number;accuracy:number},options?:{driverNote?:string}){
  const user=await currentUser()
  const membership=await currentMembership()
  let location=providedLocation
  try{location=location||await getCurrentLocation()}catch{}

  const completionBase=buildCompletionPatch(location)
  const completion=options?.driverNote===undefined?completionBase:{...completionBase,driver_note:options.driverNote}
  // A route can remain published while its arrival is being confirmed (for
  // example after a refresh or a recovered mobile request). Once arrived, it
  // is still safe to complete it; the persisted status is the authority.
  const update=async(payload:typeof completionBase|typeof completion)=>getSupabase().from('routes').update(payload).eq('id',id).eq('driver_id',user.id).eq('company_id',membership.company_id).in('status',['pending','published','active','paused']).select().maybeSingle()
  const readCurrentState=()=>getSupabase().from('routes').select().eq('id',id).eq('driver_id',user.id).eq('company_id',membership.company_id).maybeSingle()
  const reportTechnicalReconciliation=async(error:unknown)=>{
    try{
      const message=error instanceof Error?error.message:String(error||'Completion response could not be confirmed')
      await getSupabase().from('app_error_reports').insert({
        user_id:user.id,
        company_id:membership.company_id,
        branch_id:membership.branch_id??null,
        route_id:id,
        action:'completion_reconciled',
        error_message:message.slice(0,500),
        context:{source:'driver_completion',reconciled:true}
      })
    }catch{}
  }

  let result=await update(completion)
  // Database workflow triggers require an execution state before completion.
  // A recovered return may have arrived_at set while still published; promote
  // that same stop to active, then retry the authoritative completion.
  if (result.error || !result.data) {
    const state = await readCurrentState()
    if (!state.error && state.data?.arrived_at && ['pending', 'published'].includes(String(state.data.status))) {
      const promoted = await getSupabase().from('routes').update({status:'active', updated_version:Date.now()}).eq('id',id).eq('driver_id',user.id).eq('company_id',membership.company_id).in('status',['pending','published']).select().maybeSingle()
      if (!promoted.error && promoted.data) result = await update(completion)
    }
  }
  // Recipient details are optional proof. Older beta schemas may not yet have
  // driver_note, so that optional field must never block completing the stop.
  // This also supports existing RLS policies that allow completion but do not
  // yet permit that optional beta field.
  const firstError=result.error
  if(result.error&&options?.driverNote!==undefined){
    result=await update(completionBase)
  }
  if(result.error||!result.data){
    // A mobile request can reach Supabase and lose its response. Confirm the
    // authoritative state before treating it as a failed delivery, so a driver
    // is never trapped on a stop that was already completed.
    const currentState=await readCurrentState()
    if(!currentState.error&&currentState.data?.status==='completed'){
      if(firstError)void reportTechnicalReconciliation(firstError)
      return currentState.data
    }
    if(result.error)throw result.error
    if(currentState.error)throw currentState.error
    throw new Error('We could not confirm this stop. It remains pending.')
  }

  try{await recordActivity({companyId:membership.company_id,userId:user.id,action:'delivery_completed',recordId:id,after:{method:completionBase.completion_method,location:location||null,recipient_name:options?.driverNote?.replace(/^Received by:\\s*/i,'')||null}})}catch{}
  return result.data
}
export type TeamRole=Role
