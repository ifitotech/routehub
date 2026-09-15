'use client'

import {useEffect, useId, useMemo, useRef, useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {sanitizeCoordinate, type MapPoint} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {distanceMeters} from '../../lib/location'
import {calculateOperationsRoute} from '../../lib/maps/routing'
import styles from './DriverRouteMap.module.css'

type Route = {
  id: string
  origin_address?: string | null
  origin_lat?: number | null
  origin_lng?: number | null
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
}
const AT_DESTINATION_COPY = {en: 'At destination', es: 'En destino', fr: 'Sur place'}
const AT_DESTINATION_METERS = 45

// This cache deliberately includes the route id and both endpoints.  A driver
// can therefore return to a route without another routing request, while a
// different route (even to the same destination) can never inherit its line.
function previewCacheKey(routeId: string, origin: MapPoint, destination: MapPoint) {
  return `routehub:map-preview:v1:${routeId}:${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`
}

function readPreviewGeometry(key: string): MapPoint[] | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || 'null')
    if (!Array.isArray(value) || value.length < 3) return null
    const points = value.map(sanitizeCoordinate).filter((point): point is MapPoint => Boolean(point))
    return points.length > 2 ? points : null
  } catch {
    return null
  }
}

function savePreviewGeometry(key: string, points: MapPoint[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(points))
  } catch {
    // Storage can be unavailable in private browsing. The live map remains a
    // safe fallback in that case.
  }
}

// Theme filters affect only the raster canvas. Markers and the SVG road retain
// their colors, and swapping themes cannot destroy/recreate the route layers.
const osmStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{id: 'osm', type: 'raster', source: 'osm'}],
}

function markerEl(kind: 'driver' | 'destination', live = true) {
  const el = document.createElement('div')
  el.className = kind === 'driver' ? styles.driverMarker : styles.destinationMarker
  const dot = document.createElement('span')
  dot.className = kind === 'driver'
    ? `${styles.driverDot}${live ? '' : ` ${styles.driverDotStatic}`}`
    : styles.destinationPin
  el.appendChild(dot)
  return el
}

function useResolvedPoint(known: MapPoint | null, address: string | null | undefined, routeId: string) {
  const [point, setPoint] = useState<MapPoint | null>(known)
  useEffect(() => {
    setPoint(known)
    if (known || !address?.trim()) return
    const controller = new AbortController()
    void geocodeAddress(address, controller.signal).then(result => {
      if (!controller.signal.aborted) setPoint(result?.coordinate || null)
    })
    return () => controller.abort()
  }, [routeId, known, address])
  return point
}

/** Real road preview with camera padding measured from the visible header and
 * stop summary. Routing and the map instance are independent of theme changes. */
export default function DriverRouteMap({route, driverFix, locale = 'en'}: {
  route: Route; driverFix: MapPoint | null; locale?: string
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const routeOverlayRef = useRef<SVGSVGElement>(null)
  const routeGlowRef = useRef<SVGPolylineElement>(null)
  const routeCoreRef = useRef<SVGPolylineElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [roadGeometry, setRoadGeometry] = useState<MapPoint[] | null>(null)
  const gradientId = useId().replace(/:/g, '')
  const knownDestination = useMemo(() => sanitizeCoordinate({lat: route.destination_lat, lng: route.destination_lng}), [route.destination_lat, route.destination_lng])
  const knownOrigin = useMemo(() => sanitizeCoordinate({lat: route.origin_lat, lng: route.origin_lng}), [route.origin_lat, route.origin_lng])
  const destination = useResolvedPoint(knownDestination, route.destination_address, route.id)
  const routeOrigin = useResolvedPoint(knownOrigin, route.origin_address, route.id)
  const routingOrigin = routeOrigin || driverFix
  const visualOrigin = driverFix || routeOrigin
  const atDestination = Boolean(driverFix && destination && distanceMeters(driverFix, destination) < AT_DESTINATION_METERS)

  useEffect(() => {
    setRoadGeometry(null)
    if (!routingOrigin || !destination) return
    const cacheKey = previewCacheKey(route.id, routingOrigin, destination)
    const cachedGeometry = readPreviewGeometry(cacheKey)
    if (cachedGeometry) {
      setRoadGeometry(cachedGeometry)
      return
    }
    const controller = new AbortController()
    void calculateOperationsRoute([routingOrigin, destination], controller.signal, locale).then(result => {
      // The adapter's unavailable-provider fallback consists of two endpoints.
      // Never mistake that fallback for a road-following route.
      if (!controller.signal.aborted && result.coordinates.length > 2) {
        savePreviewGeometry(cacheKey, result.coordinates)
        setRoadGeometry(result.coordinates)
      }
    })
    return () => controller.abort()
  // Coordinates, rather than object identity, determine whether a request changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, routingOrigin?.lat, routingOrigin?.lng, destination?.lat, destination?.lng, locale])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current, style: osmStyle,
      center: [-80.19, 25.76], zoom: 12, attributionControl: false,
      interactive: false, fadeDuration: 0,
    })
    mapRef.current = map
    map.once('load', () => setMapReady(true))
    return () => {
      map.remove()
      mapRef.current = null
      driverMarkerRef.current = null
      destMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (visualOrigin) {
      if (!driverMarkerRef.current) driverMarkerRef.current = new maplibregl.Marker({element: markerEl('driver', Boolean(driverFix))}).setLngLat([visualOrigin.lng, visualOrigin.lat]).addTo(map)
      else driverMarkerRef.current.setLngLat([visualOrigin.lng, visualOrigin.lat])
    } else {
      driverMarkerRef.current?.remove()
      driverMarkerRef.current = null
    }
    if (destination) {
      if (!destMarkerRef.current) destMarkerRef.current = new maplibregl.Marker({element: markerEl('destination'), anchor: 'bottom'}).setLngLat([destination.lng, destination.lat]).addTo(map)
      else destMarkerRef.current.setLngLat([destination.lng, destination.lat])
    } else {
      destMarkerRef.current?.remove()
      destMarkerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, visualOrigin?.lat, visualOrigin?.lng, destination?.lat, destination?.lng])

  useEffect(() => {
    const map = mapRef.current
    const host = containerRef.current
    const wrapper = wrapperRef.current
    if (!map || !host || !wrapper || !mapReady) return
    const shell = wrapper.closest('main')
    const header = shell?.querySelector('header')
    const details = shell?.querySelector('[data-map-details]')
    const layout = () => {
      map.resize()
      const rect = host.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const headerEdge = Math.max(0, (header?.getBoundingClientRect().bottom ?? rect.top) - rect.top)
      const detailsStart = details ? details.getBoundingClientRect().top - rect.top : rect.height * .62
      wrapper.style.setProperty('--map-header-edge', `${headerEdge}px`)
      wrapper.style.setProperty('--map-details-start', `${detailsStart}px`)
      const points = [...(roadGeometry || []), ...(visualOrigin ? [visualOrigin] : []), ...(destination ? [destination] : [])]
      if (!points.length) return
      const bounds = new maplibregl.LngLatBounds()
      for (const point of points) bounds.extend([point.lng, point.lat])
      // Keep both endpoints above the badge, with room for the top dissolve.
      const available = Math.max(48, detailsStart - headerEdge)
      const top = headerEdge + Math.min(36, available * .22)
      const visibleBottom = Math.max(top + 24, Math.min(detailsStart - 18, rect.height - 24))
      const side = Math.min(48, rect.width * .1)
      map.fitBounds(bounds, {
        padding: {top, bottom: Math.max(24, rect.height - visibleBottom), left: side, right: side},
        maxZoom: points.length === 1 ? 13 : 14, duration: 0,
      })
    }
    const observer = new ResizeObserver(layout)
    observer.observe(host)
    if (header) observer.observe(header)
    if (details?.parentElement) observer.observe(details.parentElement)
    layout()
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, roadGeometry, visualOrigin?.lat, visualOrigin?.lng, destination?.lat, destination?.lng])

  useEffect(() => {
    const map = mapRef.current
    const svg = routeOverlayRef.current
    if (!map || !svg || !mapReady) return
    const sync = () => {
      const visible = Boolean(roadGeometry && !atDestination)
      svg.style.display = visible ? '' : 'none'
      if (!visible || !roadGeometry) return
      const points = roadGeometry.map(point => {
        const projected = map.project([point.lng, point.lat])
        return `${projected.x},${projected.y}`
      }).join(' ')
      routeGlowRef.current?.setAttribute('points', points)
      routeCoreRef.current?.setAttribute('points', points)
    }
    map.on('render', sync)
    sync()
    return () => { map.off('render', sync) }
  }, [mapReady, roadGeometry, atDestination])

  const atDestinationText = AT_DESTINATION_COPY[locale as keyof typeof AT_DESTINATION_COPY] || AT_DESTINATION_COPY.en
  return <div ref={wrapperRef} className={styles.wrap}>
    <div ref={containerRef} className={styles.host} aria-hidden="true"/>
    <svg ref={routeOverlayRef} className={styles.routeOverlay} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1677ff"/>
          <stop offset="100%" stopColor="#10bcca"/>
        </linearGradient>
      </defs>
      <polyline ref={routeGlowRef} className={styles.routeGlow} style={{stroke: `url(#${gradientId})`}}/>
      <polyline ref={routeCoreRef} className={styles.routeCore} style={{stroke: `url(#${gradientId})`}}/>
    </svg>
    <div className={styles.fadeOverlay} aria-hidden="true"/>
    <small className={styles.attribution}>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></small>
    {atDestination && <span className={styles.atDestination} role="status">{atDestinationText}</span>}
  </div>
}
