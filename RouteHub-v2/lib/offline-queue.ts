export type PendingAction={id:string;kind:'complete'|'issue';payload:Record<string,unknown>;createdAt:string}
const KEY='routehub-v2-offline-queue'
export function readQueue():PendingAction[]{if(typeof window==='undefined')return[];try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function enqueue(action:Omit<PendingAction,'id'|'createdAt'>){if(typeof window==='undefined')return;const next={...action,id:crypto.randomUUID(),createdAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify([...readQueue(),next]))}
export function removeQueued(id:string){if(typeof window==='undefined')return;localStorage.setItem(KEY,JSON.stringify(readQueue().filter(x=>x.id!==id)))}
export async function syncQueue(handler:(action:PendingAction)=>Promise<void>){for(const action of readQueue()){try{await handler(action);removeQueued(action.id)}catch{return}}}
