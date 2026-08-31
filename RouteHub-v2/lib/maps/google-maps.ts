'use client'

export type GoogleLatLng={lat:number;lng:number}

type GoogleMapsWindow=Window&{
 google?:{maps?:Record<string,unknown>}
 __routeHubGoogleMaps?:Promise<Record<string,unknown>>
}

/** Loads Maps and Places once. The browser key is public by design and must be HTTP-referrer restricted. */
export function loadGoogleMaps():Promise<Record<string,unknown>>{
 if(typeof window==='undefined')return Promise.reject(new Error('Google Maps is only available in the browser.'))
 const browserWindow=window as GoogleMapsWindow
 if(browserWindow.google?.maps)return Promise.resolve(browserWindow.google.maps)
 if(browserWindow.__routeHubGoogleMaps)return browserWindow.__routeHubGoogleMaps
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
 if(!key)return Promise.reject(new Error('Google Maps browser key is not configured.'))

 browserWindow.__routeHubGoogleMaps=new Promise((resolve,reject)=>{
  const callback=`__routeHubGoogleMapsReady_${Math.random().toString(36).slice(2)}`
  const callbackWindow=window as unknown as Record<string,unknown>
  const timer=window.setTimeout(()=>reject(new Error('Google Maps timed out.')),12_000)
  callbackWindow[callback]=()=>{
   window.clearTimeout(timer)
   delete callbackWindow[callback]
   const maps=(window as GoogleMapsWindow).google?.maps
   if(maps)resolve(maps)
   else reject(new Error('Google Maps did not initialize.'))
  }
  const script=document.createElement('script')
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&loading=async&callback=${callback}`
  script.async=true
  script.defer=true
  script.dataset.routehubGoogleMaps='true'
  script.addEventListener('error',()=>reject(new Error('Google Maps failed to load.')),{once:true})
  document.head.appendChild(script)
 })
 return browserWindow.__routeHubGoogleMaps
}
