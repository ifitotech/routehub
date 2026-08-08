import type {Role} from './types'
export type Action='create_route'|'manage_routes'|'create_request'|'manage_team'|'manage_companies'|'drive_mission'|'view_reports'|'view_contacts'
const rules:Record<Action,Role[]>={create_route:['ceo','branch_manager','operations_manager','sales_representative'],manage_routes:['ceo','branch_manager','operations_manager','sales_representative'],create_request:['ceo','branch_manager','operations_manager','sales_representative','counter_sales'],manage_team:['ceo','branch_manager'],manage_companies:['ceo'],drive_mission:['ceo','driver'],view_reports:['ceo','branch_manager','operations_manager','sales_representative'],view_contacts:['ceo','branch_manager','operations_manager','sales_representative','counter_sales']}
export function can(role:Role,action:Action){return rules[action].includes(role)}
export function actionsFor(role:Role){return (Object.keys(rules) as Action[]).filter(action=>can(role,action))}
