export type MapPoint={lat:number;lng:number}

const toNumber=(value:unknown)=>{
  if(typeof value==='number')return value
  if(typeof value==='string'&&value.trim())return Number(value)
  return Number.NaN
}

export function sanitizeCoordinate(raw:{lat?:unknown;lng?:unknown}|null|undefined):MapPoint|null{
 if(!raw)return null
 const lat=toNumber(raw.lat)
 const lng=toNumber(raw.lng)
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return null

 const valid=(point:MapPoint)=>Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180&&(point.lat!==0||point.lng!==0)
 const direct={lat,lng}
 const swapped={lat:lng,lng:lat}
 const directValid=valid(direct)
 const swappedValid=valid(swapped)

 // An out-of-range latitude is always an invalid Google Maps point. When its
 // inverse is valid, accept the inverse rather than allowing the map to fit a
 // continent-spanning route.
 if(!directValid)return swappedValid?swapped:null

 // Both orders can be formally valid (for example -80.19, 25.76). Only swap
 // that ambiguous form when the inverse is in Florida and the direct value is
 // not. This corrects legacy Miami branch records without corrupting valid
 // coordinates such as London (51.5, -0.1).
 const inFlorida=(point:MapPoint)=>point.lat>=24&&point.lat<=32&&point.lng>=-88&&point.lng<=-79
 if(swappedValid&&inFlorida(swapped)&&!inFlorida(direct))return swapped
 return direct
}

function distanceKm(from:MapPoint,to:MapPoint){
  const radians=Math.PI/180
  const dLat=(to.lat-from.lat)*radians
  const dLng=(to.lng-from.lng)*radians
  const a=Math.sin(dLat/2)**2+Math.cos(from.lat*radians)*Math.cos(to.lat*radians)*Math.sin(dLng/2)**2
  return 2*6371*Math.asin(Math.min(1,Math.sqrt(a)))
}

export function clusterCoordinates(points:Array<MapPoint|null|undefined>,maxSpreadKm=800):MapPoint[]{
  const valid=points.map(point=>sanitizeCoordinate(point)).filter((point):point is MapPoint=>Boolean(point))
  if(valid.length<=1)return valid
  const anchor=valid.find(point=>point.lat>=18&&point.lat<=50&&point.lng<=-60&&point.lng>=-130)||valid[0]
  const nearby=valid.filter(point=>distanceKm(anchor,point)<=maxSpreadKm)
  const seen=new Set<string>()
  return nearby.filter(point=>{
    const key=`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
    if(seen.has(key))return false
    seen.add(key)
    return true
  })
}
