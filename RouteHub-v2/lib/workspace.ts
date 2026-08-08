import type {Role} from './types'
export function workspaceForRole(role:Role){switch(role){case'ceo':return'/admin';case'driver':return'/driver';case'counter_sales':return'/counter';case'operations_manager':return'/operations';case'sales_representative':return'/sales';default:return'/manager'}}
