'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import {useCallback, useEffect, useRef, useState} from 'react'
import {ArrowLeft, Camera, Check, ChevronRight, CircleUserRound, ClipboardCheck, History as HistoryIcon, Home, List, MapPin, MessageSquare, Pause, Phone, Play, RotateCcw, Signature, TriangleAlert, X} from 'lucide-react'
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
import type {Role} from '../../lib/types'
import NotificationBell from '../notification-bell'
import styles from './driver.module.css'
const LiveRouteMap=dynamic(()=>import('../live-route-map'),{ssr:false})
const RoutePlanMap=dynamic(()=>import('../route-plan-map'),{ssr:false})

type Mission = {id:string;company_id:string;branch_id:string|null;driver_id:string;route_date:string;status:'draft'|'pending'|'published'|'active'|'paused'|'completed'|'issue'|'cancelled';origin_address?:string;destination_address?:string;destination_name?:string;destination_phone?:string;priority?:string;notes?:string;driver_note?:string;position:number;mission_type?:string;order_number?:string;scheduled_at?:string;completed_at?:string;arrived_at?:string;customer_signature_path?:string;completion_photo_path?:string;finalized_at?:string;finalization_method?:string;finalization_note?:string;finalization_issue?:string;finalization_photo_path?:string}
type SavedContact = {company_name?:string|null;contact_name?:string|null;address?:string|null;phone?:string|null}

const addressKey=(value?:string|null)=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'')

const errorMessage=(error:unknown,fallback:string)=>{
  if(error instanceof Error&&error.message)return error.message
  if(error&&typeof error==='object'&&'message' in error&&typeof error.message==='string'&&error.message)return error.message
  return fallback
}

export default function Driver() {
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
  const [signatureOpen,setSignatureOpen]=useState(false)
  const [finalizeOpen,setFinalizeOpen]=useState(false)
  const [finalizeIssueOpen,setFinalizeIssueOpen]=useState(false)
  const [finalizeIssue,setFinalizeIssue]=useState('')
  const [finalizeNote,setFinalizeNote]=useState('')
  const [finalizeIssuePhoto,setFinalizeIssuePhoto]=useState<File|null>(null)
  const [driverId,setDriverId]=useState('')
  const [membershipRole,setMembershipRole]=useState<Role|null>(null)
  const [drivingSession,setDrivingSession]=useState<DrivingSession|null>(null)
  const [autoCloseTime,setAutoCloseTime]=useState('18:00')
  const [clockNow,setClockNow]=useState(()=>Date.now())
  const [evidencePreview,setEvidencePreview]=useState<{photo?:string;signature?:string}>({})
  const [locationStatus,setLocationStatus]=useState('')
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [routeView,setRouteView]=useState<'queue'|'details'|'map'|null>(null)
  const [selectedRouteId,setSelectedRouteId]=useState<string | null>(null)
  const [dayPromptOpen,setDayPromptOpen]=useState(false)
  const [pickupConfirmOpen,setPickupConfirmOpen]=useState(false) // centered, address-only arrival confirmation
  const [packingListFile,setPackingListFile]=useState<File|null>(null)
  const packingListInput=useRef<HTMLInputElement>(null)
  const dayPromptSeenRef=useRef(false)
  const autoClosingDayRef=useRef(false)
  const fileInput=useRef<HTMLInputElement>(null)
  const finalPhotoInput=useRef<HTMLInputElement>(null)
  const signatureCanvas=useRef<HTMLCanvasElement>(null)
  const {t,locale}=useLocale()
  useEffect(()=>{const timer=window.setInterval(()=>setClockNow(Date.now()),60_000);return()=>window.clearInterval(timer)},[])

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
        .select('id,company_id,branch_id,driver_id,route_date,status,origin_address,destination_address,destination_name,destination_phone,priority,notes,driver_note,position,mission_type,order_number,scheduled_at,completed_at,arrived_at,customer_signature_path,completion_photo_path,finalized_at,finalization_method,finalization_note,finalization_issue,finalization_photo_path')
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
    const loadEvidence=async()=>{
      setEvidencePreview({})
      if(!selectedRoute?.customer_signature_path&&!selectedRoute?.completion_photo_path)return
      const storage=getSupabase().storage.from('route-evidence')
      const [photo,signature]=await Promise.all([selectedRoute.completion_photo_path?storage.createSignedUrl(selectedRoute.completion_photo_path,900):Promise.resolve({data:null}),selectedRoute.customer_signature_path?storage.createSignedUrl(selectedRoute.customer_signature_path,900):Promise.resolve({data:null})])
      if(!cancelled)setEvidencePreview({photo:photo.data?.signedUrl,signature:signature.data?.signedUrl})
    }
    void loadEvidence()
    return()=>{cancelled=true}
  },[selectedRoute?.id,selectedRoute?.completion_photo_path,selectedRoute?.customer_signature_path])
  const dayRoutes=missions.filter(route=>route.driver_id===driverId&&route.route_date===today&&route.status!=='cancelled').slice().sort((left,right)=>{
    const rank=(status:string)=>status==='completed'||status==='issue'?2:status==='active'||status==='paused'?0:1
    return rank(left.status)-rank(right.status)||left.position-right.position||(left.completed_at||'').localeCompare(right.completed_at||'')
  })
  const dayMapOrigin=dayRoutes[0]?.origin_address||current?.origin_address
  const dayMapStops=dayRoutes.map(route=>({id:route.id,address:route.destination_address,label:route.destination_name||route.destination_address}))
  const currentKind=stopKind(current?.mission_type)
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

  // iOS keeps `position: fixed` dialogs sized to the layout viewport while
  // its keyboard uses the smaller visual viewport. Keep every driver form in
  // the actually visible space so textareas never sit behind the keyboard.
  useEffect(()=>{
    const viewport=window.visualViewport
    if(!viewport)return
    const syncViewportHeight=()=>document.documentElement.style.setProperty('--rh-driver-viewport-height',`${Math.round(viewport.height)}px`)
    syncViewportHeight()
    viewport.addEventListener('resize',syncViewportHeight)
    viewport.addEventListener('scroll',syncViewportHeight)
    return()=>{
      viewport.removeEventListener('resize',syncViewportHeight)
      viewport.removeEventListener('scroll',syncViewportHeight)
      document.documentElement.style.removeProperty('--rh-driver-viewport-height')
    }
  },[])

  useEffect(()=>{
    const client=getSupabase()
    let disposed=false
    let channel:ReturnType<typeof client.channel>|undefined
    const refresh=()=>{if(!disposed)void load()}
    void client.auth.getUser().then(({data})=>{
      if(disposed||!data.user)return
      channel=client.channel(`driver-routes-${data.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`driver_id=eq.${data.user.id}`},refresh).subscribe()
    })
    refresh()
    const timer=setInterval(refresh,10000)
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh()}
    window.addEventListener('focus',refresh)
    document.addEventListener('visibilitychange',onVisibility)
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',onVisibility);if(channel)void client.removeChannel(channel)}
  },[load])

  useEffect(()=>{
    if(!drivingSession||!driverId||typeof navigator==='undefined'||!navigator.geolocation)return
    let disposed=false
    const sendLocation=async()=>{
      try{
        // Only the driver's explicit Start route action can request location.
        // The five-minute sample never reopens a permission prompt.
        const permission=await getLocationPermission()
        if(permission!=='granted'){
          if(permission==='denied'&&!disposed)setLocationStatus(t.locationPermissionDenied)
          return
        }
        const location=await getCurrentLocation({maximumAge:4*60*1000})
        if(disposed)return
        const result=await updateDrivingLocation(drivingSession.id,driverId,location)
        if(result.error)throw result.error
        setLocationStatus('')
      }catch(error){if(!disposed)setLocationStatus(error instanceof Error?error.message:t.locationPermissionDenied)}
    }
    // Location is intentionally sampled, rather than continuously watched:
    // one update now and one every five minutes during an active driving day.
    // Safari may suspend a PWA in the background; the manager then sees the
    // genuine last-updated time instead of a fabricated moving location.
    void sendLocation()
    const interval=window.setInterval(()=>void sendLocation(),5*60*1000)
    return()=>{disposed=true;window.clearInterval(interval)}
  },[driverId,drivingSession,t.locationPermissionDenied])

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

  const navigateUrl=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current?.destination_address||'')}&travelmode=driving`
  const openGoogleMaps=()=>{
    const destination=current?.destination_address?.trim()
    if(!destination){window.location.assign(navigateUrl);return}
    const encodedDestination=encodeURIComponent(destination)
    const userAgent=navigator.userAgent||''
    const isAppleDevice=/iPad|iPhone|iPod/.test(userAgent)
    const isAndroid=/Android/i.test(userAgent)
    if(!isAppleDevice&&!isAndroid){window.location.assign(navigateUrl);return}

    // Prefer the installed Google Maps app. If it is unavailable, return to
    // the standard Google Maps directions page instead of leaving the driver
    // on a blank custom-scheme URL.
    const appUrl=isAppleDevice
      ? `comgooglemaps://?daddr=${encodedDestination}&directionsmode=driving`
      : `google.navigation:q=${encodedDestination}&mode=d`
    let openedNativeApp=false
    let fallbackTimer:number|undefined
    const cancelFallback=()=>{
      openedNativeApp=true
      if(fallbackTimer)window.clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange',onVisibilityChange)
      window.removeEventListener('pagehide',cancelFallback)
    }
    const onVisibilityChange=()=>{if(document.visibilityState==='hidden')cancelFallback()}
    document.addEventListener('visibilitychange',onVisibilityChange)
    window.addEventListener('pagehide',cancelFallback,{once:true})
    window.location.href=appUrl
    fallbackTimer=window.setTimeout(()=>{
      document.removeEventListener('visibilitychange',onVisibilityChange)
      window.removeEventListener('pagehide',cancelFallback)
      if(!openedNativeApp)window.location.assign(navigateUrl)
    },1200)
  }
  const startTrackingForActiveRoute=async()=>{
    if(!driverId||!current)return false
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
  const attachStopPhoto=async(file:File)=>{if(!current||busy)return;setBusy(true);try{await uploadMissionEvidence(file,current.id);setMessage(locale==='es'?'Foto guardada.':locale==='fr'?'Photo enregistrée.':'Photo saved.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const completeCurrentStop=async()=>{if(!current||busy)return;setBusy(true);try{if(currentKind==='pickup'&&!current.arrived_at)throw Error('Record arrival before completing this stop.');if((currentKind==='branch'||currentKind==='delivery')&&!current.arrived_at){const{error:arrivalError}=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null);if(arrivalError)throw arrivalError}let location:Awaited<ReturnType<typeof getCurrentLocation>>|undefined;try{location=await getCurrentLocation({maximumAge:60_000});if(drivingSession)await updateDrivingLocation(drivingSession.id,driverId,location)}catch{}await completeMission(current.id,location);setModal(false);setRecipientPromptOpen(false);setRecipientName('');setIssueNote('');setIssuePhoto(null);setMessage(locale==='es'?'Parada completada.':locale==='fr'?'Arrêt terminé.':'Stop completed.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const completeDelivery=()=>{
    if(!current||currentKind!=='delivery'||busy)return
    const hasProof=Boolean(current.customer_signature_path||current.completion_photo_path||current.driver_note?.trim())
    if(!hasProof){setRecipientPromptOpen(true);return}
    void completeCurrentStop()
  }
  const saveRecipientAndComplete=async()=>{
    if(!current||!recipientName.trim()||busy)return
    setBusy(true)
    try{
      const {error}=await getSupabase().from('routes').update({driver_note:`Received by: ${recipientName.trim()}`,updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId)
      if(error)throw error
      setRecipientPromptOpen(false)
      setRecipientName('')
      setBusy(false)
      await completeCurrentStop()
    }catch(error){setMessage(errorMessage(error,t.unableUpdateRoute));setBusy(false)}
  }
  const saveStopNote=async()=>{if(!current||busy||!stopNote.trim())return;setBusy(true);try{const {error}=await getSupabase().from('routes').update({driver_note:stopNote.trim(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId);if(error)throw error;setStopNote('');setStopNoteOpen(false);setMessage(locale==='es'?'Nota guardada.':locale==='fr'?'Note enregistrée.':'Note saved.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const saveSignatureAndComplete=async()=>{if(!current||busy||!signatureCanvas.current)return;setBusy(true);try{await saveCustomerSignature(signatureCanvas.current,{companyId:current.company_id,userId:driverId,missionId:current.id});if(!current.arrived_at){const{error:arrivalError}=await getSupabase().from('routes').update({arrived_at:new Date().toISOString(),updated_version:Date.now()}).eq('id',current.id).eq('driver_id',driverId).is('arrived_at',null);if(arrivalError)throw arrivalError}setSignatureOpen(false);setMessage(locale==='es'?'Firma guardada.':locale==='fr'?'Signature enregistrée.':'Signature saved.');let location:Awaited<ReturnType<typeof getCurrentLocation>>|undefined;try{location=await getCurrentLocation({maximumAge:60_000});if(drivingSession)await updateDrivingLocation(drivingSession.id,driverId,location)}catch{}await completeMission(current.id,location);await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const finalizeRoute=async(method:'normal'|'photo'|'issue',file?:File)=>{if(!finalStop||busy)return;setBusy(true);try{let photoPath:string|undefined;if(file){const evidence=await uploadMissionEvidence(file,finalStop.id,{kind:method==='issue'?'issue':'finalization',attachAsCompletionPhoto:false});photoPath=evidence.path}const {data,error}=await getSupabase().from('routes').update({finalized_at:new Date().toISOString(),finalization_method:method,finalization_note:finalizeNote.trim()||null,finalization_issue:method==='issue'?finalizeIssue||'Other':null,finalization_photo_path:photoPath||null,updated_version:Date.now()}).eq('id',finalStop.id).eq('driver_id',driverId).is('finalized_at',null).select('id').maybeSingle();if(error)throw error;if(!data)throw Error('This route was already completed.');setFinalizeOpen(false);setFinalizeIssueOpen(false);setFinalizeIssue('');setFinalizeNote('');setFinalizeIssuePhoto(null);setMessage(locale==='es'?'Ruta completada.':locale==='fr'?'Itinéraire terminé.':'Route completed.');await load()}catch(error){setMessage(errorMessage(error,t.unableUpdateRoute))}finally{setBusy(false)}}
  const startRoute=async()=>{
    // Do not use window.open here: Safari and installed PWAs can treat it as
    // a pop-up and ignore the driver's tap. A same-tab navigation is reliable
    // and lets the device hand the URL to Google Maps when it is installed.
    const saved=current?.status==='active'
      ? (drivingSession ? true : await startTrackingForActiveRoute())
      : await update('active')
    if(!saved)return
    setMessage(t.inProgress)
    openGoogleMaps()
  }
  const closeModal=()=>{if(busy)return;setModal(false);setIssueNote('');setIssuePhoto(null)}
  const beginSignature=(event:React.PointerEvent<HTMLCanvasElement>)=>{const canvas=signatureCanvas.current;if(!canvas)return;canvas.setPointerCapture(event.pointerId);const rect=canvas.getBoundingClientRect();const context=canvas.getContext('2d');if(!context)return;context.lineWidth=3;context.lineCap='round';context.strokeStyle='#14233b';context.beginPath();context.moveTo((event.clientX-rect.left)*(canvas.width/rect.width),(event.clientY-rect.top)*(canvas.height/rect.height));const move=(moveEvent:PointerEvent)=>{context.lineTo((moveEvent.clientX-rect.left)*(canvas.width/rect.width),(moveEvent.clientY-rect.top)*(canvas.height/rect.height));context.stroke()};const stop=()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',stop);canvas.removeEventListener('pointercancel',stop)};canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop)}

  return <main className={`app ${styles.page}`}>
    <header className={styles.header}><div className={styles.brand}><Image src="/routehub-driver-new.jpg" alt="RouteHub Driver" width={48} height={48} priority/><strong>RouteHub</strong></div><NotificationBell /></header><div className={styles.workspaceHeading}><span className={styles.workspace}>{t.driverWorkspace}</span><h1>{t.routes}</h1></div>
    {membershipRole==='driver'&&<div className={styles.drivingBar}>{drivingSession?<><span className={styles.locationLive}><i/>{t.locationSharing}</span><button className={styles.endDay} disabled={busy} onClick={()=>void finishDrivingDay()}>{t.endDrivingDay}</button></>:<button className={styles.startDay} disabled={busy} onClick={()=>void beginDrivingDay()}><Play size={16}/>{t.startDrivingDay}</button>}</div>}
    {temporaryExecution&&drivingSession&&<div className={styles.drivingBar}><span className={styles.locationLive}><i/>{temporaryLabel}</span></div>}
    {locationStatus&&<div className={styles.toast} role="status">{locationStatus}</div>}
    {message&&<div className={styles.toast} role="status">{message}</div>}
    {loadError&&<div className={styles.loadError} role="status"><span>{loadError}</span><button disabled={loading} onClick={()=>void load()}>{t.retry || 'Retry'}</button></div>}
    {loading&&!missions.length?<section className={`${styles.loading} card`} aria-busy="true"><span/><span/><span/></section>:current?<>
      <section className={styles.routeHero}>
      <section className={styles.mission}>
        <div className={styles.missionTop}><span>{isPastRoute?'PAST DUE':t.currentRoute}</span><span className={current.priority==='urgent'?styles.urgent:styles.priority}>{isPastRoute?'PENDING':current.priority==='urgent'?`⚠ ${t.urgent}`:current.priority||t.normal}</span></div>
        <div className={styles.type}>{currentStopLabel}</div>
        <h2>{routeLabel(current)}</h2>
        <p className={styles.address}><MapPin size={18}/>{current.destination_address||t.destination}</p>
        {currentKind==='pickup'&&<div className={`${styles.details} ${styles.singleDetail}`}><div><small>{routeMetaCopy.po}</small><strong>{current.order_number||'—'}</strong></div></div>}
        {currentKind==='delivery'&&currentPhone&&<div className={`${styles.details} ${styles.singleDetail}`}><a className={styles.contactCall} href={`tel:${currentPhone}`}><Phone size={17}/><span><small>{routeMetaCopy.call}</small><strong>{currentContact?.contact_name||currentContact?.company_name||routeLabel(current)}</strong></span></a></div>}
        {current.notes&&<div className={styles.notes}><TriangleAlert size={18}/><span><b>{currentKind==='delivery'?routeMetaCopy.instructions:'NOTES'}</b>{current.notes}</span></div>}
      </section>
      <LiveRouteMap originAddress={current.origin_address} destinationAddress={current.destination_address} driverLocation={drivingSession?.last_lat!=null&&drivingSession?.last_lng!=null?{lat:drivingSession.last_lat,lng:drivingSession.last_lng}:null} driverUpdatedAt={drivingSession?.last_updated_at} title="Ruta en vivo" showHeader={false} showLocationUpdated={false} interactive={false} locale={locale}/>
      </section>
      <div className={styles.primaryActions}>
        {['published','pending'].includes(current.status)&&<button disabled={busy} className={styles.start} onClick={()=>void startRoute()}><Play size={19}/>{t.start}</button>}
        {current.status==='active'&&currentKind!=='delivery'&&currentAction==='arrived'&&<button disabled={busy} className={styles.complete} onClick={()=>{if(currentKind==='pickup')setPickupConfirmOpen(true);else void markArrived()}}><MapPin size={19}/>{stopCopy.arrived}</button>}
        {current.status==='active'&&(currentKind==='delivery'||currentAction!=='arrived')&&<button disabled={busy} className={styles.complete} onClick={()=>{if(currentKind==='delivery')void completeDelivery();else void completeCurrentStop()}}><Check size={19}/>{currentKind==='delivery'?stopCopy.completeDelivery:currentAction==='confirm_pickup'?stopCopy.confirmPickup:stopCopy.completeBranch}</button>}
        {current.status==='active'&&<button disabled={busy} className={styles.viewRoute} onClick={()=>setRouteView('map')}><MapPin size={18}/>{stopCopy.openMaps}</button>}
        {current.status==='paused'&&<button disabled={busy} className={styles.start} onClick={()=>void update('active')}><RotateCcw size={19}/>{t.resume}</button>}
      </div>
      {current.status==='active'&&currentKind!=='branch'&&(currentKind==='delivery'||currentAction!=='arrived')&&<div className={styles.secondaryActions}><button disabled={busy} onClick={()=>fileInput.current?.click()}><Camera size={18}/>{stopCopy.takePhoto}</button>{currentKind==='delivery'&&<button disabled={busy} onClick={()=>setSignatureOpen(true)}><Signature size={18}/>{stopCopy.signature}</button>}<button disabled={busy} onClick={()=>setStopNoteOpen(true)}><MessageSquare size={18}/>{stopCopy.addNote}</button><button disabled={busy} onClick={()=>setModal(true)}><TriangleAlert size={18}/>{stopCopy.report}</button></div>}
      <input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file)void attachStopPhoto(file)}}/>
    </>:completionCandidate&&finalStop?<section className={`card ${styles.finishRoute}`}><ClipboardCheck/><h2>{stopCopy.completeRoute}</h2><p>{locale==='es'?'Todos los stops requeridos están completados. Revisa y confirma cómo deseas cerrar la ruta.':locale==='fr'?'Tous les arrêts requis sont terminés. Vérifiez et confirmez la fin de l’itinéraire.':'All required stops are complete. Review and confirm how you want to finish the route.'}</p><button className={styles.complete} disabled={busy} onClick={()=>setFinalizeOpen(true)}><Check size={19}/>{stopCopy.completeRoute}</button></section>:<section className={`card ${styles.empty}`}><MapPin/><h2>{t.noRoute}</h2><p>{t.noRoutesAssignedToday || t.noRouteHelp}</p>{temporaryExecution&&<Link className="primary" href={homeHref}>{locale==='es'?'Volver al espacio de trabajo':locale==='fr'?`Retour à l'espace de travail`:'Return to workspace'}</Link>}</section>}
      {routeView&&current&&<section className={styles.routeOverlay} aria-label="Route details">
      <header className={styles.routeOverlayHeader}><button type="button" onClick={()=>routeView==='details'?setRouteView('queue'):setRouteView(null)} aria-label="Back"><ArrowLeft size={20}/></button><strong>{routeView==='details'?'Stop details':'Route'}</strong><span /></header>
      {routeView==='queue'||routeView==='map'?<><div className={styles.routeTabs}><button className={routeView==='queue'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('queue')}>Stops</button><button className={routeView==='map'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('map')}>Map</button></div>{routeView==='queue'?<div className={styles.stopList}>{dayRoutes.map((route,index)=><button type="button" className={styles.stopRow} key={route.id} onClick={()=>{setSelectedRouteId(route.id);setRouteView('details')}}><span className={styles.stopNumber}>{index+1}</span><span><strong>{routeLabel(route)}</strong><small>{(route.mission_type||'delivery').toUpperCase()} · {route.status==='completed'?t.completed:route.status==='active'?'Current · Open map':route.scheduled_at?new Date(route.scheduled_at).toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'}):'Upcoming'}{route.status==='active'&&elapsedLabel(route)?` · ${elapsedLabel(route)}`:''}</small></span><ChevronRight size={18}/></button>)}</div>:<RoutePlanMap locale={locale} originAddress={dayMapOrigin} stops={dayMapStops}/>}</>:selectedRoute&&<div className={styles.stopDetails}><span className={styles.stopNumber}>{selectedRoute.position}</span><h2>{routeLabel(selectedRoute)}</h2><p><MapPin size={17}/>{selectedRoute.destination_address||t.destination}</p><div className={styles.detailDivider}/><small>{(selectedRoute.mission_type||'delivery').toUpperCase()}</small><strong>{selectedRoute.status==='active'?'Current stop · Open map':selectedRoute.status==='completed'?t.completed:'Upcoming stop'}</strong>{selectedRoute.status==='active'&&<button type="button" className={styles.viewRoute} onClick={()=>setRouteView('map')}>Open map{elapsedLabel(selectedRoute)?` · ${elapsedLabel(selectedRoute)}`:''}</button>}{selectedRoute.status==='completed'&&<div className={styles.detailNotes}><b>Completion details</b><span>{selectedRoute.driver_note?.startsWith('Received by:')?selectedRoute.driver_note:''}{selectedRoute.customer_signature_path?'✓ Customer signature ':''}{selectedRoute.completion_photo_path?'✓ Photo ':''}{selectedRoute.finalization_method==='issue'?'⚠ Issue reported ':''}{selectedRoute.finalization_note||''}</span>{evidencePreview.photo&&<img src={evidencePreview.photo} alt="Completion photo" style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:12,marginTop:10}}/>}{evidencePreview.signature&&<img src={evidencePreview.signature} alt="Customer signature" style={{width:'100%',maxHeight:140,objectFit:'contain',background:'#fff',borderRadius:12,marginTop:10}}/>}{selectedRoute.arrived_at&&selectedRoute.completed_at&&<small>Time on route: {elapsedLabel(selectedRoute)} </small>}</div>}{selectedRoute.notes&&<p className={styles.detailNotes}>{selectedRoute.notes}</p>}</div>}</section>}
    {modal&&<div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="issue-title"><button className={styles.close} aria-label={t.close} onClick={closeModal}><X/></button><div className={styles.modalDanger}><TriangleAlert/></div><h2 id="issue-title">{stopCopy.report}</h2><p>{locale==='es'?'Describe el problema de esta parada.':locale==='fr'?'Décrivez le problème pour cet arrêt.':'Describe the issue for this stop.'}</p><textarea autoFocus value={issueNote} onChange={event=>setIssueNote(event.target.value)} placeholder={t.reason}/><label className={styles.evidencePicker}><Camera size={17}/><span>{locale==='es'?'Foto opcional':locale==='fr'?'Photo facultative':'Optional photo'}</span><input type="file" accept="image/*" capture="environment" onChange={event=>setIssuePhoto(event.target.files?.[0]||null)}/></label>{issuePhoto&&<small className={styles.fileName}>{issuePhoto.name}</small>}<button className={styles.issueButton} disabled={!issueNote.trim()||busy} onClick={()=>void update('issue',issuePhoto||undefined)}>{t.saveIssue}</button></section></div>}
    {stopNoteOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="driver-note-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setStopNoteOpen(false)}><X/></button><div className={styles.modalIcon}><MessageSquare/></div><h2 id="driver-note-title">{stopCopy.addNote}</h2><p>{locale==='es'?'Esta nota queda registrada en la parada.':locale==='fr'?'Cette note est enregistrée sur l’arrêt.':'This note is saved on the stop.'}</p><textarea autoFocus value={stopNote} onChange={event=>setStopNote(event.target.value)} placeholder={t.notes}/><button className={styles.photoButton} disabled={!stopNote.trim()||busy} onClick={()=>void saveStopNote()}>{locale==='es'?'Guardar nota':locale==='fr'?'Enregistrer la note':'Save note'}</button></section></div>}
    {recipientPromptOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="recipient-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setRecipientPromptOpen(false)}><X/></button><div className={styles.modalIcon}><Check/></div><h2 id="recipient-title">{locale==='es'?'¿Quién recibió la entrega?':locale==='fr'?'Qui a reçu la livraison ?':'Who received the delivery?'}</h2><p>{locale==='es'?'Añade una firma, foto, nota o el nombre de quien recibió antes de completar.':locale==='fr'?'Ajoutez une signature, une photo, une note ou le nom du destinataire avant de terminer.':'Add a signature, photo, note, or the recipient name before completing this delivery.'}</p><input autoFocus value={recipientName} onChange={event=>setRecipientName(event.target.value)} placeholder={locale==='es'?'Nombre de quien recibió':locale==='fr'?'Nom du destinataire':'Recipient name'} /><button className={styles.photoButton} disabled={!recipientName.trim()||busy} onClick={()=>void saveRecipientAndComplete()}><Check/>{locale==='es'?'Guardar y completar':locale==='fr'?'Enregistrer et terminer':'Save and complete'}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setRecipientPromptOpen(false)}>{t.cancel}</button></section></div>}
    {signatureOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="signature-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setSignatureOpen(false)}><X/></button><div className={styles.modalIcon}><Signature/></div><h2 id="signature-title">{stopCopy.signature}</h2><p>{locale==='es'?'Pide al cliente que firme dentro del recuadro.':locale==='fr'?'Demandez au client de signer dans le cadre.':'Ask the customer to sign in the box.'}</p><canvas ref={signatureCanvas} className={styles.signaturePad} width={700} height={260} onPointerDown={beginSignature}/><div className={styles.signatureActions}><button type="button" className={styles.secondaryButton} disabled={busy} onClick={()=>signatureCanvas.current?.getContext('2d')?.clearRect(0,0,700,260)}>{locale==='es'?'Borrar':locale==='fr'?'Effacer':'Clear'}</button><button type="button" className={styles.photoButton} disabled={busy} onClick={()=>void saveSignatureAndComplete()}>{locale==='es'?'Guardar y completar':locale==='fr'?'Enregistrer et terminer':'Save and complete'}</button></div></section></div>}
    {finalizeOpen&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="finalize-title"><button className={styles.close} aria-label={t.close} onClick={()=>!busy&&setFinalizeOpen(false)}><X/></button><div className={styles.modalIcon}><ClipboardCheck/></div><h2 id="finalize-title">{stopCopy.completeRoute}?</h2><p>{locale==='es'?'Elige cómo deseas finalizar esta ruta.':locale==='fr'?'Choisissez comment terminer cet itinéraire.':'Choose how you want to finish this route.'}</p><button className={styles.photoButton} disabled={busy} onClick={()=>void finalizeRoute('normal')}><Check/>{stopCopy.completeRoute}</button><input ref={finalPhotoInput} hidden type="file" accept="image/*" capture="environment" onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';if(file)void finalizeRoute('photo',file)}}/><button className={styles.secondaryButton} disabled={busy} onClick={()=>finalPhotoInput.current?.click()}><Camera/>{locale==='es'?'Completar con foto':locale==='fr'?'Terminer avec photo':'Complete with Photo'}</button><button className={styles.issueLink} disabled={busy} onClick={()=>setFinalizeIssueOpen(true)}><TriangleAlert/>{stopCopy.report}</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setFinalizeOpen(false)}>{t.cancel}</button></section></div>}
    {pickupConfirmOpen&&current&&currentKind==='pickup'&&<div className={styles.backdrop}><section className={styles.modal} role='dialog' aria-modal='true'><button className={styles.close} onClick={()=>setPickupConfirmOpen(false)}><X/></button><div className={styles.modalIcon}><ClipboardCheck/></div><h2>Confirm pickup</h2><p>Confirm that you collected the materials for this PO.</p><div className={styles.detailNotes}><small>PO / ORDER NUMBER</small><strong style={{fontSize:30}}>{current.order_number||'Not provided'}</strong></div><label className={styles.evidencePicker}><Camera size={18}/><span>{packingListFile?packingListFile.name:'Upload packing list (optional)'}</span><input ref={packingListInput} type='file' accept='image/*,.pdf' onChange={event=>setPackingListFile(event.target.files?.[0]||null)}/></label><button className={styles.photoButton} style={{minHeight:64,fontSize:18}} disabled={busy} onClick={async()=>{if(packingListFile)await uploadMissionEvidence(packingListFile,current.id,{kind:'photo',attachAsCompletionPhoto:false});setPackingListFile(null);setPickupConfirmOpen(false);await markArrived()}}><ClipboardCheck/>Confirm pickup</button><button className={styles.secondaryButton} disabled={busy} onClick={()=>setPickupConfirmOpen(false)}>{t.cancel}</button></section></div>}
    {dayPromptOpen&&membershipRole==='driver'&&<div className={styles.backdrop} role="presentation"><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="day-start-title"><div className={styles.modalIcon}><Play/></div><h2 id="day-start-title">Start your driving day</h2><p>You have <strong>{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length}</strong> route{missions.filter(item=>['published','pending','active','paused'].includes(item.status)).length===1?'':'s'} assigned for today.</p><button className={styles.photoButton} disabled={busy} onClick={()=>void beginDrivingDay()}><Play/>{busy?'Starting…':'Start day and share location'}</button><button className={styles.issueLink} disabled={busy} onClick={()=>{dayPromptSeenRef.current=true;setDayPromptOpen(false)}}>Not now</button></section></div>}
    {routeView&&!current&&<section className={styles.routeOverlay} aria-label="Route summary"><header className={styles.routeOverlayHeader}><button type="button" onClick={()=>setRouteView(null)} aria-label="Back"><ArrowLeft size={20}/></button><strong>Route</strong><span /></header><div className={styles.routeTabs}><button className={routeView==='queue'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('queue')}>Stops</button><button className={routeView==='map'?styles.routeTabActive:''} type="button" onClick={()=>setRouteView('map')}>Map</button></div>{!dayRoutes.length?<div className={styles.empty}><List size={24}/><h2>{t.noRoutesToday}</h2><p>{t.createRouteWhenReady}</p></div>:routeView==='queue'?<div className={styles.stopList}>{dayRoutes.map((route,index)=><div className={styles.stopRow} key={route.id}><span className={styles.stopNumber}>{index+1}</span><span><strong>{routeLabel(route)}</strong><small>{(route.mission_type||'delivery').toUpperCase()} · {route.status==='completed'?t.completed:'Scheduled'}</small></span></div>)}</div>:<RoutePlanMap locale={locale} originAddress={dayMapOrigin} stops={dayMapStops}/>}</section>}
    {!routeView&&<nav className={styles.driverNav} aria-label="Driver navigation"><button type="button" aria-current="page" onClick={()=>setRouteView(null)}><Home size={18}/><span>Today</span></button><button type="button" onClick={()=>setRouteView('queue')}><List size={18}/><span>Route</span></button><Link href="/driver/history"><HistoryIcon size={18}/><span>{t.history}</span></Link><Link href="/driver/settings"><CircleUserRound size={18}/><span>Profile</span></Link></nav>}
  </main>
}
