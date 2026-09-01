'use client'
import dynamic from 'next/dynamic'
import {useMemo, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {markArrived} from '../../../lib/driver-v3/actions'
import {operationalDate} from '../../../lib/driver-queue'

const DriverRouteNavigation = dynamic(() => import('../../driver-route-navigation'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh, drivingSession, liveFix, routes} = useDriverData()
  const {t, locale} = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const route = snapshot?.currentOperation?.route as any
  const completionKind = snapshot?.currentOperation?.kind === 'branch'
    ? 'return'
    : String(snapshot?.currentOperation?.kind || 'delivery')
  const today = operationalDate()
  const dayStops = useMemo(() => {
    const focusDate = (route?.route_date || today).toString().slice(0, 10)
    return (routes || [])
      .filter((item: any) => (item.route_date || '').slice(0, 10) === focusDate && item.status !== 'cancelled')
      .slice()
      .sort((left: any, right: any) => Number(left.position || 0) - Number(right.position || 0) || String(left.id).localeCompare(String(right.id)))
  }, [routes, route?.route_date, today])

  const gps = liveFix
    ? {lat: liveFix.lat, lng: liveFix.lng}
    : drivingSession?.last_lat != null && drivingSession?.last_lng != null
      ? {lat: Number(drivingSession.last_lat), lng: Number(drivingSession.last_lng)}
      : null

  const arrived = async () => {
    if (!route || busy || !driverId) return
    setBusy(true)
    setMessage('')
    try {
      await markArrived({routeId: route.id, driverId, companyId: route.company_id})
      await refresh()
      router.push(`/driver?complete=${completionKind}&route=${encodeURIComponent(String(route.id))}`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="driver-navigation-page">
      {loading ? (
        <div className="driver-navigation-state">{t.drvLoadingMap}</div>
      ) : error ? (
        <div className="driver-navigation-state" role="alert">{error}</div>
      ) : route ? (
        <DriverRouteNavigation
          stops={dayStops}
          activeStopId={route.id}
          originAddress={route.origin_address}
          originCoordinate={gps}
          locale={locale}
          sharedLocation={gps}
          disabled={busy}
          onArrive={() => void arrived()}
          onExit={() => router.push('/driver')}
        />
      ) : (
        <section className="driver-navigation-state">
          <h1>{t.drvNoOperation}</h1>
          <p>{t.drvDestHint}</p>
          <button type="button" onClick={() => router.push('/driver')}>{t.drvToday}</button>
        </section>
      )}
      {message && <p className="driver-navigation-feedback" role="alert">{message}</p>}
    </main>
  )
}
