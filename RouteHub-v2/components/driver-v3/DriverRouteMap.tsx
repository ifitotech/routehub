'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {sanitizeCoordinate, type MapPoint} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import {distanceMeters} from '../../lib/location'
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

const AT_DESTINATION_COPY = {
  en: 'At destination',
  es: 'En destino',
  fr: 'Sur place',
}

// Under this, drawing a "route" would just be noise - the driver is
// effectively already there.
const AT_DESTINATION_METERS = 45

// Real OpenStreetMap tiles, no key, no account - this preview is context,
// not turn-by-turn, so an approximate straight line between two points is
// the right amount of accuracy, not a road-following route.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{id: 'osm', type: 'raster', source: 'osm'}],
}

function markerEl(kind: 'driver' | 'destination', live = true) {
  const el = document.createElement('div')
  el.className = kind === 'driver' ? styles.driverMarker : styles.destinationMarker
  const dot = document.createElement('span')
  // The pulse animation reads as "this is moving, live GPS" - when there is
  // no real fix yet and this is standing in for the route's own starting
  // point instead, it should sit still rather than imply a live signal
  // that isn't there.
  dot.className = kind === 'driver' ? `${styles.driverDot}${live ? '' : ` ${styles.driverDotStatic}`}` : styles.destinationPin
  el.appendChild(dot)
  return el
}

function lineGeoJson(from: MapPoint, to: MapPoint): GeoJSON.Feature<GeoJSON.LineString> {
  return {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]]}}
}

/** Resolves a stop's coordinate: the lat/lng already on the record when
    present, geocoding its address only when it isn't - as real React state,
    not a ref, so a geocode result that arrives later actually triggers the
    map update effect instead of getting silently missed. */
function useResolvedPoint(known: MapPoint | null, address: string | null | undefined, routeId: string) {
  const [point, setPoint] = useState<MapPoint | null>(known)
  useEffect(() => {
    if (known) { setPoint(known); return }
    if (!address?.trim()) { setPoint(null); return }
    let cancelled = false
    const controller = new AbortController()
    void geocodeAddress(address, controller.signal).then(result => {
      if (!cancelled) setPoint(result?.coordinate || null)
    })
    return () => { cancelled = true; controller.abort() }
  }, [routeId, known, address])
  return point
}

/**
 * A styled, non-interactive map that is illustrative context, never real
 * navigation - the driver's own live position (blue) and the current stop
 * (gold/teal), joined by an approximate line. The map instance is created
 * once and never torn down for a GPS tick; only the marker positions and
 * the line's data update, so the view never jumps or reloads while a
 * driver is watching it.
 */
export default function DriverRouteMap({route, driverFix, locale = 'en'}: {route: Route; driverFix: {lat: number; lng: number} | null; locale?: string}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const firstFitRef = useRef(false)
  const lastRouteIdRef = useRef<string | null>(null)
  const [atDestination, setAtDestination] = useState(false)

  const knownDestination = useMemo(() => sanitizeCoordinate({lat: route.destination_lat, lng: route.destination_lng}), [route.destination_lat, route.destination_lng])
  const knownOrigin = useMemo(() => sanitizeCoordinate({lat: route.origin_lat, lng: route.origin_lng}), [route.origin_lat, route.origin_lng])
  const destination = useResolvedPoint(knownDestination, route.destination_address, route.id)
  // Fallback used only while there is no live GPS fix yet (permission not
  // granted, Driving Day not on, no signal indoors) - so the map still
  // shows a real A-to-B line instead of sitting empty with only a pin.
  const routeOrigin = useResolvedPoint(knownOrigin, route.origin_address, route.id)

  // Create the map exactly once. Everything after this effect only ever
  // updates existing layers/markers, never calls `new maplibregl.Map(...)`
  // again - that is what "don't reinitialize on every GPS fix" means.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [-80.19, 25.76],
      zoom: 12,
      attributionControl: {compact: true},
      interactive: false, // context only - real navigation is "Open Maps"
      fadeDuration: 0,
    })
    mapRef.current = map
    map.on('load', () => {
      map.addSource('rh-route-line', {type: 'geojson', data: {type: 'FeatureCollection', features: []}})
      // Two passes of the same line - a wide, soft, low-opacity glow layer
      // under a slim, saturated core - is the same neon-line look the
      // abstract glyph used, now drawn on the real map.
      map.addLayer({id: 'rh-route-glow', type: 'line', source: 'rh-route-line', paint: {'line-color': '#2493FF', 'line-width': 9, 'line-opacity': 0.22, 'line-blur': 3}, layout: {'line-cap': 'round', 'line-join': 'round'}})
      map.addLayer({id: 'rh-route-core', type: 'line', source: 'rh-route-line', paint: {'line-color': '#37E0C9', 'line-width': 3, 'line-opacity': 0.9}, layout: {'line-cap': 'round', 'line-join': 'round'}})
      const canvas = map.getCanvas()
      canvas.classList.add(styles.canvas)
      map.resize()
    })
    return () => {
      map.remove()
      mapRef.current = null
      driverMarkerRef.current = null
      destMarkerRef.current = null
      firstFitRef.current = false
    }
  }, [])

  // The one function that actually touches the live map: moves the two
  // markers and rewrites the line's coordinates. Runs on mount (once the
  // style has loaded) and whenever the driver's fix, the route's origin, or
  // the destination change - never re-creates the map itself.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (!map.getSource('rh-route-line')) return
      // A new stop gets its own initial framing instead of inheriting the
      // previous one's already-fit view.
      if (lastRouteIdRef.current !== route.id) {
        lastRouteIdRef.current = route.id
        firstFitRef.current = false
      }
      // Prefer the driver's real live position; when there isn't one yet,
      // fall back to the route's own starting point.
      const origin = driverFix || routeOrigin
      const live = Boolean(driverFix)

      if (origin) {
        if (!driverMarkerRef.current) driverMarkerRef.current = new maplibregl.Marker({element: markerEl('driver', live)}).setLngLat([origin.lng, origin.lat]).addTo(map)
        else {
          driverMarkerRef.current.setLngLat([origin.lng, origin.lat])
          driverMarkerRef.current.getElement().querySelector(`.${styles.driverDot}`)?.classList.toggle(styles.driverDotStatic, !live)
        }
      } else if (driverMarkerRef.current) {
        driverMarkerRef.current.remove()
        driverMarkerRef.current = null
      }
      if (destination) {
        if (!destMarkerRef.current) destMarkerRef.current = new maplibregl.Marker({element: markerEl('destination'), anchor: 'bottom'}).setLngLat([destination.lng, destination.lat]).addTo(map)
        else destMarkerRef.current.setLngLat([destination.lng, destination.lat])
      } else if (destMarkerRef.current) {
        destMarkerRef.current.remove()
        destMarkerRef.current = null
      }

      const lineSource = map.getSource('rh-route-line') as maplibregl.GeoJSONSource
      if (origin && destination) {
        // Only a real live fix counts as "arrived" - a route whose static
        // origin happens to equal its destination isn't the driver being
        // at the stop, it's just a same-point route.
        const atStop = live && distanceMeters(origin, destination) < AT_DESTINATION_METERS
        setAtDestination(atStop)
        // A near-zero-length line reads as a rendering glitch, not "you've
        // arrived" - clear it instead of drawing a fake route when the
        // driver is effectively already at the stop.
        lineSource.setData(atStop ? {type: 'FeatureCollection', features: []} : lineGeoJson(origin, destination))
      } else {
        setAtDestination(false)
        lineSource.setData({type: 'FeatureCollection', features: []})
      }

      // Fit the view once real points are first available (or the
      // destination changes to a new stop) - not on every GPS tick, so the
      // map holds still while the driver is watching it move. With only a
      // destination (no origin at all yet), center on that alone.
      if (!firstFitRef.current && origin && destination) {
        firstFitRef.current = true
        map.fitBounds([[Math.min(origin.lng, destination.lng), Math.min(origin.lat, destination.lat)], [Math.max(origin.lng, destination.lng), Math.max(origin.lat, destination.lat)]], {padding: 56, maxZoom: 15, duration: 0})
      } else if (!firstFitRef.current && destination) {
        firstFitRef.current = true
        map.jumpTo({center: [destination.lng, destination.lat], zoom: 14})
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  // Depends on the coordinates themselves, not the `driverFix` object
  // reference, on purpose - a new object with the same lat/lng (e.g. a
  // parent re-render) must not re-run this and reset the map's state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverFix?.lat, driverFix?.lng, route.id, destination?.lat, destination?.lng, routeOrigin?.lat, routeOrigin?.lng])

  // The map's own size is driven by the parent's CSS (large before start,
  // compact once started) - MapLibre needs an explicit resize() when that
  // container changes, it doesn't observe it on its own.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const atDestinationText = AT_DESTINATION_COPY[locale as keyof typeof AT_DESTINATION_COPY] || AT_DESTINATION_COPY.en

  return <div className={styles.wrap}>
    <div ref={containerRef} className={styles.host} aria-hidden="true"/>
    {atDestination && <span className={styles.atDestination} role="status">{atDestinationText}</span>}
  </div>
}
