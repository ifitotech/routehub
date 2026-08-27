import {NextRequest,NextResponse} from 'next/server'
import {geocodingConfig,mapProviderLimits} from '../../../lib/maps/map-config'

type CensusMatch={matchedAddress?:string;coordinates?:{x?:number;y?:number}}
type NominatimMatch={display_name?:string;lat?:string;lon?:string}

const response=(lat:number,lng:number,label:string,source:'census'|'nominatim')=>NextResponse.json({coordinate:{lat,lng},label,source})

export async function GET(request:NextRequest){
 const address=request.nextUrl.searchParams.get('address')?.trim()||''
 if(address.length<mapProviderLimits.minimumSearchCharacters||address.length>mapProviderLimits.maximumSearchCharacters)return NextResponse.json({coordinate:null},{status:400})
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
   if(Number.isFinite(lat)&&Number.isFinite(lng))return response(lat,lng,match?.matchedAddress||address,'census')
  }
 }catch{}
 try{
  const url=new URL(geocodingConfig.nominatimEndpoint)
  url.searchParams.set('format','jsonv2')
  url.searchParams.set('limit','1')
  url.searchParams.set('q',address)
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(geocodingConfig.requestTimeoutMs),headers:{Accept:'application/json','User-Agent':geocodingConfig.userAgent}})
  if(!result.ok)return NextResponse.json({coordinate:null})
  const match=(await result.json() as NominatimMatch[])[0]
  const lat=Number(match?.lat),lng=Number(match?.lon)
  if(Number.isFinite(lat)&&Number.isFinite(lng))return response(lat,lng,match?.display_name||address,'nominatim')
 }catch{}
 return NextResponse.json({coordinate:null})
}
