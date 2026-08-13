export type Coordinates={lat:number;lng:number;accuracy:number}
export type LocationPermission='granted'|'denied'|'prompt'|'unsupported'

/** Reads the browser permission without opening another prompt. */
export async function getLocationPermission():Promise<LocationPermission>{
  if(typeof navigator==='undefined'||!navigator.geolocation)return 'unsupported'
  if(!navigator.permissions?.query)return 'prompt'
  try{return (await navigator.permissions.query({name:'geolocation' as PermissionName})).state}catch{return 'prompt'}
}

export function getCurrentLocation(options:{maximumAge?:number}={}):Promise<Coordinates>{return new Promise((resolve,reject)=>{if(typeof navigator==='undefined'||!navigator.geolocation)return reject(new Error('Location is not available.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),e=>reject(new Error(e.code===1?'Location permission was denied.':'Unable to get your location.')),{enableHighAccuracy:true,timeout:12000,maximumAge:options.maximumAge??10000})})}
export function distanceMeters(a:{lat:number;lng:number},b:{lat:number;lng:number}){const radius=6371000,toRad=(n:number)=>n*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;return 2*radius*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
export function withinRadius(distance:number,radius=300){return distance<=radius}
export function completionWarning(distance:number,radius=300){return distance<=radius?null:`Completed ${Math.round(distance)} m from destination.`}
