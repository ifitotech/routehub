import type {NavigationDestination} from './types'

function destinationValue(destination:NavigationDestination){
  if(destination.coordinate)return `${destination.coordinate.lat},${destination.coordinate.lng}`
  return destination.address?.trim()||''
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
  // maps: opens the Apple Maps app. https://maps.apple.com often opens Safari first.
  return `maps:?${params.toString()}`
}

export function openNavigation(destination:NavigationDestination,platform=''):string|null{
  const ua=platform || (typeof navigator!=='undefined'?navigator.userAgent:'')
  const normalizedPlatform=ua.toLowerCase()
  if(/iphone|ipad|ipod/.test(normalizedPlatform))return appleMapsNavigationUrl(destination)||googleMapsNavigationUrl(destination)
  if(/android/.test(normalizedPlatform)){
    const value=destinationValue(destination)
    if(!value)return null
    return `geo:0,0?q=${encodeURIComponent(value)}`
  }
  return googleMapsNavigationUrl(destination)
}
