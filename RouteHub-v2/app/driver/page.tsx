'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {useCallback, useEffect, useRef, useState} from 'react'
import type {CSSProperties, PointerEvent as ReactPointerEvent} from 'react'
import {flushSync} from 'react-dom'
import {useSearchParams} from 'next/navigation'
import {ArrowLeft, Camera, Check, ChevronRight, CircleUserRound, ClipboardCheck, Clock3, FileText, History as HistoryIcon, Home, List, Map as MapIcon, MapPin, MessageSquare, MoreHorizontal, Pause, Phone, Play, RotateCcw, Signature, TriangleAlert, X} from 'lucide-react'
import {completeMission, currentMembership} from '../../lib/data'
import {uploadMissionEvidence} from '../../lib/mission-evidence'
import {getSupabase} from '../../lib/supabase'
import {useLocale} from '../../lib/use-preferences'
import {endDrivingDay, getActiveDrivingSession, startDrivingDay, startTemporaryRouteSession, updateDrivingLocation, type DrivingSession} from '../../lib/driving-session'
import {getCurrentLocation, getLocationPermission} from '../../lib/location'
import {canDriverStartRoute, operationalDate, selectDriverTodayQueue} from '../../lib/driver-queue'
import {routeProgress, stopAction, stopKind} from '../../lib/stop-workflow'
import {saveCustomerSignature} from '../../lib/signature'
import {workspaceForStrictRole} from '../auth-access'
import {createRealtimeRefresh} from '../../lib/realtime-sync'
import {calculateRoute, formatRouteEstimate} from '../../lib/maps/routing'
import {googleMapsNavigationUrl} from '../../lib/maps/external-navigation'
import {reportAppError} from '../../lib/error-reporting'
import type {Role} from '../../lib/types'
import NotificationBell from '../notification-bell'
import styles from './driver.module.css'
const LiveRouteMap=dynamic(()=>import('../live-route-map'),{ssr:false})
const RoutePlanMap=dynamic(()=>import('../route-plan-map'),{ssr:false})

type Mission = {id:string;company_id:string;branch_id:string|null;driver_id:string;route_date:string;status:'draft'|'pending'|'published'|'active'|'paused'|'completed'|'issue'|'cancelled';origin_address?:string;destination_address?:string;destination_name?:string;destination_phone?:string;origin_lat?:number|null;origin_lng?:number|null;destination_lat?:number|null;destination_lng?:number|null;priority?:string;notes?:string;driver_note?:string;position:number;mission_type?:string;order_number?:string;scheduled_at?:string;completed_at?:string;arrived_at?:string;customer_signature_path?:string;completion_photo_path?:string;finalized_at?:string;finalization_method?:string;finalization_note?:string;finalization_issue?:string;finalization_photo_path?:string}
type SavedContact = {company_name?:string|null;contact_name?:string|null;address?:string|null;phone?:string|null}
type StopEvidence = {kind:string;path?:string;url?:string}

const addressKey=(value?:string|null)=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'')
const locationConsentKey=(driverId:string)=>`routehub-location-consent-v1:${driverId}`

const errorMessage=(error:unknown,fallback:string)=>{
  const raw=error instanceof Error?error.message:error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'?error.message:''
  // Database policy text is an implementation detail; never expose it as a
  // large toast in the driver UI. Keep the concise, localized fallback.
  if(raw&&/only update route progress|only update route/i.test(raw))return fallback
  if(raw)return raw
  return fallback
}

export default function Driver() {
  const searchParams=useSearchParams()
  const [missions,setMissions]=useState<Mission[]>([])
  const [contacts,setContacts]=useState<SavedContact[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [modal,setModal]=useState(false)
  const [issueNote,setIssueNote]=useState('')
  const [issuePhoto,setIssuePhoto]=useState<File|null>(null)
  const [stopNoteOpen,setStopNoteOpen]=useState(false)
  const [stopNote,setStopNote]=useState('')
const [recipientPromptOpen,setRecipientPromptOpen]=useState(false)
const [recipientName,setRecipientName]=useState('')
const [recipientError,setRecipientError]=useState('')
  const [signatureOpen,setSignatureOpen]=useState(false)
  const [deliveryToolsOpen,setDeliveryToolsOpen]=useState(false)
  const [finalizeOpen,setFinalizeOpen]=useState(false)
  const [finalizeIssueOpen,setFinalizeIssueOpen]=useState(false)
  const [finalizeIssue,setFinalizeIssue]=useState('')
  const [finalizeNote,setFinalizeNote]=useState('')
  const [finalizeIssuePhoto,setFinalizeIssuePhoto]=useState<File|null>(null)
  const finalIssueOptions=['Customer unavailable','Wrong address','Material issue','Could not complete','Other']
  const [driverId,setDriverId]=useState('')
  const [membershipRole,setMembershipRole]=useState<Role|null>(null)
  const [drivingSession,setDrivingSession]=useState<DrivingSession|null>(null)
  const [autoCloseTime,setAutoCloseTime]=useState('18:00')
  const [clockNow,setClockNow]=useState(()=>Date.now())
  const [evidencePreview,setEvidencePreview]=useState<{photo?:string;signature?:string}>({})
  const [selectedEvidence,setSelectedEvidence]=useState<StopEvidence[]>([])
  const [locationStatus,setLocationStatus]=useState('')
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [routeView,setRouteView]=useState<'queue'|'details'|'map'|null>(()=>searchParams.get('view')==='map'?'map':searchParams.get('view')==='route'?'queue':null)
  const [todayDragY,setTodayDragY]=useState(0)
  const [mapReturning,setMapReturning]=useState(false)
  const todayDragStart=useRef<number|null>(null)
  const [routeEstimate,setRouteEstimate]=useState<string|null>(null)
  const [selectedRouteId,setSelectedRouteId]=useState<string | null>(null)
  const [dayPromptOpen,setDayPromptOpen]=useState(false)
  const [locationConsentAccepted,setLocationConsentAccepted]=useState(false)
  const [locationConsentChecked,setLocationConsentChecked]=useState(false)
  const [pickupConfirmOpen,setPickupConfirmOpen]=useState(false) // centered, address-only arrival confirmation
  const [packingListFile,setPackingListFile]=useState<File|null>(null)
  const packingListInput=useRef<HTMLInputElement>(null)
  const dayPromptSeenRef=useRef(false)
  const autoClosingDayRef=useRef(false)
  const fileInput=useRef<HTMLInputElement>(null)
  const finalPhotoInput=useRef<HTMLInputElement>(null)
  const signatureCanvas=useRef<HTMLCanvasElement>(null)
  const lastLocationSync=useRef<{at:number;lat:number;lng:number}|null>(null)
  const {t,locale}=useLocale()
  useEffect(()=>{const timer=window.setInterval(()=>setClockNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{
    if(!driverId||typeof window==='undefined')return
    const accepted=window.localStorage.getItem(locationConsentKey(driverId))==='accepted'
    setLocationConsentAccepted(accepted)
    setLocationConsentChecked(accepted)
  },[driverId])

  const load=useCallback(async()=>{
    setLoading(true)
    try{
      const client=getSupabase()
      const {data:userData}=await client.auth.getUser()
      if(!userData.user)throw Error(t.signIn)
      const today=operationalDate()
      setDriverId(userData.user.id)
      const membership=await currentMembership()
      setMembershipRole(membership.role as Role)
      if(membership.branch_id){
        const {data:branchSettings,error:branchSettingsError}=await client.from('branches').select('auto_close_time').eq('id',membership.branch_id).maybeSingle()
        // Keep older deployments working until the additive branch migration is applied.
        if(!branchSettingsError&&branchSettings?.auto_close_time)setAutoCloseTime(String(branchSettings.auto_close_time).slice(0,5))
      }
      // route_date is the operational date. Never use created_at or a UTC
      // conversion here: tomorrow's position 1 must not become today's route.
      const {data,error}=await client.from('routes')
        .select('id,company_id,branch_id,driver_id,route_date,status,origin_address,destination_address,destination_name,destination_phone,origin_lat,origin_lng,destination_lat,destination_lng,priority,notes,driver_note,position,mission_type,order_number,scheduled_at,completed_at,arrived_at,customer_signature_path,completion_photo_path,finalized_at,finalization_method,finalization_note,finalization_issue,finalization_photo_path')
        .eq('driver_id',userData.user.id)
        .in('status',['published','pending','active','paused','completed','issue','cancelled'])
        .order('position')
      if(error)throw error
      setMissions((data||[]) as Mission[])
      const {data:contactData}=await client.from('contacts').select('company_name,contact_name,address,phone').eq('company_id',membership.company_id)
      setContacts((contactData||[]) as SavedContact[])
      const sessionResult=await getActiveDrivingSession(userData.user.id)
      if(!sessionResult.error){
        setDrivingSession(sessionResult.data)
        if(membership.role==='driver'&&!sessionResult.data&&!dayPromptSeenRef.current){dayPromptSeenRef.current=true;setDayPromptOpen(true)}
      }
      setLoadError('')
      setMessage('')
    }catch(error){
      // Keep the last authoritative queue on screen during a temporary
      // connection failure. Detailed errors stay in development tools only.
      if(process.env.NODE_ENV !== 'production')console.error('Driver route queue failed to load',error)
      setLoadError(t.unableLoadRoutes)
    }finally{setLoading(false)}
  },[t.signIn,t.unableLoadRoutes])
  const today=operationalDate()
  const {current,upcoming,completed}=selectDriverTodayQueue(missions,driverId,today)
  const completionQueue=missions.filter(route=>route.driver_id===driverId&&route.route_date===today).reduce<Mission[][]>((groups,route)=>{
    const key=[route.company_id,route.branch_id||'',route.route_date].join('|')
    const group=groups.find(items=>[items[0]?.company_id,items[0]?.branch_id||'',items[0]?.route_date].join('|')===key)
    if(group)group.push(route);else groups.push([route])
    return groups
  },[]).map(items=>({items,progress:routeProgress(items)})).filter(group=>group.progress.readyToFinalize&&group.items.some(item=>Boolean(item.arrived_at)))
    .sort((left,right)=>(right.items[0]?.route_date||'').localeCompare(left.items[0]?.route_date||''))
  const completionCandidate=completionQueue[0]
  const finalStop=completionCandidate?.items.filter(item=>item.status!=='cancelled').slice().sort((left,right)=>right.position-left.position||right.id.localeCompare(left.id))[0]
  const selectedRoute=[current,...upcoming,...completed].find(item=>item?.id===selectedRouteId) || current
  useEffect(()=>{
    let cancelled=false
    const destination=current?.destination_lat!=null&&current.destination_lng!=null?{lat:Number(current.destination_lat),lng:Number(current.destination_lng)}:null
    const origin=drivingSession?.last_lat!=null&&drivingSession.last_lng!=null?{lat:Number(drivingSession.last_lat),lng:Number(drivingSession.last_lng)}:current?.origin_lat!=null&&current.origin_lng!=null?{lat:Number(current.origin_lat),lng:Number(current.origin_lng)}:null
    if(!origin||!destination){setRouteEstimate(null);return}
    void calculateRoute([origin,destination]).then(estimate=>{if(!cancelled)setRouteEstimate(estimate.source==='osrm'?formatRouteEstimate(estimate,locale):null)})
    return()=>{cancelled=true}
  },[current?.id,current?.origin_lat,current?.origin_lng,current?.destination_lat,current?.destination_lng,drivingSession?.last_lat,drivingSession?.last_lng,locale])
  useEffect(()=>{
    let cancelled=false
    const loadEvidence=async()=>{
      setEvidencePreview({})
      setSelectedEvidence([])
      if(!selectedRoute)return
      const storage=getSupabase().storage.from('route-evidence')
      const [photo,signature,evidenceResult]=await Promise.all([
        selectedRoute.completion_photo_path?storage.createSignedUrl(selectedRoute.completion_photo_path,900):Promise.resolve({data:null}),
        selectedRoute.customer_signature_path?storage.createSignedUrl(selectedRoute.customer_signature_path,900):Promise.resolve({data:null}),
        getSupabase().from('route_evidence_v2').select('storage_path,kind').eq('mission_id',selectedRoute.id).order('created_at',{ascending:true}),
      ])
      const evidenceRows=(evidenceResult.data||[]) as {storage_path?:string;kind?:string}[]
      const evidenceUrls=await Promise.all(evidenceRows.filter(row=>row.storage_path&&row.storage_path!==selectedRoute.completion_photo_path&&row.storage_path!==selectedRoute.customer_signature_path).map(async row=>({kind:row.kind||'photo',path:row.storage_path,url:(await storage.createSignedUrl(row.storage_path as string,900)).data?.signedUrl})))
      if(!cancelled){
        setEvidencePreview({photo:photo.data?.signedUrl,signature:signature.data?.signedUrl})
        setSelectedEvidence(evidenceUrls)
      }
    }
    void loadEvidence()
    return()=>{cancelled=true}
  },[selectedRoute?.id,selectedRoute?.completion_photo_path,selectedRoute?.customer_signature_path])
  const dayRoutes=missions.filter(route=>route.driver_id===driverId&&route.route_date===today&&route.status!=='cancelled').slice().sort((left,right)=>{
    const rank=(status:string)=>status==='completed'||status==='issue'?2:status==='active'||status==='paused'?0:1
    return rank(left.status)-rank(right.status)||left.position-right.position||(left.completed_at||'').localeCompare(right.completed_at||'')
  })
  const dayMapOrigin=dayRoutes[0]?.origin_address||current?.origin_address
  const dayMapStops=dayRoutes.map(route=>({id:route.id,address:route.destination_address,label:route.destination_name||route.destination_address,kind:stopKind(route.mission_type),orderNumber:route.order_number,notes:route.notes,position:route.position}))
  const currentKind=stopKind(current?.mission_type)
  const currentRouteStops=current
    ? dayRoutes.filter(route=>route.company_id===current.company_id&&route.branch_id===current.branch_id&&route.route_date===current.route_date).sort((left,right)=>left.position-right.position||left.id.localeCompare(right.id))
    : []
  const currentStopIndex=current?currentRouteStops.findIndex(route=>route.id===current.id):-1
  const hasArrived=Boolean(current?.arrived_at)
  const currentAction=stopAction(currentKind,hasArrived)
  const temporaryExecution=membershipRole!=null&&membershipRole!=='driver'
  const homeHref=membershipRole?workspaceForStrictRole(membershipRole):'/driver'
  const temporaryLabel=locale==='es'?'Ruta temporal':locale==='fr'?'Itinéraire temporaire':'Temporary route'
  const isPastRoute=Boolean(current?.route_date&&current.route_date.slice(0,10)<today)
  const routeLabel=(route?:Mission|null)=>{
    if(!route)return t.destination
    const destination=route.destination_address||''
    const savedContact=contacts.find(contact=>addressKey(contact.address)===addressKey(destination))
    // Older routes may have been saved with the address as destination_name.
    // Prefer the saved company name in that case, while preserving an explicit
    // custom route title when one was provided.
    if(route.destination_name&&addressKey(route.destination_name)!==addressKey(destination))return route.destination_name
    return savedContact?.company_name||route.destination_name||destination||t.destination
  }
  const elapsedLabel=(route:Mission)=>{
    if(!route.arrived_at)return ''
    const end=route.completed_at?new Date(route.completed_at).getTime():clockNow
    const minutes=Math.max(0,Math.round((end-new Date(route.arrived_at).getTime())/60000))
    return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)}h ${minutes%60}m`
  }
  const currentContact=contacts.find(contact=>addressKey(contact.address)===addressKey(current?.destination_address))
  const currentPhone=current?.destination_phone||currentContact?.phone||null
  const routeMetaCopy=locale==='es'?{po:'PO / ORDER',instructions:'INSTRUCCIONES',call:'Llamar'}:locale==='fr'?{po:'PO / COMMANDE',instructions:'INSTRUCTIONS',call:'Appeler'}:{po:'PO / ORDER',instructions:'INSTRUCTIONS',call:'Call'}
  const stopCopy=locale==='es'?{pickup:'PICKUP',delivery:'DELIVERY',branch:'RETURN TO BRANCH',arrived:'Llegué',confirmPickup:'Confirmar recogida',completeDelivery:'Completar entrega',completeBranch:'Llegué',takePhoto:'Tomar foto',signature:'Firma del cliente',addNote:'Añadir nota',report:'Reportar problema',openMaps:'Abrir en Google Maps',completeRoute:'Completar ruta'}:locale==='fr'?{pickup:'COLLECTE',delivery:'LIVRAISON',branch:'RETOUR À LA SUCCURSALE',arrived:'Arrivé',confirmPickup:'Confirmer la collecte',completeDelivery:'Terminer la livraison',completeBranch:'Arrivé',takePhoto:'Prendre une photo',signature:'Signature du client',addNote:'Ajouter une note',report:'Signaler un problème',openMaps:'Ouvrir dans Google Maps',completeRoute:'Terminer l’itinéraire'}:{pickup:'PICKUP',delivery:'DELIVERY',branch:'RETURN TO BRANCH',arrived:'Arrived',confirmPickup:'Confirm Pickup',completeDelivery:'Complete Delivery',completeBranch:'Arrived',takePhoto:'Take Photo',signature:'Customer Signature',addNote:'Add Note',report:'Report Issue',openMaps:'Open in Google Maps',completeRoute:'Complete Route'}
  const currentStopLabel=stopCopy[currentKind]
  const locationConsentCopy=locale==='es'
    ? {title:'Compartir ubicación durante la jornada',body:'Al iniciar tu jornada, RouteHub compartirá tu ubicación con tu empresa durante el horario laboral para mostrar operaciones en vivo. Puedes detenerlo al finalizar la jornada.',check:'Acepto los términos de ubicación y el seguimiento durante mi jornada.',required:'Acepta los términos de ubicación para iniciar la jornada.'}
    : locale==='fr'
      ? {title:'Partager la position pendant la journée',body:'Lorsque vous commencez votre journée, RouteHub partage votre position avec votre entreprise pendant les heures de travail pour afficher les opérations en direct. Vous pouvez arrêter le partage en terminant la journée.',check:'J’accepte les conditions de localisation et le suivi pendant ma journée.',required:'Acceptez les conditions de localisation pour commencer la journée.'}
      : {title:'Share location during your driving day',body:'When you start your day, RouteHub shares your location with your company during working hours to support live operations. You can stop sharing by ending your driving day.',check:'I agree to the location terms and tracking during my driving day.',required:'Accept the location terms before starting your driving day.'}

  const driverDialogOpen=modal||stopNoteOpen||recipientPromptOpen||signatureOpen||deliveryToolsOpen||finalizeOpen||finalizeIssueOpen||pickupConfirmOpen||dayPromptOpen

  // Never let a dialog expose or scroll the work screen behind it. This is
  // especially important on iOS, where opening the keyboard changes only the
  // visual viewport and otherwise lets the route page peek through.
  useEffect(()=>{
    if(!driverDialogOpen)return
    const body=document.body
    const root=document.documentElement
    const previousBodyOverflow=body.style.overflow
    const previousRootOverflow=root.style.overflow
    body.style.overflow='hidden'
    root.style.overflow='hidden'
    return()=>{
      body.style.overflow=previousBodyOverflow
      root.style.overflow=previousRootOverflow
    }
  },[driverDialogOpen])

  // iOS keeps `position: fixed` dialogs sized to the layout viewport while
  // its keyboard uses the smaller visual viewport. Keep every driver form in
  // the actually visible space so textareas never sit behind the keyboard.
  useEffect(()=>{
    const viewport=window.visualViewport
    if(!viewport)return
    const syncViewportHeight=()=>{
      const root=document.documentElement
      root.style.setProperty('--rh-driver-viewport-height',`${Math.round(viewport.height)}px`)
      root.style.setProperty('--rh-driver-modal-top',`${Math.round(viewport.offsetTop+viewport.height/2)}px`)
    }
    syncViewportHeight()
    viewport.addEventListener('resize',syncViewportHeight)
    viewport.addEventListener('scroll',syncViewportHeight)
    return()=>{
      viewport.removeEventListener('resize',syncViewportHeight)
      viewport.removeEventListener('scroll',syncViewportHeight)
      document.documentElement.style.removeProperty('--rh-driver-viewport-height')
      document.documentElement.style.removeProperty('--rh-driver-modal-top')
    }
  },[])

  useEffect(()=>{
    const client=getSupabase()
    let disposed=false
    let channel:ReturnType<typeof client.channel>|undefined
    const sync=createRealtimeRefresh(()=>{if(!disposed)return load()},150)
    void client.auth.getUser().then(({data})=>{
      if(disposed||!data.user)return
      channel=client.channel(`driver-routes-${data.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`driver_id=eq.${data.user.id}`},sync.schedule).subscribe()
    })
    sync.schedule()
    const timer=setInterval(sync.schedule,10000)
    const onVisibility=()=>{if(document.visibilityState==='visible')sync.schedule()}
    window.addEventListener('focus',sync.schedule)
    document.addEventListener('visibilitychange',onVisibility)
    return()=>{disposed=true;clearInterval(timer);sync.dispose();window.removeEventListener('focus',sync.schedule);document.removeEventListener('visibilitychange',onVisibility);if(channel)void client.removeChannel(channel)}
  },[load])

  useEffect(()=>{
    if(!drivingSession||!driverId||typeof navigator==='undefined'||!navigator.geolocation)return
    let disposed=false
    const sendLocation=async()=>{
      try{
        // Only the driver's explicit Start route action can request location.
        // The five-minute sample never reopens a permission prompt.
        const permission=await getLocationPermission()
        // Safari/iOS may not expose a reliable Permissions API state and can
        // report `prompt` even after the user has already granted access.
        // Let getCurrentLocation decide in that case; only an explicit denial
        // should stop the update loop.
        if(permission==='denied'){
          if(!disposed)setLocationStatus(t.locationPermissionDenied)
          return
        }
        const location=await getCurrentLocation({maximumAge:0})
        if(disposed)return
        const result=await updateDrivingLocation(drivingSession.id,driverId,location)
        if(result.error)throw result.error
        setLocationStatus('')
      }catch(error){if(!disposed)setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied)}
    }
    // Take an immediate GPS fix and keep a foreground watch so the manager
    // sees movement while the driver is actively using the app. The periodic
    // sample remains as a fallback for devices that throttle watchPosition.
    void sendLocation()
    const interval=window.setInterval(()=>void sendLocation(),5*60*1000)
    const watch=navigator.geolocation.watchPosition(position=>{
      if(disposed)return
      const next={lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy}
      const previous=lastLocationSync.current
      const elapsed=Date.now()-(previous?.at||0)
      // Moving drivers are reported at most every 10s. A stopped driver is
      // still visible, but only sends a heartbeat once a minute.
      const moved=!previous||Math.hypot((next.lat-previous.lat)*111_000,(next.lng-previous.lng)*111_000*Math.cos(next.lat*Math.PI/180))>=25
      if((moved&&elapsed<10_000)||(!moved&&elapsed<60_000))return
      lastLocationSync.current={at:Date.now(),lat:next.lat,lng:next.lng}
      void updateDrivingLocation(drivingSession.id,driverId,next).then(result=>{
        if(result.error&&!disposed)setLocationStatus(result.error.message)
      })
    },()=>undefined,{enableHighAccuracy:true,maximumAge:0,timeout:20000})
    return()=>{disposed=true;window.clearInterval(interval);navigator.geolocation.clearWatch(watch)}
  },[driverId,drivingSession,t.locationPermissionDenied])

  useEffect(()=>{
    const onArrival=(event:Event)=>{
      const detail=(event as CustomEvent<{manual?:boolean}>).detail
      // GPS proximity only enables the on-screen arrival action. The database
      // changes after the driver explicitly confirms by pressing "Llegué".
      if(!detail?.manual){setMessage(locale==='es'?'Estás cerca de la parada. Confirma "Llegué" cuando estés listo.':locale==='fr'?'Vous êtes près de l’arrêt. Confirmez « Arrivé » lorsque vous êtes prêt.':'You are near the stop. Confirm "Arrived" when you are ready.');return}
      if(!current||current.arrived_at||!driverId)return
      void (async()=>{
        const {data,error}=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null).select('id').maybeSingle()
        if(error){void reportAppError({action:'gps_arrival',error,companyId:current.company_id,branchId:current.branch_id,routeId:current.id});return}
        if(data){setMessage(locale==='es'?'Llegaste a la parada.':locale==='fr'?'Vous êtes arrivé à l’arrêt.':'You arrived at the stop.');void load()}
      })()
    }
    window.addEventListener('routehub:arrival',onArrival)
    return()=>window.removeEventListener('routehub:arrival',onArrival)
  },[current,driverId,load,locale])

  // A driver day is automatically closed after 6 PM only when no operational
  // work remains. Active, paused, published, and pending routes always keep
  // the session open so the driver is never disconnected mid-route.
  useEffect(()=>{
    if(!drivingSession||drivingSession.session_kind!=='driving_day'||!driverId)return
    const checkAutoClose=async()=>{
      const now=new Date()
      const [closeHour,closeMinute]=autoCloseTime.split(':').map(Number)
      const closeMinutes=(Number.isFinite(closeHour)?closeHour:18)*60+(Number.isFinite(closeMinute)?closeMinute:0)
      if((now.getHours()*60+now.getMinutes())<closeMinutes||autoClosingDayRef.current)return
      const hasPendingWork=missions.some(item=>['published','pending','active','paused'].includes(item.status))
      if(current||hasPendingWork)return
      autoClosingDayRef.current=true
      try{
        const result=await endDrivingDay(drivingSession.id,driverId)
        if(result.error)throw result.error
        setDrivingSession(null)
        setLocationStatus('')
        setMessage(locale==='es'?'Jornada cerrada automáticamente a las 6:00 PM.':locale==='fr'?'Journée fermée automatiquement à 18 h.':'Driving day closed automatically at 6:00 PM.')
      }catch(error){autoClosingDayRef.current=false;setLocationStatus(errorMessage(error,t.unableUpdateRoute))}
    }
    void checkAutoClose()
    const timer=window.setInterval(()=>void checkAutoClose(),60_000)
    return()=>window.clearInterval(timer)
  },[autoCloseTime,current,driverId,drivingSession,locale,missions,t.unableUpdateRoute])

  const runMapTransition=(update:()=>void)=>{
    const startViewTransition=typeof document!=='undefined'&&(document as any).startViewTransition
    if(startViewTransition){startViewTransition.call(document,()=>flushSync(update));return true}
    update()
    return false
  }
  const openRouteMap=()=>{
    if(routeView==='map')return
    runMapTransition(()=>{setMapReturning(false);setTodayDragY(0);setRouteView('map')})
  }
  const openRouteQueue=()=>{setMapReturning(false);setTodayDragY(0);setRouteView('queue')}
  const returnToToday=()=>{
    if(routeView!=='map'){setRouteView(null);return}
    if(typeof document!=='undefined'&&(document as any).startViewTransition){runMapTransition(()=>{setMapReturning(false);setRouteView(null)});return}
    setMapReturning(true)
    window.setTimeout(()=>{setRouteView(null);setMapReturning(false)},340)
  }
  const beginTodayDrag=(event:ReactPointerEvent<HTMLElement>)=>{
    if(event.target instanceof Element&&event.target.closest('button,a,input,textarea,select')&&!event.target.closest(`.${styles.todayMapHandle},.${styles.routeSwipeHandle}`))return
    todayDragStart.current=event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveTodayDrag=(event:ReactPointerEvent<HTMLElement>)=>{
    if(todayDragStart.current==null)return
    setTodayDragY(Math.max(0,Math.min(150,event.clientY-todayDragStart.current)))
  }
  const finishTodayDrag=(event:ReactPointerEvent<HTMLElement>)=>{
    if(todayDragStart.current==null)return
    const distance=event.clientY-todayDragStart.current
    todayDragStart.current=null
    if(routeView==='queue'&&distance>55){setTodayDragY(0);returnToToday();return}
    if(routeView===null&&distance<-55){setTodayDragY(0);openRouteQueue();return}
    if(routeView===null&&distance>55){setTodayDragY(0);openRouteMap();return}
    setTodayDragY(0)
  }
  const openGoogleMaps=(route:Mission|null|undefined=current)=>{
    if(!route)return
    const url=googleMapsNavigationUrl({address:route.destination_address,coordinate:route.destination_lat!=null&&route.destination_lng!=null?{lat:Number(route.destination_lat),lng:Number(route.destination_lng)}:null,label:route.destination_name})
    if(url)window.location.assign(url)
  }
  const receivedBy=(route?:Mission|null)=>{
    const match=route?.driver_note?.match(/^Received by:\s*(.+)$/i)
    return match?.[1]?.trim()||''
  }
  const detailCopy=locale==='es'
    ? {stopDetails:'Detalles de la parada',current:'Parada actual',upcoming:'Próxima parada',completed:'Completada',completion:'Detalles de finalización',completedAt:'Completada',arrivedAt:'Llegada',time:'Tiempo en ruta',contact:'Contacto',instructions:'Instrucciones',po:'PO / ORDER',photo:'Foto disponible',signature:'Firma disponible',packing:'Packing list disponible',issue:'Incidencia reportada',receivedBy:'Recibido por',openMap:'Navegar',close:'Cerrar'}
    : locale==='fr'
      ? {stopDetails:'Détails de l’arrêt',current:'Arrêt actuel',upcoming:'Prochain arrêt',completed:'Terminé',completion:'Détails de fin',completedAt:'Terminé le',arrivedAt:'Arrivée',time:'Temps sur l’itinéraire',contact:'Contact',instructions:'Instructions',po:'PO / COMMANDE',photo:'Photo disponible',signature:'Signature disponible',packing:'Liste de colisage disponible',issue:'Incident signalé',receivedBy:'Reçu par',openMap:'Ouvrir la carte',close:'Fermer'}
      : {stopDetails:'Stop details',current:'Current stop',upcoming:'Upcoming stop',completed:'Completed',completion:'Completion details',completedAt:'Completed',arrivedAt:'Arrival',time:'Time on route',contact:'Contact',instructions:'Instructions',po:'PO / ORDER',photo:'Photo available',signature:'Signature available',packing:'Packing list available',issue:'Issue reported',receivedBy:'Received by',openMap:'Navigate',close:'Close'}
  const startTrackingForActiveRoute=async()=>{
    if(!driverId||!current)return false
    if(!locationConsentAccepted){
      dayPromptSeenRef.current=true
      setDayPromptOpen(true)
      setMessage(locationConsentCopy.required)
      return false
    }
    try{
      const coordinates=await getCurrentLocation()
      const membership=await currentMembership()
      const result=membership.role==='driver'
        ? await startDrivingDay({companyId:current.company_id||membership.company_id,branchId:current.branch_id??membership.branch_id,driverId})
        : await startTemporaryRouteSession({companyId:current.company_id||membership.company_id,branchId:current.branch_id??membership.branch_id,driverId,routeId:current.id})
      if(result.error)throw result.error
      setDrivingSession(result.data)
      if(result.data)await updateDrivingLocation(result.data.id,driverId,coordinates)
      setLocationStatus('')
      return true
    }catch(error){setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied);return false}
  }
  const beginDrivingDay=async()=>{
    if(!driverId||busy)return
    if(!locationConsentAccepted){
      if(!locationConsentChecked){setMessage(locationConsentCopy.required);return}
      window.localStorage.setItem(locationConsentKey(driverId),'accepted')
      setLocationConsentAccepted(true)
    }
    setBusy(true);setLocationStatus('')
    try{
      const membership=await currentMembership()
      const coordinates=await getCurrentLocation()
      const result=await startDrivingDay({companyId:membership.company_id,branchId:current?.branch_id??membership.branch_id,driverId})
      if(result.error)throw result.error
      setDrivingSession(result.data)
      if(result.data)await updateDrivingLocation(result.data.id,driverId,coordinates)
      setMessage(t.startDrivingDay)
      setDayPromptOpen(false)
    }catch(error){setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied);setMessage(error instanceof Error?error.message:t.unableUpdateRoute)}
    finally{setBusy(false)}
  }
  const finishDrivingDay=async()=>{
    if(!drivingSession||busy)return
    setBusy(true)
    try{const result=await endDrivingDay(drivingSession.id,driverId);if(result.error)throw result.error;setDrivingSession(null);setLocationStatus('');setMessage(t.endDrivingDay)}catch(error){setLocationStatus(error instanceof Error?error.message:t.unableUpdateRoute)}finally{setBusy(false)}
  }

  const update=async(status:string,evidenceFile?:File)=>{
    if(!current||busy)return false
    setBusy(true)
    try{
      if(status==='active'&&!canDriverStartRoute(current,today)){setMessage(t.unableUpdateRoute);return false}
      const client=getSupabase()
      if(status==='active'){
        const {data:otherActive,error:activeError}=await client.from('routes').select('id').eq('driver_id',driverId).eq('company_id',current.company_id).eq('status','active').neq('id',current.id)
        if(activeError)throw activeError
        if(otherActive?.length){
          const {error:pauseError}=await client.from('routes').update({status:'paused',updated_version:Date.now()}).in('id',otherActive.map(route=>route.id)).eq('driver_id',driverId).eq('company_id',current.company_id)
          if(pauseError)throw pauseError
        }
      }
      const payload:Record<string,unknown>={status,updated_version:Date.now()}
      if(status==='issue'){
        if(evidenceFile)await uploadMissionEvidence(evidenceFile,current.id,{kind:'issue',attachAsCompletionPhoto:false})
        payload.driver_note=issueNote.trim()||current.driver_note||null
      }
      const {error}=await client.from('routes').update(payload).eq('id',current.id).eq('driver_id',driverId).eq('company_id',current.company_id)
      if(error)throw error
      if(status==='active')await startTrackingForActiveRoute()
      setModal(false);setIssueNote('');setIssuePhoto(null);await load();return true
    }catch(error){setMessage(errorMessage(error,t.unableUpdateRoute));return false}
    finally{setBusy(false)}
  }
  const markArrived=async()=>{if(!current||busy)return;setBusy(true);try{const {data,error}=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Arrival was already recorded.');setMessage(locale==='es'?'Llegada registrada.':locale==='fr'?'Arrivée enregistrée.':'Arrival recorded.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const confirmPickup=async()=>{if(!current||busy)return;setBusy(true);try{const arrivedAt=new Date().toISOString();const {data,error}=await getSupabase().from('routes').update({arrived_at:arrivedAt,updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Pickup arrival was already recorded.');await completeMission(current.id);setPickupConfirmOpen(false);setPackingListFile(null);setMessage(locale==='es'?'Pickup confirmado.':locale==='fr'?'Collecte confirmée.':'Pickup confirmed.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const confirmPickupWithPackingList=async()=>{if(!current||busy)return;setBusy(true);try{if(packingListFile)await uploadMissionEvidence(packingListFile,current.id,{kind:'photo',attachAsCompletionPhoto:false});const arrivedAt=new Date().toISOString();const {data,error}=await getSupabase().from('routes').update({arrived_at:arrivedAt,updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Pickup arrival was already recorded.');await completeMission(current.id);setPickupConfirmOpen(false);setPackingListFile(null);setMessage(locale==='es'?'Pickup confirmado.':locale==='fr'?'Collecte confirmée.':'Pickup confirmed.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const attachStopPhoto=async(file:File)=>{if(!current||busy)return;setBusy(true);try{await uploadMissionEvidence(file,current.id);setMessage(locale==='es'?'Foto guardada.':locale==='fr'?'Photo enregistrée.':'Photo saved.');await load();if(currentKind==='delivery')setDeliveryToolsOpen(true)}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const completeCurrentStop=async(force=false,driverNote?:string,showRecipientError=false)=>{if(!current||(!force&&busy))return;setBusy(true);try{if(currentKind==='pickup'&&!current.arrived_at)throw Error('Record arrival before completing this stop.');if((currentKind==='branch'||currentKind==='delivery')&&!current.arrived_at){const{error:arrivalError}=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null);if(arrivalError)throw arrivalError}let location:Awaited<ReturnType<typeof getCurrentLocation>>|undefined;try{location=await getCurrentLocation({maximumAge:60_000});if(drivingSession)await updateDrivingLocation(drivingSession.id,driverId,location)}catch{}const finished=await completeMission(current.id,location,driverNote===undefined?undefined:{driverNote});setMissions(previous=>previous.map(route=>route.id===finished.id?{...route,...finished,status:'completed'}:route));setModal(false);setRecipientPromptOpen(false);setRecipientName('');setRecipientError('');setIssueNote('');setIssuePhoto(null);setMessage(locale==='es'?'Parada completada. Cargando la siguiente…':locale==='fr'?'Arrêt terminé. Chargement du suivant…':'Stop completed. Loading next stop…')}catch(error){const completionError=errorMessage(error,t.unableUpdateRoute);void reportAppError({action:'complete_stop',error,companyId:current?.company_id,branchId:current?.branch_id,routeId:current?.id,context:{kind:currentKind}});setMessage(completionError);if(showRecipientError)setRecipientError(completionError)}finally{setBusy(false)}}
  const completeDelivery=()=>{
    if(!current||currentKind!=='delivery'||busy)return
    // Every delivery must identify the person who received it. Photo,
    // signature and notes remain optional proof and never replace the name.
    const hasRecipient=current.driver_note?.trim().startsWith('Received by:')
    if(!hasRecipient){setRecipientError('');setRecipientPromptOpen(true);return}
    void completeCurrentStop()
  }
  const saveRecipientAndComplete=()=>{
    if(!current||!recipientName.trim()||busy)return
    const existingNote=current.driver_note?.trim()
    const recipientNote=`Received by: ${recipientName.trim()}`
    const driverNote=existingNote&&!existingNote.startsWith('Received by:')?`${recipientNote}\n${existingNote}`:recipientNote
    setRecipientError('')
    void completeCurrentStop(true,driverNote,true)
  }
  const saveStopNote=async()=>{if(!current||busy||!stopNote.trim())return;setBusy(true);try{const {error}=await getSupabase().from('routes').update({driver_note:stopNote.trim(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId);if(error)throw error;setStopNote('');setStopNoteOpen(false);setMessage(locale==='es'?'Nota guardada.':locale==='fr'?'Note enregistrée.':'Note saved.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const saveCustomerSignatureProof=async()=>{if(!current||busy||!signatureCanvas.current)return;setBusy(true);try{await saveCustomerSignature(signatureCanvas.current,{companyId:current.company_id,userId:driverId,missionId:current.id});setSignatureOpen(false);setDeliveryToolsOpen(true);setMessage(locale==='es'?'Firma guardada.':locale==='fr'?'Signature enregistrée.':'Signature saved.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const finalizeRoute=async(method:'normal'|'photo'|'issue',file?:File)=>{if(!finalStop||busy)return;setBusy(true);try{let photoPath:string|undefined;if(file){const evidence=await uploadMissionEvidence(file,finalStop.id,{kind:method==='issue'?'issue':'finalization',attachAsCompletionPhoto:false});photoPath=evidence.path}const {data,error}=await getSupabase().from('routes').update({finalized_at:new Date().toISOString(),finalization_method:method,finalization_note:finalizeNote.trim()||null,finalization_issue:method==='issue'?finalizeIssue||'Other':null,finalization_photo_path:photoPath||null,updated_version:Date.now()}).eq('id',finalStop.id).eq('driver_id',driverId).is('finalized_at',null).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('This route was already completed.');setFinalizeOpen(false);setFinalizeIssueOpen(false);setFinalizeIssue('');setFinalizeNote('');setFinalizeIssuePhoto(null);setMessage(locale==='es'?'Ruta completada.':locale==='fr'?'Itinéraire terminé.':'Route completed.');await load()}catch(error){void reportAppError({action:'finalize_route',error,companyId:finalStop?.company_id,branchId:finalStop?.branch_id,routeId:finalStop?.id,context:{method}});setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const startRoute=async()=>{
    // Do not use window.open here: Safari and installed PWAs can treat it as
    // a pop-up and ignore the driver's tap. A same-tab navigation is reliable
    // and lets the device hand the URL to Google Maps when it is installed.
    const saved=current?.status==='active'
      ? (drivingSession ? true : await startTrackingForActiveRoute())
      : await update('active')
    if(!saved)return
    setMessage(t.inProgress)
    openRouteMap()
  }
  const closeModal=()=>{if(busy)return;setModal(false);setIssueNote('');setIssuePhoto(null)}
  const beginSignature=(event:React.PointerEvent<HTMLCanvasElement>)=>{const canvas=signatureCanvas.current;if(!canvas)return;canvas.setPointerCapture(event.pointerId);const rect=canvas.getBoundingClientRect();const context=canvas.getContext('2d');if(!context)return;context.lineWidth=3;context.lineCap='round';context.strokeStyle='#14233b';context.beginPath();context.moveTo((event.clientX-rect.left)*(canvas.width/rect.width),(event.clientY-rect.top)*(canvas.height/rect.height));const move=(moveEvent:PointerEvent)=>{context.lineTo((moveEvent.clientX-rect.left)*(canvas.width/rect.width),(moveEvent.clientY-rect.top)*(canvas.height/rect.height));context.stroke()};const stop=()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',stop);canvas.removeEventListener('pointercancel',stop)};canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop)}

  return <main className={`app ${styles.page}`} onPointerDown={routeView===null?beginTodayDrag:undefined} onPointerMove={routeView===null?moveTodayDrag:undefined} onPointerUp={routeView===null?finishTodayDrag:undefined} onPointerCancel={()=>{if(routeView===null){todayDragStart.current=null;setTodayDragY(0)}}}>
    <header className={styles.header}><div className={styles.brand}><Image src="/routehub-driver-new.jpg" alt="RouteHub Driver" width={48} height={48} priority/><strong>RouteHub</strong></div>{routeView!=='map'&&<NotificationBell />}</header><div className={styles.workspaceHeading}><span className={styles.workspace}>{t.driverWorkspace}</span><h1>{t.routes}</h1></div>
    {membershipRole==='driver'&&<div className={styles.drivingBar}>{drivingSession?<><span className={styles.locationLive}><i/>{t.locationSharing}</span><button className={styles.endDay} disabled={busy} onClick={()=>void finishDrivingDay()}>{t.endDrivingDay}</button></>:<button className={styles.startDay} disabled={busy} onClick={()=>void beginDrivingDay()}><Play size={16}/>{t.startDrivingDay}</button>}</div>}
    {temporaryExecution&&drivingSession&&<div className={styles.drivingBar}><span className={styles.locationLive}><i/>{temporaryLabel}</span></div>}
    {locationStatus&&!drivingSession&&<div className={styles.locationNotice} role="status"><span className={styles.locationNoticeDot} aria-hidden="true" />{locationStatus}</div>}
    {message&&<div className={styles.toast} role="status">{message}</div>}
    {loadError&&<div className={styles.loadError} role="status"><span>{loadError}</span><button disabled={loading} onClick={()=>void load()}>{t.retry || 'Retry'}</button></div>}
    {loading&&!missions.length?<section className={`${styles.loading} card`} aria-busy="true"><span/><span/><span/></section>:current?<>
      <section className={`${styles.routeHero}${routeView==='map'||routeView==='queue'?` ${styles.routeHeroMapOpen}`:''}`} style={{'--today-drag':`${todayDragY}px`} as CSSProperties}>
      <section className={styles.mission}>
        <div className={styles.missionTop}><span>{isPastRoute?'PAST DUE':t.currentRoute}</span><button type="button" className={styles.todayMapHandle} aria-label={locale==='es'?'Desliza hacia abajo para abrir el mapa':'Drag down to open map'} onPointerDown={beginTodayDrag} onPointerMove={moveTodayDrag} onPointerUp={finishTodayDrag} onPointerCancel={()=>{todayDragStart.current=null;setTodayDragY(0)}}><i/></button><span className={current.priority==='urgent'?styles.urgent:styles.priority}>{isPastRoute?'PENDING':current.priority==='urgent'?`⚠ ${t.urgent}`:current.priority||t.normal}</span></div>
        <div className={styles.type}>{currentStopLabel}</div>
        <h2>{routeLabel(current)}</h2>
        <p className={styles.address}><MapPin size={18}/>{current.destination_address||t.destination}</p>
        <div className={styles.routeMeta} aria-live="polite">
          {currentStopIndex>=0&&currentRouteStops.length>0&&<span>{locale==='es'?`Parada ${currentStopIndex+1} de ${currentRouteStops.length}`:locale==='fr'?`Arrêt ${currentStopIndex+1} sur ${currentRouteStops.length}`:`Stop ${currentStopIndex+1} of ${currentRouteStops.length}`}</span>}
          {routeEstimate&&<span>{routeEstimate}</span>}
        </div>
        {currentKind==='pickup'&&<div className={`${styles.details} ${styles.singleDetail}`}><div><small>{routeMetaCopy.po}</small><strong>{current.order_number||'—'}</strong></div></div>}
        {currentKind==='delivery'&&currentPhone&&<div className={`${styles.details} ${styles.singleDetail}`}><a className={styles.contactCall} href={`tel:${currentPhone}`}><Phone size={17}/><span><small>{routeMetaCopy.call}</small><strong>{currentContact?.contact_name||currentContact?.company_name||routeLabel(current)}</strong></span></a></div>}
        {current.notes&&<div className={styles.notes}><TriangleAlert size={18}/><span><b>{currentKind==='delivery'?routeMetaCopy.instructions:'NOTES'}</b>{current.notes}</span></div>}
      </section>
      <LiveRouteMap originAddress={current.origin_address} destinationAddress={current.destination_address} originCoordinate={current.origin_lat!=null&&current.origin_lng!=null?{lat:Number(current.origin_lat),lng:Number(current.origin_lng)}:null} destinationCoordinate={current.destination_lat!=null&&current.destination_lng!=null?{lat:Number(current.destination_lat),lng:Number(current.destination_lng)}:null} driverLocation={drivingSession?.last_lat!=null&&drivingSession.last_lng!=null?{lat:drivingSession.last_lat,lng:drivingSession.last_lng}:null} driverUpdatedAt={drivingSession?.last_updated_at} title="Ruta en vivo" showHeader={false} showLocationUpdated={false} interactive={false} onActivate={openRouteMap} useDriverAsOrigin locale={locale}/>
      </section>
      <div className={`${styles.primaryActions}${routeView==='map'||routeView==='queue'?` ${styles.primaryActionsMapOpen}`:''}`}>
        {['published','pending'].includes(current.status)&&<button disabled={busy} className={styles.start} onClick={()=>void startRoute()}><Play size={19}/>{t.start}</button>}
        {current.status==='active'&&currentKind!=='delivery'&&currentAction==='arrived'&&<button disabled={busy} className={styles.complete} onClick={()=>{if(currentKind==='pickup')setPickupConfirmOpen(true);else void markArrived()}}><MapPin size={19}/>{stopCopy.arrived}</button>}
        {current.status==='active'&&(currentKind==='delivery'||currentAction!=='arrived')&&<button disabled={busy} className={styles.complete} onClick={()=>{if(currentKind==='delivery')setDeliveryToolsOpen(true);else void completeCurrentStop()}}><Check size={19}/>{currentKind==='delivery'?stopCopy.completeDelivery:currentAction==='confirm_pickup'?stopCopy.confirmPickup:stopCopy.completeBranch}</button>}
         {current.destination_address&&<><button disabled={busy} className={styles.viewRoute} onClick={openRouteMap}><MapPin size={18}/>{detailCopy.openMap}</button><button disabled={busy} className={styles.viewRoute} onClick={()=>openGoogleMaps(current)}><MapPin size={18}/>{stopCopy.openMaps}</button></>}
        {current.status==='paused'&&<button disabled={busy} className={styles.start} onClick={()=>void update('active')}><RotateCcw size={19}/>{t.resume}</button>}
      </div>
      <input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file)void attachStopPhoto(file)}}/>
    </>:current&&completionCandidate&&finalStop?<section className={`card ${styles.finishRoute}`}><ClipboardCheck/><h2>{stopCopy.completeRoute}</h2><p>{locale==='es'?'Todos los stops requeridos están completados. Revisa y confirma cómo deseas cerrar la ruta.':locale==='fr'?'Tous les arrêts requis sont terminés. Vérifiez et confirmez la fin de l’itinéraire.':'All required stops are complete. Review and confirm how you want to finish the route.'}</p><button className={styles.complete} disabled={busy} onClick={()=>setFinalizeOpen(true)}><Check size={19}/>{stopCopy.completeRoute}</button></section>:<section className={`card ${styles.empty}`}><MapPin/><h2>{t.noRoute}</h2><p>{t.noRoutesAssignedToday || t.noRouteHelp}</p>{temporaryExecution&&<Link className="primary" href={homeHref}>{locale==='es'?'Volver al espacio de trabajo':locale==='fr'?`Retour à l'espace de travail`:'Return to workspace'}</Link>}</section>}
      {routeView&&<section className={`${styles.routeOverlay}${routeView==='map'?` ${styles.routeOverlayMap}${mapReturning?` ${styles.routeOverlayReturning}`:''}`:routeView==='queue'?` ${styles.routeOverlayQueue}`:''}`} aria-label="Route details" onPointerDown={routeView==='queue'?beginTodayDrag:undefined} onPointerMove={routeView==='queue'?moveTodayDrag:undefined} onPointerUp={routeView==='queue'?finishTodayDrag:undefined} onPointerCancel={()=>{if(routeView==='queue'){todayDragStart.current=null;setTodayDragY(0)}}}>
      <header className={styles.routeOverlayHeader}><button type="button" onClick={()=>routeView==='details'?setRouteView('queue'):routeView==='map'?returnToToday():setRouteView(null)} aria-label="Back"><ArrowLeft size={20}/></button><strong>{routeView==='details'?detailCopy.stopDetails:routeView==='map'?'Map':'Route'}</strong>{routeView==='queue'&&<button type="button" className={styles.routeSwipeHandle} aria-label="Swipe down to Today" onPointerDown={beginTodayDrag} onPointerMove={moveTodayDrag} onPointerUp={finishTodayDrag} onPointerCancel={()=>{todayDragStart.current=null;setTodayDragY(0)}}><i/></button>}<span /></header>
      {routeView==='queue'||routeView==='map'?<><div className={styles.routeTabs}><button className={routeView==='queue'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('queue')}>Stops</button><button className={routeView==='map'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('map')}>Map</button></div>{routeView==='queue'?<div className={styles.stopList}>{!dayRoutes.length?<div className={styles.empty}><List size={24}/><h2>{t.noRoutesToday}</h2><p>{t.createRouteWhenReady}</p></div>:dayRoutes.map((route,index)=>{const kind=stopKind(route.mission_type);const status=route.status==='completed'||route.status==='issue'?detailCopy.completed:route.status==='active'||route.status==='paused'?detailCopy.current:route.scheduled_at?new Date(route.scheduled_at).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'}):detailCopy.upcoming;return <button type="button" className={styles.stopRow} key={route.id} onClick={()=>{setSelectedRouteId(route.id);setRouteView('details')}}><span className={styles.stopNumber}>{route.position||index+1}</span><span><strong>{routeLabel(route)}</strong><small>{kind==='branch'?stopCopy.branch:kind.toUpperCase()} · {status}{route.status==='active'&&elapsedLabel(route)?` · ${elapsedLabel(route)}`:''}</small></span><ChevronRight size={18}/></button>})}</div>:<RoutePlanMap locale={locale} originAddress={dayMapOrigin} stops={dayMapStops} autoStartNavigation={routeView==='map'} onReturnToday={returnToToday} transitioningOut={mapReturning}/>}</>:selectedRoute&&<div className={styles.stopDetails}><span className={styles.stopNumber}>{selectedRoute.position}</span><h2>{routeLabel(selectedRoute)}</h2><p><MapPin size={17}/>{selectedRoute.destination_address||t.destination}</p><div className={styles.detailDivider}/><small>{stopKind(selectedRoute.mission_type)==='branch'?stopCopy.branch:stopKind(selectedRoute.mission_type).toUpperCase()}</small><strong>{selectedRoute.status==='active'?detailCopy.current:selectedRoute.status==='completed'||selectedRoute.status==='issue'?detailCopy.completed:detailCopy.upcoming}</strong>{selectedRoute.scheduled_at&&<p><Clock3 size={17}/>{new Date(selectedRoute.scheduled_at).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'})}</p>}{selectedRoute.arrived_at&&<p><Clock3 size={17}/>{detailCopy.arrivedAt}: {new Date(selectedRoute.arrived_at).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'})}</p>}{selectedRoute.status==='active'&&<button type="button" className={styles.viewRoute} onClick={()=>setRouteView('map')}>{detailCopy.openMap}{elapsedLabel(selectedRoute)?` · ${elapsedLabel(selectedRoute)}`:''}</button>}{selectedRoute.destination_address&&<button type="button" className={styles.viewRoute} onClick={()=>openGoogleMaps(selectedRoute)}><MapPin size={18}/>{stopCopy.openMaps}</button>}{selectedRoute.order_number&&<div className={styles.detailNotes}><b>{detailCopy.po}</b><span>{selectedRoute.order_number}</span></div>}{receivedBy(selectedRoute)&&<div className={styles.detailNotes}><b>{detailCopy.receivedBy}</b><span>{receivedBy(selectedRoute)}</span></div>}{selectedRoute.destination_phone&&<p><Phone size={17}/>{selectedRoute.destination_phone}</p>}{selectedRoute.notes&&<div className={styles.detailNotes}><b>{detailCopy.instructions}</b><span>{selectedRoute.notes}</span></div>}{selectedRoute.status==='completed'||selectedRoute.status==='issue'?<div className={styles.detailNotes}><b>{detailCopy.completion}</b>{selectedRoute.completed_at&&<span><Clock3 size={15}/> {detailCopy.completedAt}: {new Date(selectedRoute.completed_at).toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'})}</span>}{selectedRoute.arrived_at&&selectedRoute.completed_at&&<span><Clock3 size={15}/> {detailCopy.time}: {elapsedLabel(selectedRoute)}</span>}{selectedRoute.finalization_method==='issue'&&<span>{detailCopy.issue}{selectedRoute.finalization_issue?`: ${selectedRoute.finalization_issue}`:''}</span>}{evidencePreview.photo&&<img src={evidencePreview.photo} alt={detailCopy.photo} style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:12,marginTop:10}}/>}{evidencePreview.signature&&<img src={evidencePreview.signature} alt={detailCopy.signature} style={{width:'100%',maxHeight:140,objectFit:'contain',background:'#fff',borderRadius:12,marginTop:10}}/>}{selectedEvidence.map((evidence,index)=><span key={`${evidence.kind}-${index}`}>✓ {evidence.kind==='signature'?detailCopy.signature:evidence.kind==='photo'?detailCopy.photo:detailCopy.packing}</span>)}{selectedRoute.driver_note&&!receivedBy(selectedRoute)&&<span><FileText size={15}/> {selectedRoute.driver_note}</span>}{selectedRoute.finalization_note&&<span><FileText size={15}/> {selectedRoute.finalization_note}</span>}</div>:null}</div>}</section>}
    {modal&&<div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="issue-title"><button className={styles.close} aria-label={t.close} onClick={closeModal}><X/></button><div className={styles.modalDanger}><TriangleAlert/></div><h2 id="issue-title">{stopCopy.report}</h2><p>{locale==='es'?'Describe el problema de esta parada.':locale==='fr'?'Décrivez le problème pour cet arrêt.':'Describe the issue for this stop.'}</p><textarea autoFocus value={issueNote} onChange={event=>setIssueNote(event.target.value)} placeholder={t.reason}/><label className={styles.evidencePicker}><Camera size={17}/><span>{locale==='es'?'Foto opcional':locale==='fr'?'Photo facultative':'Optional photo'}</span><input type="file" accept="image/*" capture="environment" onChange={event=>setIssuePhoto(event.target.files?.[0]||null)}/></label>{issuePhoto&&<small className={styles.fileName}>{issuePhoto.name}</small>}<button className={styles.issueButton} disabled={!issueNote.trim()||busy} onClick={()=>void update('issue',issuePhoto||undefined)}>{t.saveIssue}</button></section></div>}
    {stopNoteOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="driver-note-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setStopNoteOpen(false)}><X/></button><div className={styles.modalIcon}><MessageSquare/></div><h2 id="driver-note-title">{stopCopy.addNote}</h2><p>{locale==='es'?'Esta nota queda registrada en la parada.':locale==='fr'?'Cette note est enregistrée sur l’arrêt.':'This note is saved on the stop.'}</p><textarea autoFocus value={stopNote} onChange={event=>setStopNote(event.target.value)} placeholder={t.notes}/><button className={styles.photoButton} disabled={!stopNote.trim()||busy} onClick={()=>void saveStopNote()}>{locale==='es'?'Guardar nota':locale==='fr'?'Enregistrer la note':'Save note'}</button></section></div>}
{recipientPromptOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="recipient-title"><button className={styles.close} aria-label={t.close} onClick={()=>{if(!busy){setRecipientError('');setRecipientPromptOpen(false)}}}><X/></button><div className={styles.modalIcon}><Check/></div><h2 id="recipient-title">{locale==='es'?'¿Quién recibió la entrega?':locale==='fr'?'Qui a reçu la livraison ?':'Who received the delivery?'}</h2><p>{locale==='es'?'Escribe el nombre de quien recibió. La foto, firma y nota son opcionales.':locale==='fr'?'Saisissez le nom du destinataire. Photo, signature et note sont facultatives.':'Enter the recipient name. Photo, signature and note are optional.'}</p>{recipientError&&<p className={styles.modalError} role="alert">{recipientError}</p>}<input autoFocus value={recipientName} onChange={event=>{setRecipientName(event.target.value);setRecipientError('')}} placeholder={locale==='es'?'Nombre de quien recibió':locale==='fr'?'Nom du destinataire':'Recipient name'} /><button className={styles.photoButton} disabled={!recipientName.trim()||busy} onClick={saveRecipientAndComplete}><Check/>{busy?(locale==='es'?'Guardando…':locale==='fr'?'Enregistrement…':'Saving…'):(locale==='es'?'Guardar y completar':locale==='fr'?'Enregistrer et terminer':'Save and complete')}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>{setRecipientError('');setRecipientPromptOpen(false)}}>{t.cancel}</button></section></div>}
    {signatureOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="signature-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setSignatureOpen(false)}><X/></button><div className={styles.modalIcon}><Signature/></div><h2 id="signature-title">{stopCopy.signature}</h2><p>{locale==='es'?'Pide al cliente que firme dentro del recuadro.':locale==='fr'?'Demandez au client de signer dans le cadre.':'Ask the customer to sign in the box.'}</p><canvas ref={signatureCanvas} className={styles.signaturePad} width={700} height={260} onPointerDown={beginSignature}/><div className={styles.signatureActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>signatureCanvas.current?.getContext('2d')?.clearRect(0,0,700,260)}>{locale==='es'?'Borrar':locale==='fr'?'Effacer':'Clear'}</button><button type="button" className={styles.photoButton} disabled={busy} onClick={()=>void saveCustomerSignatureProof()}>{locale==='es'?'Guardar firma':locale==='fr'?'Enregistrer la signature':'Save signature'}</button></div></section></div>}
    {finalizeOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="finalize-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setFinalizeOpen(false)}><X/></button><div className={styles.modalIcon}><ClipboardCheck/></div><h2 id="finalize-title">{stopCopy.completeRoute}?</h2><p>{locale==='es'?'Elige cómo deseas finalizar esta ruta.':locale==='fr'?'Choisissez comment terminer cet itinéraire.':'Choose how you want to finish this route.'}</p><button className={styles.photoButton} disabled={busy} onClick={()=>void finalizeRoute('normal')}><Check/>{stopCopy.completeRoute}</button><input ref={finalPhotoInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file)void finalizeRoute('photo',file)}}/><button className={styles.secondaryButton} disabled={busy} onClick={()=>finalPhotoInput.current?.click()}><Camera/>{locale==='es'?'Completar con foto':locale==='fr'?'Terminer avec photo':'Complete with Photo'}</button><button className={styles.issueLink} disabled={busy} onClick={()=>{setFinalizeOpen(false);setFinalizeIssueOpen(true)}}><TriangleAlert/>{stopCopy.report}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setFinalizeOpen(false)}>{t.cancel}</button></section></div>}
    {finalizeIssueOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="finalize-issue-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setFinalizeIssueOpen(false)}><div><X/></div></button><div className={styles.modalDanger}><TriangleAlert/></div><h2 id="finalize-issue-title">{stopCopy.report}</h2><p>{locale==='es'?'Registra el problema antes de cerrar la ruta.':locale==='fr'?'Enregistrez le problème avant de terminer l’itinéraire.':'Record the issue before closing this route.'}</p><select value={finalizeIssue} onChange={event=>setFinalizeIssue(event.target.value)}><option value="">{locale==='es'?'Selecciona un motivo':locale==='fr'?'Sélectionnez un motif':'Select a reason'}</option>{finalIssueOptions.map(option=><option key={option} value={option}>{option}</option>)}</select><textarea value={finalizeNote} onChange={event=>setFinalizeNote(event.target.value)} placeholder={locale==='es'?'Nota opcional':locale==='fr'?'Note facultative':'Optional note'}/><label className={styles.evidencePicker}><Camera size={17}/><span>{finalizeIssuePhoto?finalizeIssuePhoto.name:(locale==='es'?'Foto opcional':locale==='fr'?'Photo facultative':'Optional photo')}</span><input type="file" accept="image/*" capture="environment" onChange={event=>setFinalizeIssuePhoto(event.target.files?.[0]||null)}/></label><button className={styles.issueButton} disabled={!finalizeIssue||busy} onClick={()=>void finalizeRoute('issue',finalizeIssuePhoto||undefined)}>{locale==='es'?'Guardar problema y completar':locale==='fr'?'Enregistrer le problème et terminer':'Save issue and complete'}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setFinalizeIssueOpen(false)}>{t.cancel}</button></section></div>}
    {pickupConfirmOpen&&current&&currentKind==='pickup'&&<div className={styles.backdrop}><section className={styles.modal} role='dialog' aria-modal='true'><button className={styles.close} onClick={()=>!busy&&setPickupConfirmOpen(false)}><X/></button><div className={styles.modalIcon}><ClipboardCheck/></div><h2>Confirm pickup</h2><p>Confirm that you collected the materials for this PO.</p><div className={`${styles.detailNotes} ${styles.pickupPo}`}><small>PO / ORDER NUMBER</small><div/><strong>{current.order_number||'Not provided'}</strong></div><label className={styles.evidencePicker}><Camera size={18}/><span>{packingListFile?packingListFile.name:'Upload packing list (optional)'}</span><input ref={packingListInput} type='file' accept='image/*' capture='environment' onChange={event=>setPackingListFile(event.target.files?.[0]||null)}/></label><button className={styles.photoButton} style={{minHeight:64,fontSize:18}} disabled={busy} onClick={()=>void confirmPickupWithPackingList()}><ClipboardCheck/>Confirm pickup</button><button className={styles.secondaryButton} style={{width:'100%',minHeight:52}} disabled={busy} onClick={()=>setPickupConfirmOpen(false)}>{t.cancel}</button></section></div>}
    {dayPromptOpen&&membershipRole==='driver'&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="day-start-title"><div className={styles.modalIcon}><Play/></div><h2 id="day-start-title">Start your driving day</h2><p>You have <strong>{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length}</strong> route{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length===1?'':'s'} assigned for today.</p>{!locationConsentAccepted&&<div className={styles.locationConsent}><strong>{locationConsentCopy.title}</strong><p>{locationConsentCopy.body}</p><label className={styles.consentRow}><input type="checkbox" checked={locationConsentChecked} onChange={event=>setLocationConsentChecked(event.target.checked)}/><span>{locationConsentCopy.check}</span></label></div>}<button className={styles.photoButton} disabled={busy||(!locationConsentAccepted&&!locationConsentChecked)} onClick={()=>void beginDrivingDay()}><Play/>{busy?'Starting…':'Start day and share location'}</button><button className={styles.issueLink} disabled={busy} onClick={()=>{dayPromptSeenRef.current=true;setDayPromptOpen(false)}}>Not now</button></section></div>}
    <nav className={styles.driverNav} aria-label="Driver navigation"><button type="button" aria-current={!routeView?'page':undefined} onClick={returnToToday}><Home size={18}/><span>Today</span></button><button type="button" aria-current={routeView==='map'?'page':undefined} onClick={openRouteMap}><MapIcon size={18}/><span>Map</span></button><button type="button" aria-current={routeView==='queue'?'page':undefined} onClick={()=>setRouteView('queue')}><List size={18}/><span>Route</span></button><Link href="/driver/settings"><MoreHorizontal size={18}/><span>More</span></Link></nav>
    {deliveryToolsOpen&&currentKind==='delivery'&&<div className={styles.backdrop}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delivery-tools-title"><button className={styles.close} aria-label={t.close} onClick={()=>setDeliveryToolsOpen(false)}><X/></button><div className={styles.modalIcon}><ClipboardCheck/></div><h2 id="delivery-tools-title">Complete delivery</h2><p>Add proof if needed, then finish this delivery.</p><div className={styles.deliveryTools}><button className={styles.toolButton} onClick={()=>fileInput.current?.click()}><Camera/><span>{current?.completion_photo_path?'Photo added':'Take photo'}</span></button><button className={styles.toolButton} onClick={()=>{setDeliveryToolsOpen(false);setSignatureOpen(true)}}><Signature/><span>Customer signature</span></button><button className={styles.toolButton} onClick={()=>{setDeliveryToolsOpen(false);setStopNoteOpen(true)}}><MessageSquare/><span>Add note</span></button><button className={styles.toolButton} onClick={()=>{setDeliveryToolsOpen(false);setModal(true)}}><TriangleAlert/><span>Report issue</span></button></div><button className={styles.photoButton} disabled={busy} onClick={()=>{setDeliveryToolsOpen(false);void completeDelivery()}}><Check/>{stopCopy.completeDelivery}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setDeliveryToolsOpen(false)}>{t.cancel}</button></section></div>}
  </main>
}
