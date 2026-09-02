import type {NavigationDestination} from './types'

function destinationValue(destination:NavigationDestination){
  if(destination.coordinate)return `${destination.coordinate.lat},${destination.coordinate.lng}`
  return destination.address?.trim()||''
}

function isIos(platform:string){
  return /iphone|ipad|ipod/.test(platform)
}

function isAndroid(platform:string){
  return /android/.test(platform)
}

export function googleMapsNavigationUrl(destination:NavigationDestination):string|null{
  const value=destinationValue(destination)
  if(!value)return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(value)}&travelmode=driving`
}

export function appleMapsNavigationUrl(destination:NavigationDestination):string|null{
  const value=destinationValue(destination)
  if(!value)return null
  const params=new URLSearchParams({daddr:value,dirflg:'d'})
  if(destination.label?.trim())params.set('q',destination.label.trim())
  // Use the native scheme so iOS opens Maps directly instead of an in-app
  // Safari tab. The HTTPS URL remains the fallback for unsupported clients.
  return `maps://?${params.toString()}`
}

export function androidNavigationUrls(destination:NavigationDestination):string[]{
  const value=destinationValue(destination)
  if(!value)return []
  return [
    `google.navigation:q=${encodeURIComponent(value)}`,
    `geo:0,0?q=${encodeURIComponent(value)}`,
    googleMapsNavigationUrl(destination),
  ].filter((url):url is string=>Boolean(url))
}

export function openNavigation(destination:NavigationDestination,platform=''):string|null{
  const ua=platform || (typeof navigator!=='undefined'?navigator.userAgent:'')
  const normalizedPlatform=ua.toLowerCase()
  if(isIos(normalizedPlatform))return appleMapsNavigationUrl(destination)||googleMapsNavigationUrl(destination)
  if(isAndroid(normalizedPlatform))return androidNavigationUrls(destination)[0]||googleMapsNavigationUrl(destination)
  return googleMapsNavigationUrl(destination)
}

export function openNavigationWithFallback(destination:NavigationDestination,platform=''):boolean{
  if(typeof window==='undefined')return false
  const ua=platform || (typeof navigator!=='undefined'?navigator.userAgent:'')
  const normalizedPlatform=ua.toLowerCase()
  const urls=isAndroid(normalizedPlatform)
    ? androidNavigationUrls(destination)
    : [openNavigation(destination,platform)].filter((url):url is string=>Boolean(url))
  if(!urls.length)return false
  let fallbackTimer=0
  const clearFallback=()=>{
    if(fallbackTimer){
      window.clearTimeout(fallbackTimer)
      fallbackTimer=0
    }
  }
  if(isAndroid(normalizedPlatform)&&urls.length>1){
    const handleVisibility=()=>{
      if(document.visibilityState==='hidden')clearFallback()
    }
    document.addEventListener('visibilitychange',handleVisibility,{once:true})
    fallbackTimer=window.setTimeout(()=>{
      if(document.visibilityState!=='hidden')window.location.replace(urls[1]!)
    },900)
  }
  window.location.replace(urls[0]!)
  return true
}
