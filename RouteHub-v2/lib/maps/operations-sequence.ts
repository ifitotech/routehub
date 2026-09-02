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

function samePoint(left:MapCoordinate|null|undefined,right:MapCoordinate|null|undefined){
  return Boolean(left&&right&&left.lat===right.lat&&left.lng===right.lng)
}

/** Builds the remaining route in its authoritative queue order. */
export function buildOperationsSequence<T extends OperationsSequenceRoute>(groupRoutes:T[],driverStart:MapCoordinate|null=null){
  const ordered=groupRoutes.slice().sort((a,b)=>Number(a.position||Number.MAX_SAFE_INTEGER)-Number(b.position||Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id))
  const remaining=ordered.filter(route=>isRemainingOperationsRoute(route.status)&&route.destination)
  const activeRoute=remaining.find(route=>route.status==='active'||route.status==='paused')
  let previousDestination:MapCoordinate|null=null
  const points:MapCoordinate[]=[]
  let start:MapCoordinate|null=null

  for(const route of ordered){
    if(!isRemainingOperationsRoute(route.status)||!route.destination){
      if(route.destination)previousDestination=route.destination
      continue
    }
    const isFirstRemaining=points.length===0
    const storedStartIsDestination=samePoint(route.origin,route.destination)
    const routeStart:MapCoordinate|null=isFirstRemaining
      ?(route===activeRoute&&driverStart
        ?driverStart
        :storedStartIsDestination&&driverStart&&!samePoint(driverStart,route.destination)
          ?driverStart
          :route.origin||driverStart||previousDestination)
      :(previousDestination||route.origin||driverStart)
    if(routeStart&&!samePoint(points[points.length-1],routeStart))points.push(routeStart)
    if(!samePoint(points[points.length-1],route.destination))points.push(route.destination)
    start=start||routeStart||route.destination
    previousDestination=route.destination
  }

  const safeStart=start||remaining[0]?.origin||remaining[0]?.destination||ordered[0]?.origin||ordered[0]?.destination||null
  return {ordered,remaining,start:safeStart,points:points.length?points:(safeStart?[safeStart]:[])}
}
