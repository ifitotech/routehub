import type {MapCoordinate} from './types'

export type OperationsSequenceRoute={
  id:string
  position?:number|null
  status?:string|null
  origin:MapCoordinate|null
  destination:MapCoordinate|null
}

export function isRemainingOperationsRoute(status?:string|null){
  return status!=='completed'&&status!=='cancelled'&&status!=='issue'
}

export function isDrawableOperationsRoute(status?:string|null){
  return status!=='cancelled'
}

function samePoint(left:MapCoordinate|null|undefined,right:MapCoordinate|null|undefined){
  return Boolean(left&&right&&left.lat===right.lat&&left.lng===right.lng)
}

/** Builds the complete assignment from its stored start through its last stop. */
export function buildOperationsSequence<T extends OperationsSequenceRoute>(groupRoutes:T[],driverStart:MapCoordinate|null=null){
  const ordered=groupRoutes.slice().sort((a,b)=>Number(a.position||Number.MAX_SAFE_INTEGER)-Number(b.position||Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))
  const remaining=ordered.filter(route=>isRemainingOperationsRoute(route.status)&&route.destination)
  const assigned=ordered.filter(route=>isDrawableOperationsRoute(route.status)&&route.destination)
  const first=assigned[0]
  const storedStart=assigned.find(route=>route.origin)?.origin||null
  const start=storedStart&&(!first?.destination||!samePoint(storedStart,first.destination))
    ?storedStart
    :driverStart&&!samePoint(driverStart,first?.destination)
      ?driverStart
      :storedStart||first?.destination||null
  const points:MapCoordinate[]=start?[start]:[]
  for(const route of assigned){
    if(route.destination&&!samePoint(points[points.length-1],route.destination))points.push(route.destination)
  }
  return {ordered,assigned,remaining,start,points}
}
