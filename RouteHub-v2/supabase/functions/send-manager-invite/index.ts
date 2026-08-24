import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (request) => {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({error: 'Unauthorized'}), {status: 401})
    const {email, companyName, branchName} = await request.json()
    if (!email || !companyName || !branchName) return new Response(JSON.stringify({error: 'Missing invite details'}), {status: 400})
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {global: {headers: {Authorization: authHeader}}})
    const {data: userData} = await anon.auth.getUser()
    if (!userData.user) return new Response(JSON.stringify({error: 'Unauthorized'}), {status: 401})
    const {data: admin} = await anon.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
    if (!admin) return new Response(JSON.stringify({error: 'CEO access required'}), {status: 403})
    const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const {data, error} = await supabase.auth.admin.inviteUserByEmail(email, {data: {company_name: companyName, branch_name: branchName, invited_role: 'branch_manager'}})
    if (error) throw error
    return new Response(JSON.stringify({user_id: data.user?.id}), {headers: {'content-type': 'application/json'}})
  } catch (error) {
    return new Response(JSON.stringify({error: error instanceof Error ? error.message : 'Unable to send invitation'}), {status: 500, headers: {'content-type': 'application/json'}})
  }
})
