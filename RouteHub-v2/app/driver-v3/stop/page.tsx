'use client'
import {useState} from 'react'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {
  AlertTriangle,
  Camera,
  FileText,
  MapPin,
  Navigation,
  PenLine,
  Phone,
} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import styles from '../../../components/driver-v3/driver-v3.module.css'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {markArrived, completeStop} from '../../../lib/driver-v3/actions'
import {openNavigation} from '../../../lib/maps/external-navigation'

const operationLabel = (kind: string) =>
  kind === 'branch' ? 'RETURN' : kind === 'pickup' ? 'PICKUP' : 'DELIVERY'

export default function DriverV3Stop() {
  const router = useRouter()
  const params = useSearchParams()
  const {driverId, loading, error, routes, snapshot, refresh} = useDriverData()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const op = snapshot?.currentOperation
  const selectedId = params.get('id')
  const route = ((selectedId ? routes.find((r: any) => r.id === selectedId) : undefined) ||
    op?.route) as any
  const isCurrent = !selectedId || selectedId === op?.route?.id
  const kind = op?.kind || route?.mission_type || 'delivery'

  const act = async (action: 'arrive' | 'complete') => {
    if (!op || !isCurrent || busy || !route) return
    setBusy(true)
    setMessage('')
    try {
      const ctx = {routeId: route.id, driverId, companyId: route.company_id}
      if (action === 'arrive') {
        await markArrived(ctx)
        await refresh()
        setMessage('Arrival recorded.')
      } else {
        await completeStop(ctx)
        await refresh()
        router.push('/driver-v3/completed')
        return
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to update stop.')
    } finally {
      setBusy(false)
    }
  }

  const maps = () => {
    const url = openNavigation({
      address: route?.destination_address,
      coordinate:
        route?.destination_lat != null && route?.destination_lng != null
          ? {lat: Number(route.destination_lat), lng: Number(route.destination_lng)}
          : null,
      label: route?.destination_name,
    })
    if (url) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) window.location.assign(url)
    }
  }

  return (
    <DriverV3Shell active="route">
      <Link href="/driver/route" className="muted">
        ‹ My Route
      </Link>

      {loading ? (
        <section className="card"><p>Loading stop…</p></section>
      ) : error ? (
        <section className="card"><p role="alert">{error}</p></section>
      ) : !route ? (
        <section className="card">
          <h2>No current stop</h2>
          <p className="muted">There is no active operation.</p>
        </section>
      ) : (
        <>
          <p className="eyebrow">
            STOP {route.position || '—'} · {operationLabel(String(kind))}
          </p>
          <h1 className="title" style={{marginBottom: 4}}>
            {route.destination_name || route.destination_address || 'Current stop'}
          </h1>
          <p className="muted" style={{marginTop: 0, marginBottom: 12}}>
            <MapPin size={14} style={{display: 'inline', verticalAlign: -2, marginRight: 4}} />
            {route.destination_address || 'Address unavailable'}
          </p>

          <section className="card">
            {route.destination_phone && (
              <p style={{margin: '0 0 8px'}}>
                <a
                  href={`tel:${route.destination_phone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#1667F2',
                    fontWeight: 700,
                    textDecoration: 'none',
                    minHeight: 44,
                  }}
                >
                  <Phone size={16} />
                  {route.destination_phone}
                </a>
              </p>
            )}
            {route.order_number && (
              <p style={{margin: '0 0 8px'}}>
                <strong>PO / Order:</strong> {route.order_number}
              </p>
            )}
            {(route.instructions || route.notes) && (
              <p className="muted" style={{margin: '8px 0 0'}}>
                <strong style={{color: '#0F1D35'}}>Instructions: </strong>
                {route.instructions || route.notes}
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginTop: 16,
              }}
            >
              <Link
                href="/driver/pod"
                className="secondary"
                style={{
                  minHeight: 72,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  padding: 8,
                  fontSize: 12,
                }}
              >
                <Camera size={22} />
                Photo
              </Link>
              <Link
                href="/driver/pod"
                className="secondary"
                style={{
                  minHeight: 72,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  padding: 8,
                  fontSize: 12,
                }}
              >
                <PenLine size={22} />
                Signature
              </Link>
              <Link
                href="/driver/pod"
                className="secondary"
                style={{
                  minHeight: 72,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  padding: 8,
                  fontSize: 12,
                }}
              >
                <FileText size={22} />
                Notes
              </Link>
              <Link
                href="/driver/issue"
                className="secondary"
                style={{
                  minHeight: 72,
                  display: 'grid',
                  placeItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  padding: 8,
                  fontSize: 12,
                  color: '#EF5350',
                  borderColor: '#f5c2c0',
                }}
              >
                <AlertTriangle size={22} />
                Issue
              </Link>
            </div>

            <button
              className="secondary"
              onClick={maps}
              type="button"
              style={{marginTop: 14}}
            >
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                <Navigation size={18} />
                Open in Maps
              </span>
            </button>
          </section>

          <div className={styles.stickyAction}>
            {!route.arrived_at ? (
              <button
                className="primary"
                disabled={busy || !isCurrent}
                onClick={() => void act('arrive')}
              >
                {busy ? 'Updating…' : 'ARRIVED AT STOP'}
              </button>
            ) : (
              <button
                className="primary"
                disabled={busy || !isCurrent}
                onClick={() => void act('complete')}
                style={{background: '#16B96B'}}
              >
                {busy ? 'Completing…' : `COMPLETE ${operationLabel(String(kind))}`}
              </button>
            )}
            {message && (
              <p role="status" className="muted" style={{margin: 0, textAlign: 'center'}}>
                {message}
              </p>
            )}
          </div>
        </>
      )}
    </DriverV3Shell>
  )
}
