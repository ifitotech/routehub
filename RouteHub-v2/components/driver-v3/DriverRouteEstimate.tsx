'use client'

import {Clock3, MapPin, Route as RouteIcon} from 'lucide-react'
import {useEffect, useState} from 'react'
import {calculateOperationsRoute} from '../../lib/maps/routing'
import {geocodeAddress} from '../../lib/maps/geocoding'
import type {RouteEstimate} from '../../lib/maps/types'
import styles from './DriverRouteEstimate.module.css'

type Point = {lat: number; lng: number}

function point(value: unknown): Point | null {
  const lat = Number(value && typeof value === 'object' && 'lat' in value ? (value as {lat: unknown}).lat : NaN)
  const lng = Number(value && typeof value === 'object' && 'lng' in value ? (value as {lng: unknown}).lng : NaN)
  return Number.isFinite(lat) && Number.isFinite(lng) ? {lat, lng} : null
}

function formatDistance(meters: number, locale: string) {
  const miles = meters / 1609.344
  if (locale === 'es') return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`
}

function formatDuration(seconds: number, locale: string) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} ${locale === 'es' ? 'min' : 'min'}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours} h${rest ? ` ${rest} min` : ''}`
}

export default function DriverRouteEstimate({route, locale = 'en'}: {route: any; locale?: string}) {
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const origin = point({lat: route?.origin_lat, lng: route?.origin_lng}) || (await geocodeAddress(String(route?.origin_address || ''), controller.signal))?.coordinate || null
        const destination = point({lat: route?.destination_lat, lng: route?.destination_lng}) || (await geocodeAddress(String(route?.destination_address || route?.destination_name || ''), controller.signal))?.coordinate || null
        if (!origin || !destination) return
        const result = await calculateOperationsRoute([origin, destination], controller.signal, locale)
        if (!controller.signal.aborted) setEstimate(result)
      } catch {
        if (!controller.signal.aborted) setEstimate(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void run()
    return () => controller.abort()
  }, [locale, route?.id, route?.origin_address, route?.origin_lat, route?.origin_lng, route?.destination_address, route?.destination_name, route?.destination_lat, route?.destination_lng])

  const hasEstimate = Boolean(estimate?.distanceMeters != null && estimate?.durationSeconds != null)
  return (
    <section className={styles.estimate} aria-label={locale === 'es' ? 'Resumen de ruta' : 'Route summary'}>
      <div className={styles.metric}>
        <span className={styles.icon}><RouteIcon size={18}/></span>
        <span><strong>{hasEstimate ? formatDistance(estimate!.distanceMeters!, locale) : '—'}</strong><small>{locale === 'es' ? 'distancia' : 'distance'}</small></span>
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.metric}>
        <span className={styles.icon}><Clock3 size={18}/></span>
        <span><strong>{hasEstimate ? formatDuration(estimate!.durationSeconds!, locale) : '—'}</strong><small>{locale === 'es' ? 'tiempo estimado' : 'estimated time'}</small></span>
      </div>
      <span className={styles.caption}>{loading ? (locale === 'es' ? 'Calculando ruta…' : 'Calculating route…') : (locale === 'es' ? 'Referencia de la ruta · abre Mapas para navegar' : 'Route reference · open Maps to navigate')}</span>
    </section>
  )
}
