'use client'
import dynamic from 'next/dynamic'
import {useState} from 'react'
import {CheckCircle2, Crosshair, Navigation} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {markArrived} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const LiveRouteMap = dynamic(() => import('../../live-route-map'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh} = useDriverData()
  const {t} = useLocale()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [followToken, setFollowToken] = useState(0)
  const route = snapshot?.currentOperation?.route as any
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
                title="Current stop"
                showHeader={false}
                interactive
                followToken={followToken}
              />
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
                aria-label="Recenter map"
              >
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Crosshair size={16} />
                  Recenter
                </span>
              </button>
            </div>
          ) : (
            <div style={{padding: 24}}>
              <h2 style={{margin: '0 0 6px'}}>{t.drvNoOperation}</h2>
              <p className="muted" style={{margin: 0}}>A destination appears here when assigned.</p>
            </div>
          )}
        </div>

        {route && (
          <div className={styles.mapSheet}>
            <p className="eyebrow" style={{margin: 0}}>
              {t.drvCurrentStop} · {route.position || '—'} · {kind}
            </p>
            <h2 style={{margin: '6px 0 4px', fontSize: 18}}>
              {route.destination_name || route.destination_address || 'Destination'}
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
              {!route.arrived_at && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void arrived()}
                  style={{background: '#16B96B'}}
                >
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <CheckCircle2 size={16} />
                    {busy ? 'Updating…' : t.drvArrivedShort}
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
