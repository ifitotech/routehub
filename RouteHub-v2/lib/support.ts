import {currentMembership, currentUser} from './data'
import {getSupabase} from './supabase'

export async function submitSupportRequest(message: string) {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('Write a message first.')
  const user = await currentUser()
  let companyId: string | null = null
  try { companyId = (await currentMembership()).company_id } catch {}
  const {error} = await getSupabase().from('support_requests').insert({user_id: user.id, company_id: companyId, message: trimmed.slice(0, 2000)})
  if (error) throw error
}
