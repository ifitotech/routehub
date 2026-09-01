'use client'
import dynamic from 'next/dynamic'
import {useState} from 'react'
import {Component, type ReactNode} from 'react'
import {useRouter} from 'next/navigation'
import {useDriverData} from '../../../lib/driver-v3/use-driver-data'
import {useLocale} from '../../../lib/use-preferences'
import {markArrived} from '../../../lib/driver-v3/actions'

const DriverRouteNavigation = dynamic(() => import('../../driver-route-navigation'), {ssr: false})

class NavigationBoundary extends Component<{children: ReactNode; fallback: ReactNode}, {failed: boolean}> {
  state = {failed: false}
  static getDerivedStateFromError() { return {failed: true} }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function DriverV3Map() {
  const {loading, error, snapshot, driverId, refresh, drivingSession, liveFix} = useDriverData()
  const {t, locale} = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const route = snapshot?.currentOperation?.route as any
  const completionKind = snapshot?.currentOperation?.kind === 'branch'
    ? 'return'
    : String(snapshot?.currentOperation?.kind || 'delivery')

  const gps = liveFix
    ? liveFix
    : drivingSession?.last_lat != null && drivingSession?.last_lng != null
      ? {lat: Number(drivingSession.last_lat), lng: Number(drivingSession.last_lng)}
      : null

  const arrived = async () => {
    if (!route || busy || !driverId) return
    setBusy(true)
    setMessage('')
    try {
      // Arrival is intentionally repeatable: once recorded, tapping Arrived
      // again should reopen the completion flow instead of showing an error.
      if (!route.arrived_at) {
        try {
          await markArrived({routeId: route.id, driverId, companyId: route.company_id})
        } catch (error) {
          if (!/already recorded/i.test(error instanceof Error ? error.message : '')) throw error
        }
      }
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
        <NavigationBoundary fallback={<NavigationFallback route={route} onBack={() => router.push('/driver')} onRetry={() => window.location.reload()} t={t} />}>
          <DriverRouteNavigation
          stops={[route]}
          activeStopId={route.id}
          originAddress={route.origin_address}
          originCoordinate={gps}
          locale={locale}
          sharedLocation={gps}
          disabled={busy}
          onArrive={() => void arrived()}
          onExit={() => router.push('/driver')}
          />
        </NavigationBoundary>
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

function NavigationFallback({route, onBack, onRetry, t}: {route: any; onBack: () => void; onRetry: () => void; t: any}) {
  const address = route.destination_address || route.destination_name || t.drvCurrentStopName
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  return <section className="driver-navigation-state" role="alert">
    <h1>Navigation unavailable</h1>
    <p>{address}</p>
    <a className="primary" href={maps} target="_blank" rel="noreferrer">{t.drvOpenMaps || 'Open in Google Maps'}</a>
    <button type="button" className="secondary" onClick={onRetry}>{t.drvTryAgain || 'Try again'}</button>
    <button type="button" className="secondary" onClick={onBack}>{t.drvToday || 'Back to Today'}</button>
  </section>
}
