'use client'

import {Clock3, FileText, Navigation} from 'lucide-react'
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

/** poNumber is optional - when the current stop is a Pickup with an order
    number, it joins this same row (its own circle + value, first in line)
    instead of sitting on its own separate line above/below, matching the
    reference's single "PO · distance · time" row. */
export default function DriverRouteEstimate({route, locale = 'en', poNumber}: {route: any; locale?: string; poNumber?: string | null}) {
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
    <section className={styles.estimate} data-map-estimate aria-label={locale === 'es' ? 'Resumen de ruta' : 'Route summary'}>
      <div className={styles.row}>
        {/* Always in the DOM, at the same width, even for Delivery/Return
           (no PO at all) - kept invisible rather than removed, so distance
           and time never shift position depending on whether this stop
           happens to have a PO. A stable row that occasionally looks a
           little sparse beats one that visibly jumps stop to stop. */}
        <span className={styles.metric} style={poNumber ? undefined : {visibility: 'hidden'}} aria-hidden={poNumber ? undefined : true}>
          <span className={`${styles.icon} ${styles.iconPo}`}><FileText size={15}/></span>
          <span className={styles.value}>PO {poNumber || '—'}</span>
        </span>
        <span className={styles.divider} aria-hidden="true" style={poNumber ? undefined : {visibility: 'hidden'}} />
        <span className={styles.metric}>
          <span className={`${styles.icon} ${styles.iconDistance}`}><Navigation size={15}/></span>
          <span className={styles.value}>{hasEstimate ? formatDistance(estimate!.distanceMeters!, locale) : '—'}</span>
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.metric}>
          <span className={`${styles.icon} ${styles.iconTime}`}><Clock3 size={15}/></span>
          <span className={styles.value}>{hasEstimate ? formatDuration(estimate!.durationSeconds!, locale) : '—'}</span>
        </span>
      </div>
      <span className={styles.caption}>{loading ? (locale === 'es' ? 'Calculando ruta…' : 'Calculating route…') : (locale === 'es' ? 'Referencia de la ruta · abre Mapas para navegar' : 'Route reference · open Maps to navigate')}</span>
    </section>
  )
}
