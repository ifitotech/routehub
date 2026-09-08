'use client'

export type GoogleLatLng={lat:number;lng:number}

type GoogleMapsWindow=Window&{
 google?:{maps?:Record<string,unknown>&{importLibrary?:(name:string)=>Promise<Record<string,unknown>>}}
 __routeHubGoogleMaps?:Promise<Record<string,unknown>>
}

/** Loads Maps and Places once. The browser key is public by design and must be HTTP-referrer restricted. */
export function loadGoogleMaps():Promise<Record<string,unknown>>{
 if(typeof window==='undefined')return Promise.reject(new Error('Google Maps is only available in the browser.'))
 const browserWindow=window as GoogleMapsWindow
 const existing=browserWindow.google?.maps
 if(existing){
  if(typeof existing.Map==='function')return Promise.resolve(existing)
  if(typeof existing.importLibrary==='function')return existing.importLibrary('maps').then(library=>({...existing,...library}))
 }
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
   if(maps&&typeof maps.Map==='function')resolve(maps)
   else if(maps&&typeof maps.importLibrary==='function')maps.importLibrary('maps').then(library=>resolve({...maps,...library})).catch(()=>reject(new Error('Google Maps did not initialize.')))
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
