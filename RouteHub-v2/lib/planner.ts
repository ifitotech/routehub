import type {MissionStatus} from './types'
export type Mission={id:string;type:'pickup'|'delivery'|'transfer'|'return';status:MissionStatus;origin:string;destination:string;priority:'normal'|'priority'|'urgent';position:number}
export function reorder(missions:Mission[],from:number,to:number):Mission[]{if(from<0||to<0||from>=missions.length||to>=missions.length||!canMove(missions[from].status))return missions;const next=[...missions];const [item]=next.splice(from,1);next.splice(to,0,item);return relinkOrigins(next)}
export function canMove(status:MissionStatus){return !['completed','cancelled'].includes(status)}
export function insertUrgent(missions:Mission[],mission:Mission):Mission[]{const first=Math.max(0,missions.findIndex(m=>canMove(m.status)));return [...missions.slice(0,first),{...mission,priority:'urgent' as const,position:first+1},...missions.slice(first)].map((m,i)=>({...m,position:i+1}))}
export function relinkOrigins(missions:Mission[]){return missions.map((m,i)=>({...m,position:i+1,origin:i?missions[i-1].destination:m.origin}))}
