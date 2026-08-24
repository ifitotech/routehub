import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'content-type': 'application/json'}})
const activationCode = () => {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(100000 + (values[0] % 900000))
}
const hashCode = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', {headers: cors})
  try {
    const authHeader = request.headers.get('Authorization')
    const payload = await request.json()
    const url = Deno.env.get('SUPABASE_URL')!
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    if (payload.action === 'activate') {
      const email = String(payload.email || '').trim().toLowerCase()
      const code = String(payload.code || '').trim()
      const password = String(payload.password || '')
      if (!email || !/^\d{6}$/.test(code) || password.length < 8) return json({error: 'Enter a valid email, six-digit code and password.'}, 400)
      const codeHash = await hashCode(code)
      const {data: invitation, error: invitationError} = await service.from('invitations').select('id,company_id,branch_id,role,email,status,activation_code_hash,activation_code_expires_at,activation_code_used_at').eq('email', email).eq('status', 'pending').eq('activation_code_hash', codeHash).is('activation_code_used_at', null).gt('activation_code_expires_at', new Date().toISOString()).order('created_at', {ascending: false}).limit(1).maybeSingle()
      if (invitationError) throw invitationError
      if (!invitation) return json({error: 'This activation code is invalid or expired.'}, 400)
      const {data: users, error: usersError} = await service.auth.admin.listUsers({page: 1, perPage: 1000})
      if (usersError) throw usersError
      let account = users.users.find(user => user.email?.toLowerCase() === email)
      if (account) {
        const {data, error} = await service.auth.admin.updateUserById(account.id, {password, email_confirm: true})
        if (error) throw error
        account = data.user
      } else {
        const {data, error} = await service.auth.admin.createUser({email, password, email_confirm: true})
        if (error) throw error
        account = data.user
      }
      if (!account) throw new Error('Unable to create the account')
      const {error: profileError} = await service.from('users').upsert({id: account.id, email, name: account.user_metadata?.full_name || email}, {onConflict: 'id'})
      if (profileError) throw profileError
      const {error: membershipError} = await service.from('company_users').upsert({company_id: invitation.company_id, branch_id: invitation.branch_id, user_id: account.id, role: invitation.role}, {onConflict: 'company_id,user_id'})
      if (membershipError) throw membershipError
      const {error: acceptError} = await service.from('invitations').update({status: 'accepted', accepted_at: new Date().toISOString(), activation_code_used_at: new Date().toISOString()}).eq('id', invitation.id)
      if (acceptError) throw acceptError
      return json({ok: true})
    }
    if (!authHeader) return json({error: 'Unauthorized'}, 401)
    const {email, companyName, branchName, branchId} = payload
    if (!email || !companyName || !branchName || !branchId) return json({error: 'Missing invite details'}, 400)
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {global: {headers: {Authorization: authHeader}}})
    const {data: userData} = await anon.auth.getUser()
    if (!userData.user) return json({error: 'Unauthorized'}, 401)
    const {data: admin} = await anon.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
    if (!admin) return json({error: 'CEO access required'}, 403)
    const normalizedEmail = String(email).trim().toLowerCase()
    const code = activationCode()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
    const {data: inviteRow, error: inviteError} = await service.from('invitations').select('id').eq('branch_id', branchId).eq('email', normalizedEmail).eq('status', 'pending').order('created_at', {ascending: false}).limit(1).maybeSingle()
    if (inviteError) throw inviteError
    if (!inviteRow) return json({error: 'No pending invitation exists for this branch.'}, 404)
    const {error: codeError} = await service.from('invitations').update({activation_code_hash: await hashCode(code), activation_code_expires_at: expiresAt, activation_code_used_at: null}).eq('id', inviteRow.id)
    if (codeError) throw codeError
    const {data, error} = await service.auth.admin.inviteUserByEmail(normalizedEmail, {redirectTo: 'https://routehub-wisu.vercel.app/activate-invitation', data: {company_name: companyName, branch_name: branchName, invited_role: 'branch_manager'}})
    if (error && !error.message.toLowerCase().includes('already been registered')) throw error
    return json({user_id: data.user?.id, activationCode: code, expiresAt})
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Unable to send invitation'}, 500)
  }
})
