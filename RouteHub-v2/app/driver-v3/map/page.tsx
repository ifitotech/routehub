'use client'
import dynamic from 'next/dynamic'
import {useState} from 'react'
import {CheckCircle2, Crosshair, Navigation} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import shellStyles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {markArrived} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const LiveRouteMap = dynamic(() => import('../../live-route-map'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh} = useDriverData()
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
      setMessage('Arrival recorded.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to record arrival.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverV3Shell active="map">
      <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12}}>
        <div>
          <p className="eyebrow">ACTIVE ROUTE</p>
          <h1 className="title" style={{marginBottom: 0}}>
            Map
          </h1>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setFollowToken(t => t + 1)}
          style={{width: 'auto', minHeight: 44, padding: '0 12px', flexShrink: 0}}
          aria-label="Recenter map"
        >
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <Crosshair size={16} />
            Recenter
          </span>
        </button>
      </div>

      {loading ? (
        <section className="card" style={{marginTop: 12}}>
          <p>Loading map…</p>
        </section>
      ) : error ? (
        <section className="card" style={{marginTop: 12}}>
          <p role="alert">{error}</p>
        </section>
      ) : route ? (
        <>
          <section
            className="card"
            style={{padding: 0, overflow: 'hidden', minHeight: 280, marginTop: 12}}
          >
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
          </section>

          <section className="card" style={{marginTop: 12}}>
            <p className="eyebrow">
              CURRENT STOP · {route.position || '—'} · {kind}
            </p>
            <h2 style={{margin: '4px 0 6px', fontSize: 20}}>
              {route.destination_name || route.destination_address || 'Destination'}
            </h2>
            {route.destination_address && route.destination_name && (
              <p className="muted" style={{marginTop: 0}}>
                {route.destination_address}
              </p>
            )}
            {route.order_number && (
              <p className="muted" style={{margin: '4px 0 0'}}>
                PO {route.order_number}
              </p>
            )}
          </section>

          <div className={shellStyles.stickyAction}>
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
                  Open in Maps
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
                    {busy ? 'Updating…' : 'Arrived'}
                  </span>
                </button>
              )}
            </div>
            {message && (
              <p role="status" className="muted" style={{margin: 0, textAlign: 'center'}}>
                {message}
              </p>
            )}
          </div>
        </>
      ) : (
        <section className="card" style={{marginTop: 12}}>
          <h2>No active operation</h2>
          <p className="muted">A current destination will appear here when assigned.</p>
        </section>
      )}
    </DriverV3Shell>
  )
}
