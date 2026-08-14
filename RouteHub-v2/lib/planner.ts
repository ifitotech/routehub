import type {MissionStatus} from './types'
export type Mission={id:string;type:'pickup'|'delivery'|'transfer'|'return';status:MissionStatus;origin:string;destination:string;priority:'normal'|'priority'|'urgent';position:number}
export function reorder(missions:Mission[],from:number,to:number):Mission[]{
  if(from<0||to<0||from>=missions.length||to>=missions.length||from===to)return missions
  if(!canMove(missions[from].status)||!canMove(missions[to].status))return missions
  const start=Math.min(from,to),end=Math.max(from,to)
  if(missions.slice(start,end+1).some(m=>!canMove(m.status)))return missions
  const next=[...missions]
  const [item]=next.splice(from,1)
  next.splice(to,0,item)
  return relinkOrigins(next)
}
/**
 * Only work that has not started may change its place in the queue.  Keeping
 * active, completed, issue and cancelled work locked prevents a dispatch edit
 * from changing the driver\'s current assignment or historical evidence.
 */
export function canMove(status:MissionStatus){return ['draft','pending','published','paused'].includes(status)}
export function insertUrgent(missions:Mission[],mission:Mission):Mission[]{
  const movableIndex=missions.findIndex(m=>canMove(m.status))
  const first=movableIndex===-1?missions.length:movableIndex
  return relinkOrigins([...missions.slice(0,first),{...mission,priority:'urgent' as const,position:first+1},...missions.slice(first)])
}
export function relinkOrigins(missions:Mission[]){
  // Keep every locked mission exactly as it was.  Its position and origin are
  // historical facts.  Reorder only reuses the open queue positions, so no
  // completed route is silently renumbered.
  const openPositions=missions.filter(m=>canMove(m.status)).map(m=>m.position).sort((a,b)=>a-b)
  let openIndex=0
  let previousDestination=''
  return missions.map((mission,index)=>{
    if(!canMove(mission.status)){
      previousDestination=mission.destination||previousDestination
      return mission
    }
    const position=openPositions[openIndex++] ?? mission.position
    // Preserve the first open mission\'s configured origin.  Later open
    // missions follow the immediately preceding route when it has a known
    // destination, which is the safe automatic relink for the current schema.
    const origin=index>0 && previousDestination ? previousDestination : mission.origin
    previousDestination=mission.destination||previousDestination
    return {...mission,position,origin}
  })
}
export function findCurrent(missions:Mission[]){return missions.find(m=>m.status==='active')||missions.find(m=>['published','pending','paused'].includes(m.status))}
export function upcomingMissions(missions:Mission[]){const current=findCurrent(missions);return missions.filter(m=>m.id!==current?.id&&['published','pending','paused'].includes(m.status)).sort((a,b)=>a.position-b.position)}
/**
 * Moves only work that has not started between two driver queues.  This is a
 * pure mirror of the database operation so UI tests can prove that changing
 * one driver's queue never leaves gaps in the other driver's queue.
 */
export function reassignUpcoming(source:Mission[],target:Mission[],missionId:string){
  const mission=source.find(item=>item.id===missionId)
  if(!mission||!canMove(mission.status))return {source,target}
  // The two arguments are movable queues, so each one can be normalized from
  // one without touching any active or historical route outside the queue.
  const normalize=(queue:Mission[])=>relinkOrigins(queue.map((item,index)=>({...item,position:index+1})))
  const nextSource=source.filter(item=>item.id!==missionId)
  const nextTarget=[...target,{...mission,position:target.length+1}]
  return {source:normalize(nextSource),target:normalize(nextTarget)}
}
export function interruptActive(missions:Mission[],urgentMission:Mission):Mission[]{
  const paused=missions.map(m=>m.status==='active'?{...m,status:'paused' as const}:m)
  return insertUrgent(paused,{...urgentMission,status:'active',priority:'urgent'})
}
