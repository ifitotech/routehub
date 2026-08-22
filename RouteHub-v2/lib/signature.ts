import {uploadEvidence} from './evidence'
import {getSupabase} from './supabase'

export async function saveCustomerSignature(canvas:HTMLCanvasElement,input:{companyId:string;userId:string;missionId:string}){
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'))
  if(!blob)throw new Error('Unable to create signature image.')
  const evidence=await uploadEvidence(new File([blob],`signature-${input.missionId}.png`,{type:'image/png'}),input)
  const {error}=await getSupabase().from('route_evidence_v2').insert({company_id:input.companyId,mission_id:input.missionId,user_id:input.userId,storage_path:evidence.path,kind:'signature'})
  if(error)throw error
  const {error:updateError}=await getSupabase().from('routes').update({customer_signature_path:evidence.path}).eq('id',input.missionId).eq('driver_id',input.userId)
  if(updateError)throw updateError
  return evidence
}
