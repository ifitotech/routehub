'use client'
import dynamic from 'next/dynamic'
import {useCallback, useState} from 'react'
import {ArrowRight, CheckCircle2, CornerUpLeft, CornerUpRight, Crosshair, Navigation} from 'lucide-react'
import type {ActiveRouteManeuver} from '../../../lib/maps/types'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {markArrived} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const LiveRouteMap = dynamic(() => import('../../live-route-map'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh, drivingSession, liveFix} = useDriverData()
  const {t, locale} = useLocale()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [followToken, setFollowToken] = useState(0)
  const [maneuver, setManeuver] = useState<ActiveRouteManeuver | null>(null)
  const route = snapshot?.currentOperation?.route as any
  const onManeuver = useCallback((next: ActiveRouteManeuver | null) => setManeuver(next), [])
  const kind = (snapshot?.currentOperation?.kind || 'delivery').toString().toUpperCase()

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
              <LiveRouteMap
                destinationAddress={route.destination_address}
                destinationCoordinate={
                  route.destination_lat != null && route.destination_lng != null
                    ? {lat: Number(route.destination_lat), lng: Number(route.destination_lng)}
                    : null
                }
                driverLocation={
                  liveFix
                    ? {lat: liveFix.lat, lng: liveFix.lng}
                    : drivingSession?.last_lat != null && drivingSession?.last_lng != null
                    ? {lat: Number(drivingSession.last_lat), lng: Number(drivingSession.last_lng)}
                    : null
                }
                driverUpdatedAt={liveFix?.at || drivingSession?.last_updated_at || null}
                title={t.drvCurrentStop}
                showHeader={false}
                showLocationUpdated={false}
                interactive
                useDriverAsOrigin
                followToken={followToken}
                locale={locale}
                onManeuver={onManeuver}
              />
              {maneuver && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    right: 72,
                    zIndex: 12,
                    background: '#0F1D35',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '12px 14px',
                    boxShadow: '0 10px 28px rgba(15,29,53,.28)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    minHeight: 64,
                  }}
                >
                  {String(maneuver.modifier || '').includes('left') ? (
                    <CornerUpLeft size={28} />
                  ) : String(maneuver.modifier || '').includes('right') ? (
                    <CornerUpRight size={28} />
                  ) : (
                    <ArrowRight size={28} />
                  )}
                  <div style={{minWidth: 0}}>
                    <strong style={{display: 'block', fontSize: 18, lineHeight: 1.2}}>
                      {formatGuideDistance(maneuver.distanceToManeuverMeters, locale)}
                    </strong>
                    <span style={{display: 'block', color: '#B9C9E2', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {maneuver.streetName || formatGuideAction(maneuver, locale)}
                    </span>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => setFollowToken(t => t + 1)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 'auto',
                  minHeight: 44,
                  padding: '0 12px',
                  zIndex: 10,
                  boxShadow: '0 4px 14px rgba(15,29,53,.15)',
                }}
                aria-label={t.drvRecenter}
              >
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Crosshair size={16} />
                  {t.drvRecenter}
                </span>
              </button>
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

function formatGuideDistance(meters: number | undefined, locale: string) {
  const value = Math.max(0, Math.round(meters || 0))
  if (locale === 'es') return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`
  if (locale === 'fr') return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`
  const feet = Math.round(value * 3.281)
  return feet >= 1000 ? `${(feet / 5280).toFixed(1)} mi` : `${feet} ft`
}

function formatGuideAction(maneuver: ActiveRouteManeuver, locale: string) {
  const turn = `${maneuver.type || ''} ${maneuver.modifier || ''}`.toLowerCase()
  if (locale === 'es') {
    if (turn.includes('left')) return 'Gira a la izquierda'
    if (turn.includes('right')) return 'Gira a la derecha'
    if (turn.includes('arrive')) return 'Llegando'
    return 'Sigue adelante'
  }
  if (locale === 'fr') {
    if (turn.includes('left')) return 'Tournez à gauche'
    if (turn.includes('right')) return 'Tournez à droite'
    if (turn.includes('arrive')) return 'Arrivée'
    return 'Continuez'
  }
  if (turn.includes('left')) return 'Turn left'
  if (turn.includes('right')) return 'Turn right'
  if (turn.includes('arrive')) return 'Arriving'
  return 'Continue'
}
