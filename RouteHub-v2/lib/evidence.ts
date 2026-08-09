import {getSupabase} from './supabase'
import {buildEvidencePath} from './evidence-path'
export{buildEvidencePath}from'./evidence-path'
export async function uploadEvidence(file:File,input:{companyId:string;userId:string;missionId:string}){const path=buildEvidencePath(file.name,input);const storage=getSupabase().storage.from('route-evidence');const upload=await storage.upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});if(upload.error)throw upload.error;const signed=await storage.createSignedUrl(path,60*60);if(signed.error)throw signed.error;return{path,url:signed.data.signedUrl}}
