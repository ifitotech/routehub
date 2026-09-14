'use client'

import {useEffect, useMemo, useRef} from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {sanitizeCoordinate, type MapPoint} from '../../lib/maps/coordinates'
import {geocodeAddress} from '../../lib/maps/geocoding'
import styles from './DriverRouteMap.module.css'

type Route = {
  id: string
  destination_address?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
}

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

function markerEl(kind: 'driver' | 'destination') {
  const el = document.createElement('div')
  el.className = kind === 'driver' ? styles.driverMarker : styles.destinationMarker
  const dot = document.createElement('span')
  dot.className = kind === 'driver' ? styles.driverDot : styles.destinationPin
  el.appendChild(dot)
  return el
}

function lineGeoJson(from: MapPoint, to: MapPoint): GeoJSON.Feature<GeoJSON.LineString> {
  return {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]]}}
}

/**
 * A styled, non-interactive map that is illustrative context, never real
 * navigation - the driver's own live position (blue) and the current stop
 * (gold/teal), joined by an approximate line. The map instance is created
 * once and never torn down for a GPS tick; only the marker positions and
 * the line's data update, so the view never jumps or reloads while a
 * driver is watching it.
 */
export default function DriverRouteMap({route, driverFix}: {route: Route; driverFix: {lat: number; lng: number} | null}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destMarkerRef = useRef<maplibregl.Marker | null>(null)
  const destinationRef = useRef<MapPoint | null>(null)
  const firstFitRef = useRef(false)

  const knownDestination = useMemo(() => sanitizeCoordinate({lat: route.destination_lat, lng: route.destination_lng}), [route.destination_lat, route.destination_lng])

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
      map.addSource('rh-route-line', {type: 'geojson', data: lineGeoJson({lat: 25.76, lng: -80.19}, {lat: 25.76, lng: -80.19})})
      // Two passes of the same line - a wide, soft, low-opacity glow layer
      // under a slim, saturated core - is the same neon-line look the
      // abstract glyph used, now drawn on the real map.
      map.addLayer({id: 'rh-route-glow', type: 'line', source: 'rh-route-line', paint: {'line-color': '#2493FF', 'line-width': 9, 'line-opacity': 0.22, 'line-blur': 3}, layout: {'line-cap': 'round', 'line-join': 'round'}})
      map.addLayer({id: 'rh-route-core', type: 'line', source: 'rh-route-line', paint: {'line-color': '#37E0C9', 'line-width': 3, 'line-opacity': 0.9}, layout: {'line-cap': 'round', 'line-join': 'round'}})
      const canvas = map.getCanvas()
      canvas.classList.add(styles.canvas)
    })
    return () => {
      map.remove()
      mapRef.current = null
      driverMarkerRef.current = null
      destMarkerRef.current = null
      firstFitRef.current = false
    }
  }, [])

  // Resolve the destination once per stop: prefer the coordinate already on
  // the route record, geocode its address only when that is missing.
  useEffect(() => {
    let cancelled = false
    if (knownDestination) {
      destinationRef.current = knownDestination
    } else if (route.destination_address?.trim()) {
      const controller = new AbortController()
      void geocodeAddress(route.destination_address, controller.signal).then(result => {
        if (cancelled) return
        destinationRef.current = result?.coordinate || null
      })
      return () => { cancelled = true; controller.abort() }
    } else {
      destinationRef.current = null
    }
    return () => { cancelled = true }
  }, [route.id, knownDestination, route.destination_address])

  // The one function that actually touches the live map: moves the two
  // markers and rewrites the line's coordinates. Runs on mount (once the
  // style has loaded), whenever the driver's GPS fix changes, and whenever
  // the destination resolves - never re-creates anything.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const destination = destinationRef.current
    const apply = () => {
      if (!map.getSource('rh-route-line')) return
      const origin = driverFix ? {lat: driverFix.lat, lng: driverFix.lng} : destination
      if (!origin) return

      if (driverFix) {
        if (!driverMarkerRef.current) driverMarkerRef.current = new maplibregl.Marker({element: markerEl('driver')}).setLngLat([driverFix.lng, driverFix.lat]).addTo(map)
        else driverMarkerRef.current.setLngLat([driverFix.lng, driverFix.lat])
      }
      if (destination) {
        if (!destMarkerRef.current) destMarkerRef.current = new maplibregl.Marker({element: markerEl('destination'), anchor: 'bottom'}).setLngLat([destination.lng, destination.lat]).addTo(map)
        else destMarkerRef.current.setLngLat([destination.lng, destination.lat])
      }
      if (driverFix && destination) {
        (map.getSource('rh-route-line') as maplibregl.GeoJSONSource).setData(lineGeoJson(driverFix, destination))
      }
      // Fit the view once real points are first available (or the
      // destination changes to a new stop) - not on every GPS tick, so the
      // map holds still while the driver is watching it move.
      if (!firstFitRef.current && driverFix && destination) {
        firstFitRef.current = true
        map.fitBounds([[Math.min(driverFix.lng, destination.lng), Math.min(driverFix.lat, destination.lat)], [Math.max(driverFix.lng, destination.lng), Math.max(driverFix.lat, destination.lat)]], {padding: 56, maxZoom: 15, duration: 0})
      } else if (!firstFitRef.current && destination) {
        firstFitRef.current = true
        map.jumpTo({center: [destination.lng, destination.lat], zoom: 14})
      }
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [driverFix?.lat, driverFix?.lng, route.id, knownDestination])

  // The map's own size is driven by the parent's CSS (large before start,
  // compact once started) - MapLibre needs an explicit resize() when that
  // container changes, it doesn't observe it on its own.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return <div ref={containerRef} className={styles.host} aria-hidden="true"/>
}
