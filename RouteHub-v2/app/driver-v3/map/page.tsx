'use client'
import dynamic from 'next/dynamic'
import {useMemo, useState} from 'react'
import {useRouter} from 'next/navigation'
import {CheckCircle2, Navigation} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {markArrived} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'
import {operationalDate} from '../../../lib/driver-queue'

const DriverRouteNavigation = dynamic(() => import('../../driver-route-navigation'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh, drivingSession, liveFix, routes} = useDriverData()
  const {t, locale} = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const route = snapshot?.currentOperation?.route as any
  const kind = (snapshot?.currentOperation?.kind || 'delivery').toString().toUpperCase()
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

  const maps = () => {
    if (!route) return
    const url = openNavigation({
      address: route.destination_address,
      coordinate:
        route.destination_lat != null && route.destination_lng != null
          ? {lat: Number(route.destination_lat), lng: Number(route.destination_lng)}
          : null,
      label: route.destination_name,
    })
    if (url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.assign(url)
    }
  }

  const arrived = async () => {
    if (!route || busy || !driverId) return
    setBusy(true)
    setMessage('')
    try {
      await markArrived({routeId: route.id, driverId, companyId: route.company_id})
      await refresh()
      setMessage(t.drvArrivedOk)
      router.push('/driver')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.drvOpFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="map" title={t.drvMap} subtitle={route ? t.drvLiveOp : undefined} flush>
      <div className={styles.mapScreen}>
        <div className={styles.mapCanvas}>
          {loading ? (
            <p className="muted" style={{padding: 24}}>{t.drvLoadingMap}</p>
          ) : error ? (
            <p role="alert" style={{padding: 24}}>{error}</p>
          ) : route ? (
            <div style={{position: 'absolute', inset: 0}}>
              <DriverRouteNavigation
                stops={dayStops}
                activeStopId={route.id}
                originAddress={route.origin_address}
                originCoordinate={gps}
                locale={locale}
                sharedLocation={gps}
                onArrive={() => void arrived()}
                onExit={() => router.push('/driver')}
              />
            </div>
          ) : (
            <div style={{padding: 24}}>
              <h2 style={{margin: '0 0 6px'}}>{t.drvNoOperation}</h2>
              <p className="muted" style={{margin: 0}}>{t.drvDestHint}</p>
            </div>
          )}
        </div>

        {route && (
          <div className={styles.mapSheet}>
            <p className="eyebrow" style={{margin: 0}}>
              {t.drvCurrentStop} · {route.position || '—'} · {kind}
            </p>
            <h2 style={{margin: '6px 0 4px', fontSize: 18}}>
              {route.destination_name || route.destination_address || t.drvCurrentStopName}
            </h2>
            {route.destination_address && route.destination_name && (
              <p className="muted" style={{margin: '0 0 12px', fontSize: 13}}>
                {route.destination_address}
              </p>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: route.arrived_at ? '1fr' : '1fr 1fr',
                gap: 10,
              }}
            >
              <button className="secondary" onClick={maps} type="button">
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Navigation size={16} />
                  {t.drvOpenInMaps}
                </span>
              </button>
              {!route.arrived_at && ['active','paused'].includes(String(route.status)) && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void arrived()}
                  style={{background: '#16B96B'}}
                >
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <CheckCircle2 size={16} />
                    {busy ? t.drvBusy : t.drvArrivedShort}
                  </span>
                </button>
              )}
            </div>
            {message && (
              <p role="status" className="muted" style={{margin: '10px 0 0', textAlign: 'center'}}>
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </DriverV3Shell>
  )
}
