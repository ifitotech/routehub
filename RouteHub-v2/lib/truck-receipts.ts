import {getSupabase} from './supabase'

export async function uploadTruckReceipt(file: File, input: {companyId: string; branchId: string; truckId: string; recordId: string}) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `truck-receipts/${input.companyId}/${input.branchId}/${input.truckId}/${input.recordId}.${extension}`
  const storage = getSupabase().storage.from('route-evidence')
  const result = await storage.upload(path, file, {contentType: file.type || 'image/jpeg', upsert: false})
  if (result.error) throw result.error
  return path
}

export async function signedTruckReceipt(path: string) {
  const result = await getSupabase().storage.from('route-evidence').createSignedUrl(path, 60 * 20)
  if (result.error) throw result.error
  return result.data.signedUrl
}
