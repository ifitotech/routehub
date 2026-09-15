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
const STATIC_MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY

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

function encodePolyline(points: MapPoint[]) {
  let previousLat = 0
  let previousLng = 0
  let output = ''
  const encode = (value: number) => {
    let next = value < 0 ? ~(value << 1) : value << 1
    while (next >= 0x20) {
      output += String.fromCharCode((0x20 | (next & 0x1f)) + 63)
      next >>= 5
    }
    output += String.fromCharCode(next + 63)
  }
  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lng = Math.round(point.lng * 1e5)
    encode(lat - previousLat)
    encode(lng - previousLng)
    previousLat = lat
    previousLng = lng
  }
  return output
}

function staticMapUrl(key: string, origin: MapPoint, destination: MapPoint, geometry: MapPoint[], theme: 'light' | 'dark') {
  const points = geometry.length > 2 ? geometry : [origin, destination]
  const latitudes = points.map(point => point.lat)
  const longitudes = points.map(point => point.lng)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)
  // Static Maps otherwise hugs the path too tightly. These four invisible
  // viewport anchors add a stable visual margin so the route remains visible
  // above the Today details instead of being hidden by the fade/card.
  const latMargin = Math.max((maxLat - minLat) * .14, .018)
  const lngMargin = Math.max((maxLng - minLng) * .14, .018)
  const query = new URLSearchParams({
    size: '640x640', scale: '2', format: 'png', maptype: 'roadmap', key,
    markers: `size:mid|color:0x1677ffff|${origin.lat},${origin.lng}`,
  })
  query.append('markers', `size:mid|color:0xffbd4aff|${destination.lat},${destination.lng}`)
  query.append('visible', `${minLat - latMargin},${minLng - lngMargin}`)
  query.append('visible', `${maxLat + latMargin},${maxLng + lngMargin}`)
  // Do not invent a straight line while routing is unavailable. A static
  // preview either has the verified road geometry or simply shows its stops.
  if (geometry.length > 2) query.append('path', `weight:5|color:0x149cfaff|enc:${encodePolyline(geometry)}`)
  if (theme === 'dark') {
    query.append('style', 'feature:all|element:geometry|color:0x11233c')
    query.append('style', 'feature:road|element:geometry|color:0x294968')
    query.append('style', 'feature:water|element:geometry|color:0x0a1a31')
    query.append('style', 'feature:all|element:labels.text.fill|color:0xaec0d8')
    query.append('style', 'feature:all|element:labels.text.stroke|color:0x11233c')
  } else {
    query.append('style', 'feature:all|element:geometry|color:0xf2f6fb')
    query.append('style', 'feature:road|element:geometry|color:0xd9e5f1')
    query.append('style', 'feature:water|element:geometry|color:0xd3e8f5')
    query.append('style', 'feature:all|element:labels.text.fill|color:0x58718e')
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${query.toString()}`
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
function LiveDriverRouteMap({route, driverFix, locale = 'en'}: {
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

function StaticDriverRouteMap({route, driverFix, locale = 'en'}: {
  route: Route; driverFix: MapPoint | null; locale?: string
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [roadGeometry, setRoadGeometry] = useState<MapPoint[] | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const knownDestination = useMemo(() => sanitizeCoordinate({lat: route.destination_lat, lng: route.destination_lng}), [route.destination_lat, route.destination_lng])
  const knownOrigin = useMemo(() => sanitizeCoordinate({lat: route.origin_lat, lng: route.origin_lng}), [route.origin_lat, route.origin_lng])
  const destination = useResolvedPoint(knownDestination, route.destination_address, route.id)
  const routeOrigin = useResolvedPoint(knownOrigin, route.origin_address, route.id)
  const routingOrigin = routeOrigin || driverFix
  const atDestination = Boolean(driverFix && destination && distanceMeters(driverFix, destination) < AT_DESTINATION_METERS)

  useEffect(() => {
    const syncTheme = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
    syncTheme()
    window.addEventListener('routehub:theme-change', syncTheme)
    return () => window.removeEventListener('routehub:theme-change', syncTheme)
  }, [])

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
      if (!controller.signal.aborted && result.coordinates.length > 2) {
        savePreviewGeometry(cacheKey, result.coordinates)
        setRoadGeometry(result.coordinates)
      } else if (!controller.signal.aborted) {
        setRoadGeometry([])
      }
    })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id, routingOrigin?.lat, routingOrigin?.lng, destination?.lat, destination?.lng, locale])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const shell = wrapper.closest('main')
    const header = shell?.querySelector('header')
    const details = shell?.querySelector('[data-map-details]')
    const layout = () => {
      const rect = wrapper.getBoundingClientRect()
      const headerEdge = Math.max(0, (header?.getBoundingClientRect().bottom ?? rect.top) - rect.top)
      const detailsStart = details ? details.getBoundingClientRect().top - rect.top : rect.height * .62
      wrapper.style.setProperty('--map-header-edge', `${headerEdge}px`)
      wrapper.style.setProperty('--map-details-start', `${detailsStart}px`)
    }
    const observer = new ResizeObserver(layout)
    observer.observe(wrapper)
    if (header) observer.observe(header)
    if (details?.parentElement) observer.observe(details.parentElement)
    layout()
    return () => observer.disconnect()
  }, [])

  const imageUrl = STATIC_MAP_KEY && routingOrigin && destination && roadGeometry !== null
    ? staticMapUrl(STATIC_MAP_KEY, routingOrigin, destination, roadGeometry || [], theme)
    : null
  const atDestinationText = AT_DESTINATION_COPY[locale as keyof typeof AT_DESTINATION_COPY] || AT_DESTINATION_COPY.en
  return <div ref={wrapperRef} className={styles.wrap}>
    {imageUrl ? <img className={styles.staticImage} src={imageUrl} alt="" aria-hidden="true"/> : <div className={styles.staticLoading} aria-hidden="true"/>}
    <div className={styles.fadeOverlay} aria-hidden="true"/>
    {atDestination && <span className={styles.atDestination} role="status">{atDestinationText}</span>}
  </div>
}

/** Today uses a zero-JavaScript map image when the browser-restricted Google
 * Static Maps key is configured. Older/local environments safely retain the
 * MapLibre preview until that key is available. */
export default function DriverRouteMap(props: {route: Route; driverFix: MapPoint | null; locale?: string}) {
  return STATIC_MAP_KEY ? <StaticDriverRouteMap {...props}/> : <LiveDriverRouteMap {...props}/>
}
