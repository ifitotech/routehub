import type {Role} from './types'
import {can,type Action} from './permissions'
export function requireAction(role:Role,action:Action){if(!can(role,action))throw new Error('You do not have permission for this action.');return true}
export function canOpenWorkspace(role:Role,workspace:'admin'|'manager'|'operations'|'sales'|'counter'|'driver'){if(role==='ceo')return true;if(workspace==='driver')return role==='driver';if(workspace==='admin')return false;if(workspace==='manager')return role==='branch_manager';if(workspace==='operations')return role==='operations_manager';if(workspace==='sales')return role==='sales_representative';return role==='counter_sales'}
