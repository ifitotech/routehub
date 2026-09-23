'use client'

import {useCallback, useEffect, useState} from 'react'
import Link from 'next/link'
import {getSupabase} from '../../../lib/supabase'
import {useLocale} from '../../../lib/use-preferences'
import {createRealtimeRefresh} from '../../../lib/realtime-sync'
import ManagerShell from '../../manager/manager-shell'
import IssueReschedule from '../manage/issue-reschedule'

type IssueRow = {
  id: string
  company_id: string
  branch_id: string | null
  driver_id: string
  destination?: string
  destination_name?: string
  driver_note?: string | null
  position: number
  mission_type?: string
}

export default function IssueRoutes() {
  const {locale} = useLocale()
  const [rows, setRows] = useState<IssueRow[]>([])
  const [error, setError] = useState('')
  const copy = locale === 'es'
    ? {title: 'Incidencias', help: 'Reagenda la misma parada. No hace falta crear otra ruta.', back: 'Rutas', reschedule: 'Reagendar', detail: 'Misma dirección y PO. Solo cambia fecha y hora.', pickup: 'Recogida', delivery: 'Entrega', ret: 'Regreso', empty: 'No hay incidencias abiertas.', issues: 'Incidencia', date: 'Fecha', time: 'Hora', note: 'Nota del driver', invalidDate: 'Selecciona una fecha y hora válidas.', offline: 'Necesitas conexión para reagendar esta parada.', saveError: 'No se pudo reagendar la parada.'}
    : locale === 'fr'
    ? {title: 'Incidents', help: 'Replanifiez le même arrêt. Pas besoin d’en créer un autre.', back: 'Itinéraires', reschedule: 'Replanifier', detail: 'Même adresse et PO. Seules la date et l’heure changent.', pickup: 'Collecte', delivery: 'Livraison', ret: 'Retour', empty: 'Aucun incident ouvert.', issues: 'Incident', date: 'Date', time: 'Heure', note: 'Note du chauffeur', invalidDate: 'Sélectionnez une date et une heure valides.', offline: 'Une connexion est requise pour replanifier cet arrêt.', saveError: 'Impossible de replanifier cet arrêt.'}
    : {title: 'Issues', help: 'Reschedule the same stop. Do not create another route.', back: 'Routes', reschedule: 'Reschedule', detail: 'Same address and PO. Only the date and time change.', pickup: 'Pickup', delivery: 'Delivery', ret: 'Return', empty: 'No open issues.', issues: 'Issue', date: 'Date', time: 'Time', note: 'Driver note', invalidDate: 'Select a valid date and time.', offline: 'A connection is required to reschedule this stop.', saveError: 'Unable to reschedule this stop.'}

  const load = useCallback(async () => {
    try {
      const client = getSupabase()
      const {data: userData} = await client.auth.getUser()
      if (!userData.user) return
      const {data: membership} = await client.from('company_users').select('company_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
      if (!membership) return
      const {data, error: queryError} = await client.from('routes').select('id,company_id,branch_id,driver_id,destination_address,destination_name,driver_note,position,mission_type').eq('company_id', membership.company_id).eq('status', 'issue').order('route_date').order('position')
      if (queryError) throw queryError
      setRows((data || []).map((row: any) => ({
        id: row.id,
        company_id: row.company_id,
        branch_id: row.branch_id ?? null,
        driver_id: row.driver_id,
        destination: row.destination_address || '',
        destination_name: row.destination_name || '',
        driver_note: row.driver_note || null,
        position: Number(row.position || 1),
        mission_type: row.mission_type,
      })))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load issues')
    }
  }, [])

  useEffect(() => {
    void load()
    const client = getSupabase()
    const sync = createRealtimeRefresh(() => load(), 150)
    const channel = client.channel('issue-reschedule').on('postgres_changes', {event: '*', schema: 'public', table: 'routes'}, sync.schedule).subscribe()
    return () => {
      sync.dispose()
      void client.removeChannel(channel)
    }
  }, [load])

  const typeLabel = (type?: string) => type === 'pickup' ? copy.pickup : type === 'return' ? copy.ret : copy.delivery

  return (
    <ManagerShell active="routes">
      <div className="app" style={{maxWidth: 720, margin: '0 auto', padding: '18px 16px 96px'}}>
        <p><Link href="/routes">{copy.back}</Link></p>
        <h1>{copy.title}</h1>
        <p>{copy.help}</p>
        {error ? <p role="status">{error}</p> : null}
        {!rows.length && !error ? <p>{copy.empty}</p> : null}
        <div style={{display: 'grid', gap: 10, marginTop: 16}}>
          {rows.map(route => (
            <IssueReschedule
              key={route.id}
              route={route}
              label={copy.reschedule}
              help={copy.detail}
              typeLabel={typeLabel(route.mission_type)}
              issuesLabel={copy.issues}
              dateLabel={copy.date}
              timeLabel={copy.time}
              noteLabel={copy.note}
              invalidDateMessage={copy.invalidDate}
              offlineMessage={copy.offline}
              errorMessage={copy.saveError}
            />
          ))}
        </div>
      </div>
    </ManagerShell>
  )
}
