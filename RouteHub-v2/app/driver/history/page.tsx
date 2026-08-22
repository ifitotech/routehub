'use client'

import Link from 'next/link'
import Image from 'next/image'
import {Camera, CheckCircle2, CircleAlert, Clock3, FileText, History as HistoryIcon, MapPin, Pencil} from 'lucide-react'
import {useCallback, useEffect, useState} from 'react'
import {resolveDriverIssue} from '../../../lib/issue-resolution'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import NotificationBell from '../../notification-bell'
import DriverBottomNav from '../driver-bottom-nav'
import styles from './history.module.css'

type RouteRecord = {
  id:string; status:string; destination_name?:string; destination_address?:string
  completed_at?:string; created_at?:string; completion_method?:string; notes?:string; mission_type?:string; order_number?:string; arrived_at?:string; driver_note?:string
}

export default function DriverHistory() {
  const [rows, setRows] = useState<RouteRecord[]>([])
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState<'note' | 'complete' | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteRecord|null>(null)
  const {locale, t} = useLocale()

  const copy = locale === 'es'
    ? {title:'Historial de rutas', edit:'Actualizar incidencia', notes:'Nota de seguimiento', photo:'Tomar o elegir una foto', save:'Guardar cambios', complete:'Marcar como entrega completada', saved:'Incidencia actualizada.', resolved:'Entrega completada.', photoHelp:'La evidencia se guardará de forma privada para tu empresa.'}
    : locale === 'fr'
      ? {title:'Historique des itinéraires', edit:'Mettre à jour le problème', notes:'Note de suivi', photo:'Prendre ou choisir une photo', save:'Enregistrer', complete:'Marquer comme livrée', saved:'Problème mis à jour.', resolved:'Livraison terminée.', photoHelp:'La preuve est enregistrée de manière privée pour votre entreprise.'}
      : {title:'Route history', edit:'Update issue', notes:'Follow-up note', photo:'Take or choose a photo', save:'Save changes', complete:'Mark delivery complete', saved:'Issue updated.', resolved:'Delivery completed.', photoHelp:'Evidence is saved privately for your company.'}

  const load = useCallback(async () => {
    try {
      setMessage('')
      const client = getSupabase()
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      const fromDate = [weekAgo.getFullYear(), String(weekAgo.getMonth() + 1).padStart(2, '0'), String(weekAgo.getDate()).padStart(2, '0')].join('-')
      const {data: userData} = await client.auth.getUser()
      if (!userData.user) throw Error(t.signIn)
      const {data, error} = await client.from('routes')
        .select('id,status,destination_name,destination_address,completed_at,created_at,completion_method,notes,mission_type,order_number,arrived_at,driver_note,route_date')
        .eq('driver_id', userData.user.id)
        .gte('route_date', fromDate)
        .in('status', ['completed','issue','cancelled'])
        .order('completed_at', {ascending:false, nullsFirst:false})
      if (error) throw error
      setRows((data || []).sort((a, b) => new Date(b.completed_at || b.created_at || 0).getTime() - new Date(a.completed_at || a.created_at || 0).getTime()))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.unableLoadRoutes)
    }
  }, [t.signIn, t.unableLoadRoutes])

  useEffect(() => { void load() }, [load])

  const openEditor = (route: RouteRecord) => {
    setEditingId(route.id)
    setNote(route.notes || '')
    setPhoto(null)
  }

  const saveIssue = async (route: RouteRecord, complete: boolean) => {
    setSaving(complete ? 'complete' : 'note')
    try {
      await resolveDriverIssue({routeId:route.id, note, photo, complete})
      setMessage(complete ? copy.resolved : copy.saved)
      setEditingId(null)
      setPhoto(null)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.unableUpdateRoute)
    } finally {
      setSaving(null)
    }
  }

  return <main className={`app driver-dashboard ${styles.page}`}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/driver"><Image src="/routehub-driver-new.jpg" alt="" width={42} height={42}/><span>RouteHub<small>{t.driverWorkspace}</small></span></Link>
      <NotificationBell />
    </header>
    <p className={styles.eyebrow}>{t.driverWorkspace}</p>
    <h1 className={styles.title}>{copy.title}</h1>
    {message && <p className="muted" role="status">{message}</p>}
    <section className={styles.list} aria-live="polite">
      {rows.map(route => {
        const isIssue = route.status === 'issue'
        const isOpen = editingId === route.id
        const statusText = route.status === 'completed' ? t.completed : isIssue ? t.issueReported : t.notCompleted
        return <article role="button" tabIndex={0} onClick={()=>setSelectedRoute(route)} className={`card ${styles.card} ${route.status === 'completed' ? styles.completed : isIssue ? styles.issue : styles.cancelled}`} key={route.id}>
          <div className={styles.cardTop}>
            <strong className={styles.status}>{route.status === 'completed' ? <CheckCircle2 size={18}/> : <CircleAlert size={18}/>} {statusText}</strong>
            <span className={styles.badge}>{route.status === 'completed' ? t.completed : isIssue ? t.issues : t.cancelled}</span>
          </div>
          <h2 className={styles.destination}>{route.destination_name || route.destination_address || t.routes}</h2>
          {route.destination_address && route.destination_name && <p className={styles.meta}><MapPin size={16}/>{route.destination_address}</p>}
          <p className={styles.meta}><Clock3 size={16}/>{route.completed_at ? new Date(route.completed_at).toLocaleString(locale) : t.completionTime} · {route.completion_method || t.notRecorded}</p>
          {route.notes && <p className={styles.note}><FileText size={16}/>{route.notes}</p>}
          {isIssue && <button type="button" className={styles.editToggle} onClick={() => isOpen ? setEditingId(null) : openEditor(route)}><Pencil size={16}/>{copy.edit}</button>}
          {isIssue && isOpen && <div className={styles.editor}>
            <label>{copy.notes}<textarea value={note} onChange={event => setNote(event.target.value)} placeholder={t.reason}/></label>
            <label className={styles.photoButton}>{copy.photo}<Camera size={18}/><input className={styles.photoInput} type="file" accept="image/*" capture="environment" onChange={event => setPhoto(event.target.files?.[0] || null)}/></label>
            <p className={styles.fileName}>{photo ? photo.name : copy.photoHelp}</p>
            <div className={styles.editorActions}>
              <button type="button" className={styles.save} disabled={Boolean(saving)} onClick={() => void saveIssue(route, false)}>{saving === 'note' ? t.saving : copy.save}</button>
              <button type="button" className={styles.complete} disabled={Boolean(saving)} onClick={() => void saveIssue(route, true)}>{saving === 'complete' ? t.saving : copy.complete}</button>
            </div>
          </div>}
        </article>
      })}
      {!rows.length && !message && <section className={`card ${styles.empty}`}><HistoryIcon size={38}/><h2>{t.noHistory}</h2><p className="muted">{t.historyHelp}</p></section>}
    </section>
    {selectedRoute&&<div className={styles.detailBackdrop}><section className={styles.detailModal}><button type="button" className={styles.close} onClick={()=>setSelectedRoute(null)}>×</button><h2>{selectedRoute.destination_name||selectedRoute.destination_address||t.routes}</h2><p><MapPin size={16}/> {selectedRoute.destination_address||t.destination}</p><p><Clock3 size={16}/> {selectedRoute.completed_at?new Date(selectedRoute.completed_at).toLocaleString(locale):t.completionTime}</p><strong>{(selectedRoute.mission_type||'delivery').toUpperCase()}</strong>{selectedRoute.order_number&&<p>PO / Order: <b>{selectedRoute.order_number}</b></p>}{selectedRoute.arrived_at&&selectedRoute.completed_at&&<p>Time on route: {Math.max(0,Math.round((new Date(selectedRoute.completed_at).getTime()-new Date(selectedRoute.arrived_at).getTime())/60000))} min</p>}<p>{selectedRoute.driver_note||selectedRoute.notes||''}</p></section></div>}
    <DriverBottomNav />
  </main>
}
