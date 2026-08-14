'use client'

import Link from 'next/link'
import {ArrowRight, PackageCheck, Route as RouteIcon} from 'lucide-react'
import {useCallback, useEffect, useState} from 'react'
import {currentMembership} from '../lib/data'
import {operationalDate} from '../lib/driver-queue'
import {getSupabase} from '../lib/supabase'
import {useLocale} from '../lib/use-preferences'
import styles from './temporary-route-assignments.module.css'

type AssignedRoute={id:string;mission_type:string|null;destination_name:string|null;destination_address:string|null;status:string;position:number}

export default function TemporaryRouteAssignments(){
  const {locale}=useLocale()
  const [routes,setRoutes]=useState<AssignedRoute[]>([])
  const [userId,setUserId]=useState('')
  const [error,setError]=useState('')
  const copy=locale==='es'
    ?{eyebrow:'TRABAJO ASIGNADO',title:'Tus rutas asignadas',help:'Abre la ruta para recoger o entregar sin cambiar tu rol.',open:'Abrir ruta',pickup:'Recogida',delivery:'Entrega'}
    :locale==='fr'
      ?{eyebrow:'TRAVAIL ASSIGNÉ',title:'Vos itinéraires assignés',help:'Ouvrez un itinéraire sans changer votre rôle.',open:'Ouvrir',pickup:'Collecte',delivery:'Livraison'}
      :{eyebrow:'ASSIGNED WORK',title:'Your assigned routes',help:'Open a pickup or delivery without changing your role.',open:'Open route',pickup:'Pickup',delivery:'Delivery'}

  const load=useCallback(async()=>{
    try{
      const client=getSupabase()
      const {data:userData}=await client.auth.getUser()
      if(!userData.user)return
      const membership=await currentMembership()
      setUserId(userData.user.id)
      if(membership.role==='driver'){setRoutes([]);return}
      const {data,error:queryError}=await client.from('routes')
        .select('id,mission_type,destination_name,destination_address,status,position')
        .eq('company_id',membership.company_id)
        .eq('driver_id',userData.user.id)
        .eq('route_date',operationalDate())
        .in('status',['published','pending','active','paused'])
        .order('position')
      if(queryError)throw queryError
      setRoutes((data||[]) as AssignedRoute[])
      setError('')
    }catch(cause){
      if(process.env.NODE_ENV!=='production')console.error('Temporary assigned routes failed to load',cause)
      setError(cause instanceof Error?cause.message:'Unable to load assigned routes.')
    }
  },[])

  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    if(!userId)return
    const client=getSupabase()
    const channel=client.channel(`temporary-assignments-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'routes',filter:`driver_id=eq.${userId}`},()=>void load()).subscribe()
    return()=>{void client.removeChannel(channel)}
  },[load,userId])

  if(!routes.length&&!error)return null
  return <section className={styles.panel} aria-labelledby="assigned-route-title">
    <p className={styles.eyebrow}>{copy.eyebrow}</p>
    <div className={styles.heading}><div><h2 id="assigned-route-title">{copy.title}</h2><p>{copy.help}</p></div><span><PackageCheck size={21}/></span></div>
    {error?<p className={styles.error} role="status">{error}</p>:<div className={styles.list}>{routes.slice(0,3).map(route=><article className={styles.route} key={route.id}><span className={styles.icon}><RouteIcon size={18}/></span><div><small>{route.mission_type==='pickup'?copy.pickup:copy.delivery} · {route.status}</small><strong>{route.destination_name||route.destination_address}</strong><span>{route.destination_address}</span></div><Link href={`/driver?temporary=1&route=${route.id}`} aria-label={`${copy.open}: ${route.destination_name||route.destination_address}`}>{copy.open}<ArrowRight size={15}/></Link></article>)}</div>}
  </section>
}
