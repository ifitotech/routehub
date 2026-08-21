import {NextRequest,NextResponse} from 'next/server'

type CensusMatch={matchedAddress?:string;coordinates?:{x?:number;y?:number}}
type NominatimMatch={display_name?:string;lat?:string;lon?:string}

const response=(lat:number,lng:number,label:string)=>NextResponse.json({coordinate:{lat,lng},label})

export async function GET(request:NextRequest){
 const address=request.nextUrl.searchParams.get('address')?.trim()||''
 if(address.length<3||address.length>180)return NextResponse.json({coordinate:null},{status:400})
 try{
  const url=new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress')
  url.searchParams.set('address',address)
  url.searchParams.set('benchmark','Public_AR_Current')
  url.searchParams.set('format','json')
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000)})
  if(result.ok){
   const payload=await result.json() as {result?:{addressMatches?:CensusMatch[]}}
   const match=payload.result?.addressMatches?.[0]
   const lat=Number(match?.coordinates?.y),lng=Number(match?.coordinates?.x)
   if(Number.isFinite(lat)&&Number.isFinite(lng))return response(lat,lng,match?.matchedAddress||address)
  }
 }catch{}
 try{
  const url=new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format','jsonv2')
  url.searchParams.set('limit','1')
  url.searchParams.set('q',address)
  const result=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json','User-Agent':'RouteHub route map'}})
  if(!result.ok)return NextResponse.json({coordinate:null})
  const match=(await result.json() as NominatimMatch[])[0]
  const lat=Number(match?.lat),lng=Number(match?.lon)
  if(Number.isFinite(lat)&&Number.isFinite(lng))return response(lat,lng,match?.display_name||address)
 }catch{}
 return NextResponse.json({coordinate:null})
}
