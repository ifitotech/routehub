import {NextRequest,NextResponse} from 'next/server'
import {geocodingConfig,isInFlorida,mapProviderLimits,withFloridaQuery} from '../../../lib/maps/map-config'

type GoogleResult={formatted_address?:string;geometry?:{location?:{lat?:number;lng?:number}}}

const response=(lat:number,lng:number,label:string)=>NextResponse.json({coordinate:{lat,lng},label,source:'google'})

function tooFar(lat:number,lng:number,nearLat:number,nearLng:number){
 const radians=Math.PI/180
 const dLat=(lat-nearLat)*radians,dLng=(lng-nearLng)*radians
 const value=Math.sin(dLat/2)**2+Math.cos(nearLat*radians)*Math.cos(lat*radians)*Math.sin(dLng/2)**2
 return 2*6371*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))>220
}

export async function GET(request:NextRequest){
 const address=withFloridaQuery(request.nextUrl.searchParams.get('address')?.trim()||'')
 const nearLat=Number(request.nextUrl.searchParams.get('nearLat'))
 const nearLng=Number(request.nextUrl.searchParams.get('nearLng'))
 const hasNear=Number.isFinite(nearLat)&&Number.isFinite(nearLng)
 if(address.length<mapProviderLimits.minimumSearchCharacters||address.length>mapProviderLimits.maximumSearchCharacters)return NextResponse.json({coordinate:null},{status:400})
 if(!geocodingConfig.googleKey)return NextResponse.json({coordinate:null})
 try{
  const url=new URL(geocodingConfig.googleGeocodeEndpoint)
  url.searchParams.set('address',address)
  url.searchParams.set('components','country:US|administrative_area:FL')
  url.searchParams.set('region','us')
  url.searchParams.set('key',geocodingConfig.googleKey)
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(geocodingConfig.requestTimeoutMs)})
  if(result.ok){
   const payload=await result.json() as {status?:string;results?:GoogleResult[]}
   const match=payload.results?.[0]
   const lat=Number(match?.geometry?.location?.lat)
   const lng=Number(match?.geometry?.location?.lng)
   if(payload.status==='OK'&&Number.isFinite(lat)&&Number.isFinite(lng)&&isInFlorida(lat,lng)&&!(hasNear&&tooFar(lat,lng,nearLat,nearLng)))return response(lat,lng,match?.formatted_address||address)
  }
 }catch{}
 return NextResponse.json({coordinate:null})
}
