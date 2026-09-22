import {currentMembership, currentUser} from './data'
import {getSupabase} from './supabase'

export async function submitSupportRequest(message: string) {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('Write a message first.')
  const user = await currentUser()
  let companyId: string | null = null
  try { companyId = (await currentMembership()).company_id } catch {}
  // Some deployed environments use the expanded support schema where these
  // fields are required (created_by/category/subject). Keep both user_id and
  // created_by populated so the request is visible to the admin queue and
  // remains attributable to the signed-in driver.
  const {error} = await getSupabase().from('support_requests').insert({
    user_id: user.id,
    created_by: user.id,
    company_id: companyId,
    category: 'general',
    subject: 'Driver support request',
    message: trimmed.slice(0, 2000),
  })
  if (error) throw error
}
