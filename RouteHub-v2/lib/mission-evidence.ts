import {getSupabase} from './supabase'
import {uploadEvidence} from './evidence'
export type MissionEvidenceOptions={kind?:'photo'|'signature'|'issue'|'finalization';attachAsCompletionPhoto?:boolean}

/**
 * Store proof against a stop without assuming it is the delivery POD photo.
 * Final route proof and issue photos are therefore additive and cannot
 * overwrite a customer's delivery photo.
 */
export async function uploadMissionEvidence(file:File,missionId:string,options:MissionEvidenceOptions={}){
 const s=getSupabase();const{data:user}=await s.auth.getUser();if(!user.user)throw new Error('Sign in first.');const{data:mission,error}=await s.from('routes').select('company_id,driver_id').eq('id',missionId).single();if(error||!mission)throw new Error('Mission not found.');if(mission.driver_id!==user.user.id)throw new Error('This route is not assigned to you.');const evidence=await uploadEvidence(file,{companyId:mission.company_id,userId:user.user.id,missionId});const{error:insertError}=await s.from('route_evidence_v2').insert({company_id:mission.company_id,mission_id:missionId,user_id:user.user.id,storage_path:evidence.path,kind:options.kind||'photo'});if(insertError)throw insertError;
 if(options.attachAsCompletionPhoto!==false){const{error:updateError}=await s.from('routes').update({completion_photo_path:evidence.path}).eq('id',missionId).eq('driver_id',user.user.id);if(updateError)throw updateError}
 return evidence
}
