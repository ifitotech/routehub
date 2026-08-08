export type Role='ceo'|'branch_manager'|'operations_manager'|'sales_representative'|'counter_sales'|'driver'
export type MissionType='pickup'|'delivery'|'transfer'|'return'
export type MissionStatus='pending'|'active'|'paused'|'completed'|'issue'|'cancelled'
export type Priority='normal'|'priority'|'urgent'
export type Access={role:Role;canManageRoutes:boolean;canViewReports:boolean;canDrive:boolean;isCeo:boolean}
export const roleAccess=(role:Role):Access=>({role,isCeo:role==='ceo',canManageRoutes:['ceo','branch_manager','operations_manager','sales_representative'].includes(role),canViewReports:['ceo','branch_manager','operations_manager','sales_representative'].includes(role),canDrive:['ceo','driver'].includes(role)})
