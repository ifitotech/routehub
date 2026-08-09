import type {MissionStatus,MissionType,Priority} from './types'

export type MissionInput={
  type:MissionType
  driver_id:string
  origin_address:string
  destination_address:string
  priority:Priority
  status:MissionStatus
  order_number?:string
  notes?:string
  scheduled_at?:string
  contact_id?:string
  origin_name?:string
  destination_name?:string
}

export function buildMissionInsert(input:MissionInput,membership:{company_id:string;branch_id:string|null},position:number,now=new Date()){
  const{type,...fields}=input
  const scheduled=input.scheduled_at||now.toISOString()
  return{
    ...fields,
    company_id:membership.company_id,
    branch_id:membership.branch_id,
    mission_type:type,
    route_date:scheduled.slice(0,10),
    scheduled_at:scheduled,
    mode:'flexible' as const,
    position,
  }
}

export function buildCompletionPatch(location:{lat:number;lng:number;accuracy:number}|undefined,now=new Date()){
  return{
    status:'completed' as const,
    completed_at:now.toISOString(),
    completion_method:location?'gps' as const:'manual' as const,
    ...(location?{completion_lat:location.lat,completion_lng:location.lng,completion_accuracy:location.accuracy}:{}),
  }
}
