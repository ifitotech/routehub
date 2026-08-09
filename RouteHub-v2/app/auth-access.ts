import type {SupabaseClient, User} from '@supabase/supabase-js'
import type {Role} from '../lib/types'

export type ResolvedAccess = {user: User; role: Role; isCeo: boolean}

const knownRoles: Role[] = ['ceo', 'branch_manager', 'operations_manager', 'sales_representative', 'counter_sales', 'driver']

export async function resolveAccess(client: SupabaseClient): Promise<ResolvedAccess> {
  const {data: userData, error: userError} = await client.auth.getUser()
  if (userError || !userData.user) throw new Error('AUTH_REQUIRED')
  const user = userData.user
  const [{data: admin}, {data: memberships, error: membershipError}] = await Promise.all([
    client.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle(),
    client.from('company_users').select('role').eq('user_id', user.id),
  ])
  if (admin) return {user, role: 'ceo', isCeo: true}
  if (membershipError) throw new Error('ROLE_LOOKUP_FAILED')
  const roles = Array.from(new Set((memberships || []).map(row => row.role as Role).filter(role => knownRoles.includes(role))))
  if (roles.length === 0) throw new Error('ROLE_NOT_ASSIGNED')
  if (roles.length > 1) throw new Error('MULTIPLE_ROLES')
  return {user, role: roles[0], isCeo: false}
}

export function workspaceForStrictRole(role: Role) {
  switch (role) {
    case 'ceo': return '/admin'
    case 'driver': return '/driver'
    case 'branch_manager': return '/manager'
    case 'operations_manager': return '/operations'
    case 'sales_representative': return '/sales'
    case 'counter_sales': return '/counter'
  }
}

function hasSharedAccess(role: Role, pathname: string) {
  if (pathname.startsWith('/settings')) return true
  if (pathname.startsWith('/contacts') || pathname.startsWith('/requests')) return ['branch_manager', 'operations_manager', 'sales_representative', 'counter_sales'].includes(role)
  if (pathname.startsWith('/routes') || pathname.startsWith('/reports')) return ['branch_manager', 'operations_manager', 'sales_representative'].includes(role)
  return false
}

export function canOpenPath(role: Role, pathname: string) {
  if (pathname === '/') return true
  if (role === 'ceo') return pathname.startsWith('/admin') || pathname.startsWith('/settings')
  if (role === 'driver') return pathname.startsWith('/driver')
  if (role === 'branch_manager' && pathname.startsWith('/manager')) return true
  if (role === 'operations_manager' && pathname.startsWith('/operations')) return true
  if (role === 'sales_representative' && pathname.startsWith('/sales')) return true
  if (role === 'counter_sales' && pathname.startsWith('/counter')) return true
  return hasSharedAccess(role, pathname)
}
