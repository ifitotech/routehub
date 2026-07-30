export type OfflineAction={id:string;kind:string;payload:Record<string,unknown>;createdAt:string}
const KEY='routehub.pending-actions'
export function queueAction(action:Omit<OfflineAction,'id'|'createdAt'>){const next:OfflineAction={...action,id:crypto.randomUUID(),createdAt:new Date().toISOString()};const all=readQueue();localStorage.setItem(KEY,JSON.stringify([...all,next]));return next}
export function readQueue():OfflineAction[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function removeAction(id:string){localStorage.setItem(KEY,JSON.stringify(readQueue().filter(a=>a.id!==id)))}
export async function flushQueue(handler:(action:OfflineAction)=>Promise<boolean>){for(const action of readQueue()){try{if(await handler(action))removeAction(action.id)}catch{break}}}
