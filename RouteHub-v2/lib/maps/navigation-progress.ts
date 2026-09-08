import type {MapCoordinate,RouteManeuver} from './types'

export type NavigationProgress={
  coordinate:MapCoordinate
  segmentIndex:number
  distanceFromRoute:number
  traveledMeters:number
  totalMeters:number
  remainingMeters:number
  heading:number
}

/** Project onto road segments, with continuity at crossings/parallel roads.
 * This is visual route matching, not an SDK-grade road/map matcher. */
export function projectNavigationPosition(fix:MapCoordinate,line:MapCoordinate[],previousMeters?:number,maxAdvance=250):NavigationProgress|null{
  if(line.length<2)return null
  const scale=Math.cos(fix.lat*Math.PI/180)
  let total=0
  const candidates:Omit<NavigationProgress,'totalMeters'|'remainingMeters'>[]=[]
  for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i]
    const ax=(a.lng-fix.lng)*scale*111320,ay=(a.lat-fix.lat)*111320
    const dx=(b.lng-a.lng)*scale*111320,dy=(b.lat-a.lat)*111320
    const length=Math.hypot(dx,dy)
    if(length<.01)continue
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(length*length)))
    candidates.push({coordinate:{lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},segmentIndex:i-1,distanceFromRoute:Math.hypot(ax+t*dx,ay+t*dy),traveledMeters:total+t*length,heading:(Math.atan2(dx,dy)*180/Math.PI+360)%360})
    total+=length
  }
  const nearby=previousMeters==null?candidates:candidates.filter(item=>item.traveledMeters>=previousMeters-30&&item.traveledMeters<=previousMeters+maxAdvance)
  // Never jump to another occurrence of an overlapping road merely because its
  // vertex is a few centimetres closer to this noisy GPS sample.
  const pool=nearby.length?nearby:candidates
  const score=(item:typeof candidates[number])=>item.distanceFromRoute+(previousMeters==null?0:Math.abs(item.traveledMeters-previousMeters)*.01)
  const best=pool.reduce<typeof candidates[number]|null>((best,item)=>!best||score(item)<score(best)?item:best,null)
  return best?{...best,totalMeters:total,remainingMeters:Math.max(0,total-best.traveledMeters)}:null
}

export function splitNavigationPath(line:MapCoordinate[],progress:NavigationProgress|null){
  if(!progress)return {traveled:[],pending:line}
  return {traveled:[...line.slice(0,progress.segmentIndex+1),progress.coordinate],pending:[progress.coordinate,...line.slice(progress.segmentIndex+1)]}
}

/** Google's step distance is the length AFTER that step's maneuver. */
export function navigationManeuver(maneuvers:RouteManeuver[]|undefined,progress:NavigationProgress|null,routeDistance?:number){
  if(!maneuvers?.length||!progress)return null
  const stepTotal=maneuvers.reduce((sum,step)=>sum+(step.distanceMeters||0),0)
  const scale=progress.totalMeters/(routeDistance||stepTotal||progress.totalMeters)
  let boundary=0
  for(let index=0;index<maneuvers.length;index++){
    const step=maneuvers[index]
    if((index===0&&progress.traveledMeters<12)||(index>0&&boundary>=progress.traveledMeters-12)){
      return {...step,index,distanceToManeuverMeters:Math.max(0,index===0?(step.distanceMeters||0)*scale-progress.traveledMeters:boundary-progress.traveledMeters)}
    }
    boundary+=(step.distanceMeters||0)*scale
  }
  return null
}

export function navigationRemainingSeconds(duration:number|undefined,progress:NavigationProgress|null){
  if(!progress||!Number.isFinite(duration)||Number(duration)<0||progress.totalMeters<=0)return null
  // Approximate between provider refreshes; never label this as a fresh traffic ETA.
  return Math.max(0,Number(duration)*progress.remainingMeters/progress.totalMeters)
}

export function interpolateHeading(from:number,to:number,fraction:number){
  return (from+(((to-from+540)%360)-180)*fraction+360)%360
}

/** Local segment projection: sparse road geometry must not trigger a reroute. */
export function distanceFromNavigationPath(fix:MapCoordinate,line:MapCoordinate[]):number{
  const scale=Math.cos(fix.lat*Math.PI/180)
  let nearest=Infinity
  for(let i=1;i<line.length;i++){
    const a=line[i-1],b=line[i]
    const ax=(a.lng-fix.lng)*scale*111320,ay=(a.lat-fix.lat)*111320
    const dx=(b.lng-a.lng)*scale*111320,dy=(b.lat-a.lat)*111320
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)))
    nearest=Math.min(nearest,Math.hypot(ax+t*dx,ay+t*dy))
  }
  return nearest
}

export function usableNavigationFix(fix:{accuracy:number;updatedAt:number}|null,now:number){
  return Boolean(fix&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=80&&Number.isFinite(fix.updatedAt)&&now-fix.updatedAt>=-5000&&now-fix.updatedAt<30000)
}
