'use client'

import {useEffect, useMemo, useState} from 'react'
import L from 'leaflet'
import {MapContainer, Marker, Polyline, TileLayer, useMap} from 'react-leaflet'
import {sanitizeCoordinate} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {calculateOperationsRoute} from '../../lib/maps/routing'
import type {MapCoordinate} from '../../lib/maps/types'
import styles from './DriverRoutePreview.module.css'

type PreviewRoute = {
  id: string
  origin_address?: string | null
  origin_lat?: number | null
  origin_lng?: number | null
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
}

type Geometry = {
  key: string
  origin: MapCoordinate | null
  destination: MapCoordinate | null
  line: MapCoordinate[]
  phase: 'loading' | 'ready' | 'approximate' | 'missing'
}

const copy = {
  en: {label: 'Current stop: A to B', from: 'Start', to: 'Destination', loading: 'Loading route…', approximate: 'Approximate connection', missing: 'Map unavailable · use Open Maps', noOrigin: 'Starting point unavailable', noDestination: 'Destination unavailable'},
  es: {label: 'Parada actual: A a B', from: 'Salida', to: 'Destino', loading: 'Cargando recorrido…', approximate: 'Conexión aproximada', missing: 'Mapa no disponible · usa Abrir Mapas', noOrigin: 'Salida no disponible', noDestination: 'Destino no disponible'},
  fr: {label: 'Arrêt actuel : A à B', from: 'Départ', to: 'Destination', loading: 'Chargement du trajet…', approximate: 'Liaison approximative', missing: 'Carte indisponible · ouvrir Plans', noOrigin: 'Départ indisponible', noDestination: 'Destination indisponible'},
}

function endpointIcon(letter: 'A' | 'B', combined = false) {
  const width = combined ? 48 : 28
  return L.divIcon({
    className: `${styles.marker} ${letter === 'A' ? styles.origin : styles.destination}`,
    html: combined ? 'A·B' : letter,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 14],
  })
}

/** Fit the actual card, including road bends, after layout and every resize. */
function FitPreview({points}: {points: MapCoordinate[]}) {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    let frame = 0
    const fit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!container.clientWidth || !container.clientHeight || !points.length) return
        map.invalidateSize({pan: false, animate: false})
        map.fitBounds(L.latLngBounds(points), {
          paddingTopLeft: [24, 48],
          paddingBottomRight: [24, 34],
          maxZoom: 15,
          animate: false,
        })
      })
    }
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    fit()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [map, points])
  return null
}

/** Today is a reference for the current assignment, independent of the fleet map. */
export default function DriverRoutePreview({route, locale = 'en'}: {route: PreviewRoute; locale?: string}) {
  const text = copy[locale as keyof typeof copy] || copy.en
  const {id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng} = route
  const initial = useMemo<Geometry>(() => ({
    key: JSON.stringify([id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, locale]),
    origin: sanitizeCoordinate({lat: origin_lat, lng: origin_lng}),
    destination: sanitizeCoordinate({lat: destination_lat, lng: destination_lng}),
    line: [],
    phase: 'loading',
  }), [id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, locale])
  const [resolved, setResolved] = useState<Geometry>(initial)
  // Never flash a previous assignment while its replacement is resolving.
  const geometry = resolved.key === initial.key ? resolved : initial

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    const resolve = async (known: MapCoordinate | null, address?: string | null) => {
      if (known || !address?.trim()) return known
      return (await geocodeAddress(address, controller.signal))?.coordinate || null
    }
    void (async () => {
      const [origin, destination] = await Promise.all([
        resolve(initial.origin, origin_address), resolve(initial.destination, destination_address),
      ])
      if (cancelled) return
      const base = {...initial, origin, destination}
      if (!origin || !destination) { window.clearTimeout(timeout); setResolved({...base, phase: 'missing'}); return }
      if (Math.abs(origin.lat - destination.lat) < .00001 && Math.abs(origin.lng - destination.lng) < .00001) {
        window.clearTimeout(timeout)
        setResolved({...base, phase: 'ready'})
        return
      }
      setResolved(base)
      const estimate = await calculateOperationsRoute([origin, destination], controller.signal, locale)
      window.clearTimeout(timeout)
      if (cancelled) return
      const road = estimate.coordinates.length > 2 || estimate.source === 'google'
      setResolved({...base, line: estimate.coordinates, phase: road ? 'ready' : 'approximate'})
    })()
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort() }
  }, [initial, origin_address, destination_address, locale])

  const points = useMemo(() => [geometry.origin, geometry.destination, ...geometry.line]
    .filter((point): point is MapCoordinate => Boolean(point)), [geometry])
  const combined = Boolean(geometry.origin && geometry.destination
    && Math.abs(geometry.origin.lat - geometry.destination.lat) < .00001
    && Math.abs(geometry.origin.lng - geometry.destination.lng) < .00001)
  const icons = useMemo(() => ({a: endpointIcon('A'), b: endpointIcon('B', combined)}), [combined])
  const status = geometry.phase === 'loading' ? text.loading
    : geometry.phase === 'approximate' && !combined ? text.approximate
    : geometry.phase === 'missing' ? !points.length ? text.missing : !geometry.origin ? text.noOrigin : text.noDestination : ''

  return <section className={styles.preview} aria-label={text.label} aria-busy={geometry.phase === 'loading'}>
    {!!points.length && <MapContainer center={points[0]} zoom={12} zoomSnap={.25} zoomControl={false}
      dragging={false} touchZoom={false} doubleClickZoom={false} scrollWheelZoom={false}
      boxZoom={false} keyboard={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
      <TileLayer attribution='© OpenStreetMap contributors' url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'/>
      <FitPreview points={points}/>
      {geometry.line.length > 1 && <Polyline positions={geometry.line} interactive={false}
        pathOptions={{color: '#1677FF', weight: 4, opacity: .95, lineCap: 'round', lineJoin: 'round', dashArray: geometry.phase === 'approximate' ? '6 6' : undefined}}/>}
      {geometry.origin && !combined && <Marker position={geometry.origin} icon={icons.a} interactive={false} keyboard={false} alt={`A · ${text.from}`}/>}
      {geometry.destination && <Marker position={geometry.destination} icon={icons.b} interactive={false} keyboard={false} alt={`B · ${text.to}`}/>}
    </MapContainer>}
    <div className={styles.caption}><span><b className={styles.fromBadge}>A</b>{text.from}</span><span aria-hidden="true">→</span><span><b className={styles.toBadge}>B</b>{text.to}</span></div>
    {status && <div className={`${styles.status} ${points.length ? '' : styles.empty}`} role="status">{status}</div>}
  </section>
}
