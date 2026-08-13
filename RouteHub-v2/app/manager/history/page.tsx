'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'
import {ArrowLeft, History, Home, Image as ImageIcon, MoreHorizontal, Route as RouteIcon, X} from 'lucide-react'
import {getSupabase} from '../../../lib/supabase'
import {currentMembership} from '../../../lib/data'
import {useLocale} from '../../../lib/use-preferences'
import styles from './history.module.css'

type HistoryRoute = {
  id: string
  status: 'completed' | 'issue' | 'cancelled'
  destination_name?: string | null
  destination_address?: string | null
  origin_address?: string | null
  notes?: string | null
  completed_at?: string | null
  completion_method?: string | null
  completion_photo_path?: string | null
}

const statusLabel = (status: HistoryRoute['status'], locale: string) => {
  const labels = {
    completed: {en: 'Completed', es: 'Completada', fr: 'Terminée'},
    issue: {en: 'Issue reported', es: 'Problema reportado', fr: 'Problème signalé'},
    cancelled: {en: 'Cancelled', es: 'Cancelada', fr: 'Annulée'},
  }
  return labels[status][locale as 'en' | 'es' | 'fr'] || labels[status].en
}

export default function ManagerHistoryPage() {
  const {locale, t} = useLocale()
  const [routes, setRoutes] = useState<HistoryRoute[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [photoLoading, setPhotoLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const membership = await currentMembership()
      const {data, error} = await getSupabase()
        .from('routes')
        .select('id,status,destination_name,destination_address,origin_address,notes,completed_at,completion_method,completion_photo_path')
        .eq('company_id', membership.company_id)
        .in('status', ['completed', 'issue', 'cancelled'])
        .order('completed_at', {ascending: false})
      if (error) throw error
      setRoutes((data || []) as HistoryRoute[])
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.unableLoadRoutes)
    } finally {
      setLoading(false)
    }
  }, [t.unableLoadRoutes])

  useEffect(() => { void load() }, [load])

  const togglePhoto = async (route: HistoryRoute) => {
    if (!route.completion_photo_path || photoLoading) return
    if (photos[route.id]) {
      setPhotos(current => {
        const next = {...current}
        delete next[route.id]
        return next
      })
      return
    }
    setPhotoLoading(route.id)
    try {
      const {data, error} = await getSupabase().storage.from('route-evidence').createSignedUrl(route.completion_photo_path, 60 * 20)
      if (error) throw error
      setPhotos(current => ({...current, [route.id]: data.signedUrl}))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load delivery evidence.')
    } finally {
      setPhotoLoading(null)
    }
  }

  return <main className={`app ${styles.page}`}>
    <header className={styles.header}>
      <Link href="/manager" className={styles.back}><ArrowLeft size={18}/>{t.home}</Link>
      <div><span className="eyebrow">{locale === 'es' ? 'OPERACIÓN' : locale === 'fr' ? 'OPÉRATIONS' : 'OPERATIONS'}</span><h1>{t.history}</h1><p>{locale === 'es' ? 'Entregas, fotos y comentarios de rutas terminadas.' : locale === 'fr' ? 'Livraisons, photos et commentaires des itinéraires terminés.' : 'Completed routes, delivery photos and comments.'}</p></div>
    </header>
    {message && <p className={styles.message} role="status">{message}</p>}
    {loading ? <section className={styles.list} aria-busy="true" aria-label="Loading history">{[1, 2, 3].map(item => <div key={item} className={styles.skeleton}/>)}</section> : <section className={styles.list}>
      {routes.map(route => <article className={`${styles.route} ${styles[route.status]}`} key={route.id}>
        <div className={styles.routeTop}><span className={styles.icon}><RouteIcon size={18}/></span><div className={styles.copy}><strong>{route.destination_name || route.destination_address || t.destination}</strong><span>{route.origin_address || t.mainBranch} → {route.destination_address || t.destination}</span></div><span className={styles.status}>{statusLabel(route.status, locale)}</span></div>
        <div className={styles.meta}><span>{route.completed_at ? new Date(route.completed_at).toLocaleString(locale) : t.notRecorded}</span>{route.completion_method && <span>{route.completion_method}</span>}</div>
        {route.notes && <p className={styles.notes}>{route.notes}</p>}
        {route.completion_photo_path && <div className={styles.evidence}><button type="button" onClick={() => void togglePhoto(route)}><ImageIcon size={16}/>{photoLoading === route.id ? 'Loading photo…' : photos[route.id] ? 'Hide photo' : 'View delivery photo'}</button>{photos[route.id] && <div className={styles.photoWrap}><img src={photos[route.id]} alt={`Delivery evidence for ${route.destination_name || route.destination_address || 'route'}`}/><button type="button" className={styles.closePhoto} onClick={() => void togglePhoto(route)} aria-label="Hide delivery photo"><X size={16}/></button></div>}</div>}
      </article>)}
      {!routes.length && <section className={styles.empty}><RouteIcon size={27}/><h2>{t.noHistory}</h2><p>{t.historyHelp}</p></section>}
    </section>}
    <nav className="nav" aria-label="Manager navigation"><Link href="/manager"><Home size={17}/><span>{t.home}</span></Link><Link href="/routes"><RouteIcon size={17}/><span>{t.routes}</span></Link><Link href="/manager/history" aria-current="page"><History size={17}/><span>{t.history}</span></Link><Link href="/manager/more"><MoreHorizontal size={17}/><span>{t.more}</span></Link></nav>
  </main>
}
