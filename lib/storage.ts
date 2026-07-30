import {getSupabase} from './supabase'
export async function uploadEvidence(file:File,path:string){const s=getSupabase();const{data,error}=await s.storage.from('routehub-evidence').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;return s.storage.from('routehub-evidence').getPublicUrl(data.path).data.publicUrl}
