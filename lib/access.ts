export type Role = 'branch_manager'|'operations_manager'|'sales_representative'|'counter_sales'|'driver'

export const canManageUsers = (role: Role) => role === 'branch_manager'
export const canManageRoutes = (role: Role) => ['branch_manager','operations_manager','sales_representative'].includes(role)
export const canCreateRequests = (role: Role) => ['branch_manager','operations_manager','sales_representative','counter_sales'].includes(role)
export const canExecuteStops = (role: Role) => role === 'driver'

/** Never use client-provided role values for authorization; enforce the same rules in Supabase RLS. */
