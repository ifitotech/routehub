import {mapProviderLimits} from './map-config'
import type {GeocodedLocation,MapCoordinate} from './types'

type LocationPayload={coordinate?:MapCoordinate|null;label?:string;source?:GeocodedLocation['source'];externalId?:string;name?:string}

export function normalizeLocationPayload(payload:LocationPayload,address:string):GeocodedLocation|null{
  const coordinate=payload.coordinate
  if(!coordinate||!Number.isFinite(coordinate.lat)||!Number.isFinite(coordinate.lng))return null
  return {
    name:payload.name?.trim()||undefined,
    formattedAddress:payload.label?.trim()||address.trim(),
    coordinate,
    source:payload.source||'manual',
    externalId:payload.externalId
  }
}

export function isSearchQueryValid(query:string){
  const normalized=query.trim()
  return normalized.length>=mapProviderLimits.minimumSearchCharacters&&normalized.length<=mapProviderLimits.maximumSearchCharacters
}

export async function geocodeAddress(address:string,signal?:AbortSignal,near?:MapCoordinate|null):Promise<GeocodedLocation|null>{
  if(!isSearchQueryValid(address))return null
  try{
    const params=new URLSearchParams({address})
    if(near&&Number.isFinite(near.lat)&&Number.isFinite(near.lng)){
      params.set('nearLat',String(near.lat))
      params.set('nearLng',String(near.lng))
    }
    const response=await fetch(`/api/geocode?${params.toString()}`,{signal})
    if(!response.ok)return null
    return normalizeLocationPayload(await response.json() as LocationPayload,address)
  }catch{return null}
}
