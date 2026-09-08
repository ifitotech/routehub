import type {MapCoordinate} from './types'

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
