'use client'
import dynamic from 'next/dynamic'
import {useState} from 'react'
import {CheckCircle2, Navigation} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {markArrived} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const LiveRouteMap = dynamic(() => import('../../live-route-map'), {ssr: false})

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh} = useDriverData()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
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
    if (url) window.location.assign(url)
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
      <p className="eyebrow">ACTIVE ROUTE</p>
      <h1 className="title">Map</h1>

      {loading ? (
        <section className="card"><p>Loading map…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : route ? (
        <>
          <section className="card" style={{padding: 0, overflow: 'hidden', minHeight: 280}}>
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
              <p className="muted" style={{margin: '4px 0 12px'}}>
                PO {route.order_number}
              </p>
            )}

            <div style={{display: 'grid', gridTemplateColumns: route.arrived_at ? '1fr' : '1fr 1fr', gap: 10}}>
              <button className="secondary" onClick={maps} type="button">
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                  <Navigation size={16} />
                  Open in Maps
                </span>
              </button>
              {!route.arrived_at && (
                <button className="primary" disabled={busy} onClick={() => void arrived()} style={{background: '#16B96B'}}>
                  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                    <CheckCircle2 size={16} />
                    {busy ? 'Updating…' : 'Arrived'}
                  </span>
                </button>
              )}
            </div>
            {message && (
              <p role="status" className="muted">
                {message}
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="card">
          <h2>No active operation</h2>
          <p className="muted">A current destination will appear here when assigned.</p>
        </section>
      )}
    </DriverV3Shell>
  )
}
