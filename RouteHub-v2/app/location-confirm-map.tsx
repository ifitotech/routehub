'use client'

import {useEffect, useMemo} from 'react'
import L from 'leaflet'
import {MapContainer, Marker, TileLayer, useMap, useMapEvents} from 'react-leaflet'
import {mapTileConfig} from '../lib/maps/map-config'
import type {MapCoordinate} from '../lib/maps/types'

type Props = {
  coordinate: MapCoordinate
  label: string
  onCoordinateChange?: (coordinate: MapCoordinate) => void
}

const selectedPin = L.divIcon({
  className: 'routehub-location-pin-wrap',
  html: '<span class="routehub-location-pin">●</span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

function CenterOnSelection({coordinate}: {coordinate: MapCoordinate}) {
  const map = useMap()
  useEffect(() => {
    map.setView([coordinate.lat, coordinate.lng], Math.max(map.getZoom(), 15), {animate: false})
  }, [coordinate, map])
  return null
}

function PinAdjuster({onChange}: {onChange?: (coordinate: MapCoordinate) => void}) {
  useMapEvents({
    click(event) {
      onChange?.({lat: event.latlng.lat, lng: event.latlng.lng})
    },
  })
  return null
}

export default function LocationConfirmMap({coordinate, label, onCoordinateChange}: Props) {
  const position = useMemo<[number, number]>(() => [coordinate.lat, coordinate.lng], [coordinate.lat, coordinate.lng])
  return <div className="routehub-location-confirm-map" aria-label={`Selected location: ${label}`}>
    <MapContainer center={position} zoom={15} scrollWheelZoom={false} dragging={Boolean(onCoordinateChange)}>
      <TileLayer attribution={mapTileConfig.attribution} url={mapTileConfig.url}/>
      <CenterOnSelection coordinate={coordinate}/>
      <PinAdjuster onChange={onCoordinateChange}/>
      <Marker position={position} icon={selectedPin} draggable={Boolean(onCoordinateChange)} eventHandlers={{dragend: event => {
        const point = event.target.getLatLng() as {lat: number; lng: number}
        onCoordinateChange?.({lat: point.lat, lng: point.lng})
      }}}/>
    </MapContainer>
  </div>
}
