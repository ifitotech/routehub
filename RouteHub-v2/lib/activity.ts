import {getSupabase} from './supabase'
export async function recordActivity(input:{companyId:string;userId:string;action:string;recordId?:string;after?:unknown}){const{error}=await getSupabase().from('activity_logs').insert({company_id:input.companyId,user_id:input.userId,action:input.action,record_id:input.recordId||null,after_value:input.after||null});if(error)throw error}
