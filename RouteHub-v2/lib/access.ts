import type {Role} from './types'

export type CompanyMembership={company_id:string;branch_id:string|null;role:Role}

const rolePriority:Record<Role,number>={
  ceo:0,
  branch_manager:1,
  operations_manager:2,
  sales_representative:3,
  counter_sales:4,
  driver:5,
}

export function selectPrimaryMembership<T extends CompanyMembership>(memberships:T[]|null|undefined):T|undefined{
  if(!memberships?.length)return undefined
  return memberships.reduce((selected,membership)=>rolePriority[membership.role]<rolePriority[selected.role]?membership:selected)
}
