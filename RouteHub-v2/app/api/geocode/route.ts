import {NextRequest,NextResponse} from 'next/server'
import {floridaBounds,geocodingConfig,isInFlorida,mapProviderLimits,withFloridaQuery} from '../../../lib/maps/map-config'

type CensusMatch={matchedAddress?:string;coordinates?:{x?:number;y?:number}}
type NominatimMatch={display_name?:string;lat?:string;lon?:string}
type GoogleResult={formatted_address?:string;geometry?:{location?:{lat?:number;lng?:number}}}

const response=(lat:number,lng:number,label:string,source:'google'|'census'|'nominatim')=>NextResponse.json({coordinate:{lat,lng},label,source})

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
 if(geocodingConfig.googleKey){
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
    if(payload.status==='OK'&&Number.isFinite(lat)&&Number.isFinite(lng)&&isInFlorida(lat,lng)&&!(hasNear&&tooFar(lat,lng,nearLat,nearLng))){
     return response(lat,lng,match?.formatted_address||address,'google')
    }
   }
  }catch{}
 }
 try{
  const url=new URL(geocodingConfig.censusEndpoint)
  url.searchParams.set('address',address)
  url.searchParams.set('benchmark','Public_AR_Current')
  url.searchParams.set('format','json')
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(geocodingConfig.requestTimeoutMs)})
  if(result.ok){
   const payload=await result.json() as {result?:{addressMatches?:CensusMatch[]}}
   const match=payload.result?.addressMatches?.[0]
   const lat=Number(match?.coordinates?.y),lng=Number(match?.coordinates?.x)
   if(Number.isFinite(lat)&&Number.isFinite(lng)&&isInFlorida(lat,lng)&&!(hasNear&&tooFar(lat,lng,nearLat,nearLng)))return response(lat,lng,match?.matchedAddress||address,'census')
  }
 }catch{}
 try{
  const url=new URL(geocodingConfig.nominatimEndpoint)
  url.searchParams.set('format','jsonv2')
  url.searchParams.set('limit','1')
  url.searchParams.set('q',address)
  url.searchParams.set('countrycodes','us')
  url.searchParams.set('viewbox',`${floridaBounds.west},${floridaBounds.north},${floridaBounds.east},${floridaBounds.south}`)
  url.searchParams.set('bounded','1')
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(geocodingConfig.requestTimeoutMs),headers:{Accept:'application/json','User-Agent':geocodingConfig.userAgent}})
  if(!result.ok)return NextResponse.json({coordinate:null})
  const match=(await result.json() as NominatimMatch[])[0]
  const lat=Number(match?.lat),lng=Number(match?.lon)
  if(Number.isFinite(lat)&&Number.isFinite(lng)&&isInFlorida(lat,lng)&&!(hasNear&&tooFar(lat,lng,nearLat,nearLng)))return response(lat,lng,match?.display_name||address,'nominatim')
 }catch{}
 return NextResponse.json({coordinate:null})
}
