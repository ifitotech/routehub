import {currentMembership, currentUser} from './data'
import {getSupabase} from './supabase'

type ReportInput={action:string;error:unknown;companyId?:string;branchId?:string|null;routeId?:string|null;context?:Record<string,unknown>}
const recent=new Map<string,number>()

export function normalizeAppError(error:unknown){
  const raw=error instanceof Error
    ? error.message
    : error && typeof error==='object'
      ? [
          'message' in error && typeof error.message==='string'?error.message:'',
          'details' in error && typeof error.details==='string'?`details: ${error.details}`:'',
          'hint' in error && typeof error.hint==='string'?`hint: ${error.hint}`:'',
          'code' in error && typeof error.code==='string'?`code: ${error.code}`:''
        ].filter(Boolean).join(' | ') || JSON.stringify(error)
      : String(error||'Unknown error')
  return raw.replace(/(access_token|refresh_token|service_role|apikey|authorization)[=:][^\s,;]+/gi,'$1=[redacted]').slice(0,500)
}

export async function reportAppError(input:ReportInput){
  try{
    const message=normalizeAppError(input.error)
    const key=`${input.action}:${input.routeId||''}:${message}`
    const now=Date.now(); if(now-(recent.get(key)||0)<30000)return
    recent.set(key,now)
    const user=await currentUser(); const membership=await currentMembership()
    await getSupabase().from('app_error_reports').insert({user_id:user.id,company_id:input.companyId||membership.company_id,branch_id:input.branchId??membership.branch_id??null,route_id:input.routeId??null,action:input.action,error_message:message,context:input.context||{}})
  }catch{}
}
