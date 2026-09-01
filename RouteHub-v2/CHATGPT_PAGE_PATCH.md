# ChatGPT task — apply workspace page.tsx onto GitHub main

The GitHub connector cannot push `RouteHub-v2/app/driver/page.tsx` (~98k). Do **not** rewrite the map files. They are already on `main`:

- `RouteHub-v2/app/route-plan-map.tsx`
- `RouteHub-v2/app/driver-route-navigation.tsx` (accepts BOTH `stops` and old LiveRouteMap props)
- `RouteHub-v2/lib/maps/coordinates.ts`

Edit only `RouteHub-v2/app/driver/page.tsx` on `origin/main`. Do not touch V3, Manager, schema, RLS.

GitHub page today still does this (wrong):
```
const LiveRouteMap=dynamic(()=>import('../driver-route-navigation'),{ssr:false})
```
and passes origin/destination/driverLocation. It also has a broken `finishDrivingDay` that reads a free `status` variable.

Apply these patches in order.

## 1. Imports
Replace
```
const LiveRouteMap=dynamic(()=>import('../driver-route-navigation'),{ssr:false})
```
with
```
const LiveRouteMap=dynamic(()=>import('../live-route-map'),{ssr:false})
const DriverRouteNavigation=dynamic(()=>import('../driver-route-navigation'),{ssr:false})
```

## 2. State
After `locationStatus` add:
```
const [liveFix,setLiveFix]=useState<{lat:number;lng:number}|null>(null)
const [navigationPaused,setNavigationPaused]=useState(false)
```
After `pickupConfirmOpen` add:
```
const [branchCompleteOpen,setBranchCompleteOpen]=useState(false)
```
Include `branchCompleteOpen` in `driverDialogOpen`.

## 3. GPS watch (one watcher only)
Inside the existing `watchPosition` callback, after building `next`, add:
```
setLiveFix({lat:next.lat,lng:next.lng})
```

## 4. Open / close map
```
const openMap=()=>{if(routeView==='map')return;setTodayDragY(0);setNavigationPaused(false);setRouteView('map')}
const returnToToday=()=>{
  if((routeView==='queue'||routeView==='truck'||routeView==='map')&&typeof document!=='undefined'&&(document as any).startViewTransition){runMapTransition(()=>setRouteView(null));return}
  setRouteView(null)
  if(current&&['active','paused'].includes(current.status))setNavigationPaused(true)
}
```

## 5. Replace finishDrivingDay entirely
GitHub version is broken (`status` is undefined). Use:
```
const finishDrivingDay=async()=>{
  if(!drivingSession||busy)return
  setBusy(true)
  try{const result=await endDrivingDay(drivingSession.id,driverId);if(result.error)throw result.error;setDrivingSession(null);setLocationStatus('');setMessage(t.endDrivingDay)}catch(error){setLocationStatus(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}
}
```

## 6. Arrival + after complete
Replace GitHub `markArrived` with openArrivalFlow + markArrived + afterStopCompleted. Call afterStopCompleted from confirmPickup, confirmPickupWithPackingList, completeCurrentStop, saveRecipientAndComplete.

Pickup: open pickup confirm. Delivery: delivery tools. Branch: branch complete modal.
After complete: load(false), keep routeView='map', or finalize if no remaining stops.

## 7. startRoute
setNavigationPaused(false); setRouteView('map'); do not open Google Maps.

## 8-11. UI
- Today LiveRouteMap onActivate=openMap, waypoints from currentRouteStops, driverLocation=liveFix
- Google = mapSecondaryAction only
- Continuar navegación when navigationPaused
- Map canvas: DriverRouteNavigation stops={currentRouteStops} activeStopId={current.id} sharedLocation={liveFix} onArrive=markArrived onExit=returnToToday
- Add branchCompleteOpen modal

Full snippet file is RouteHub-v2/CHATGPT_PAGE_PATCH.md in the Grok workspace if this summary is truncated.
