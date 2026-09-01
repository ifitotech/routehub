export type MapPoint={lat:number;lng:number}

const toNumber=(value:unknown)=>{
  if(typeof value==='number')return value
  if(typeof value==='string'&&value.trim())return Number(value)
  return Number.NaN
}

export function sanitizeCoordinate(raw:{lat?:unknown;lng?:unknown}|null|undefined):MapPoint|null{
  if(!raw)return null
  let lat=toNumber(raw.lat)
  let lng=toNumber(raw.lng)
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null
  if(Math.abs(lat)>90&&Math.abs(lng)<=90){
    const swapped=lat
    lat=lng
    lng=swapped
  }
  // Longitude stored in the latitude field (common with FL / US points).
  if(Math.abs(lat)>50&&Math.abs(lng)<=50&&Math.abs(lat)<=180){
    const swapped=lat
    lat=lng
    lng=swapped
  }
  if(Math.abs(lat)>90||Math.abs(lng)>180)return null
  if(lat===0&&lng===0)return null
  return {lat,lng}
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
