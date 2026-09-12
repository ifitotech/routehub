'use client'

import {AlertTriangle, ArrowLeft, Camera, CheckCircle2, Clock3, Image as ImageIcon, MapPin, Navigation, Ruler, Signature, UserRound} from 'lucide-react'
import {useState} from 'react'
import {getSupabase} from '../../lib/supabase'
import {driverDetails, typeLabel} from './routes-model'
import type {RouteRecord} from './routes-model'
import styles from './route-detail-view.module.css'

function parseDate(value: string | null | undefined) { if (!value) return null; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? null : date }
function prettyDate(value: string | null | undefined, locale: string, fallback: string) { const date = parseDate(value); return date ? date.toLocaleString(locale, {dateStyle: 'medium', timeStyle: value?.length === 10 ? undefined : 'short'}) : fallback }
function durationLabel(route: RouteRecord) { const start = parseDate(route.route_started_at)?.getTime(); const end = parseDate(route.route_completed_at)?.getTime(); if (start == null || end == null || end < start) return ''; const minutes = Math.max(0, Math.round((end - start) / 60000)); if (minutes < 60) return `${minutes} min`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return rest ? `${hours}h ${rest}min` : `${hours}h` }
function coordinates(route: RouteRecord) { return route.completion_lat != null && route.completion_lng != null ? `${Number(route.completion_lat).toFixed(6)}, ${Number(route.completion_lng).toFixed(6)}` : '' }

// Inline read-only view of a completed/issue route's proof of delivery -
// lives in the dispatch board's own center column (same pattern as the Add
// Route focus mode) instead of navigating away to Manager > History, so
// clicking "View details" doesn't lose the calendar day you were looking at.
export default function RouteDetailView({route, locale, c, driverIndex, onClose}: {route: RouteRecord; locale: string; c: any; driverIndex?: Map<string, any>; onClose: () => void}) {
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({})
  const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const t = locale === 'es'
    ? {back: 'Volver', overview: 'Resumen', workDetails: 'Detalles del trabajo', proof: 'Prueba de entrega', issues: 'Incidencias', location: 'Ubicación', destination: 'Destino', origin: 'Origen', order: 'PO / número de orden', priority: 'Prioridad', started: 'Iniciada', completedAt: 'Completada', duration: 'Duración', completionMethod: 'Método de finalización', openLocation: 'Abrir ubicación', accuracy: 'Precisión GPS', distance: 'Distancia al completar', notes: 'Notas', driverNotes: 'Notas del conductor', viewPhoto: 'Ver foto', hidePhoto: 'Ocultar foto', viewSignature: 'Ver firma', hideSignature: 'Ocultar firma', loading: 'Cargando…', photo: 'Foto', signature: 'Firma', finalizationPhoto: 'Foto de finalización', pod: 'POD disponible', phone: 'Teléfono', warning: 'Advertencia', issueDetails: 'Detalles de la incidencia', finalizationNote: 'Nota de finalización', arrived: 'Llegada', notRecorded: 'No registrado', unableEvidence: 'No se pudo cargar la evidencia.', driver: 'Conductor'}
    : locale === 'fr'
      ? {back: 'Retour', overview: 'Résumé', workDetails: 'Détails du travail', proof: 'Preuve de livraison', issues: 'Incidents', location: 'Emplacement', destination: 'Destination', origin: 'Origine', order: 'PO / numéro de commande', priority: 'Priorité', started: 'Démarrée', completedAt: 'Terminée', duration: 'Durée', completionMethod: 'Méthode de finalisation', openLocation: 'Ouvrir l’emplacement', accuracy: 'Précision GPS', distance: 'Distance à la finalisation', notes: 'Notes', driverNotes: 'Notes du conducteur', viewPhoto: 'Voir la photo', hidePhoto: 'Masquer la photo', viewSignature: 'Voir la signature', hideSignature: 'Masquer la signature', loading: 'Chargement…', photo: 'Photo', signature: 'Signature', finalizationPhoto: 'Photo de finalisation', pod: 'POD disponible', phone: 'Téléphone', warning: 'Avertissement', issueDetails: 'Détails de l’incident', finalizationNote: 'Note de finalisation', arrived: 'Arrivée', notRecorded: 'Non enregistré', unableEvidence: 'Impossible de charger la preuve.', driver: 'Conducteur'}
      : {back: 'Back', overview: 'Overview', workDetails: 'Work details', proof: 'Proof of delivery', issues: 'Issues', location: 'Location', destination: 'Destination', origin: 'Origin', order: 'PO / order number', priority: 'Priority', started: 'Started', completedAt: 'Completed', duration: 'Duration', completionMethod: 'Completion method', openLocation: 'Open location', accuracy: 'GPS accuracy', distance: 'Distance at completion', notes: 'Notes', driverNotes: 'Driver notes', viewPhoto: 'View photo', hidePhoto: 'Hide photo', viewSignature: 'View signature', hideSignature: 'Hide signature', loading: 'Loading…', photo: 'Photo', signature: 'Signature', finalizationPhoto: 'Finalization photo', pod: 'POD available', phone: 'Phone', warning: 'Completion warning', issueDetails: 'Issue details', finalizationNote: 'Finalization note', arrived: 'Arrived', notRecorded: 'Not recorded', unableEvidence: 'Could not load evidence.', driver: 'Driver'}

  const details = driverDetails(route.driver_id ? driverIndex?.get(route.driver_id) : undefined, c.teamDriver)
  const destination = route.destination_name || route.destination_address || c.destinationPending
  const location = coordinates(route)
  const hasEvidence = Boolean(route.completion_photo_path || route.customer_signature_path || route.finalization_photo_path)
  const hasIssue = route.status === 'issue' || Boolean(route.finalization_issue || route.completion_warning)
  const duration = durationLabel(route)

  const toggleEvidence = async (kind: 'photo' | 'signature' | 'finalization') => {
    const path = kind === 'photo' ? route.completion_photo_path : kind === 'signature' ? route.customer_signature_path : route.finalization_photo_path
    if (!path || evidenceLoading) return
    const key = `${route.id}:${kind}`
    if (evidenceUrls[key]) { setEvidenceUrls(current => { const next = {...current}; delete next[key]; return next }); return }
    setEvidenceLoading(key)
    try {
      const {data, error} = await getSupabase().storage.from('route-evidence').createSignedUrl(path, 60 * 20)
      if (error) throw error
      setEvidenceUrls(current => ({...current, [key]: data.signedUrl}))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.unableEvidence)
    } finally {
      setEvidenceLoading(null)
    }
  }

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.backButton} onClick={onClose}><ArrowLeft size={16}/>{t.back}</button>
      <div className={styles.headerRow}>
        <div><span className={styles.type}>{typeLabel(route.mission_type, c)}</span><h2>{destination}</h2></div>
        <span className={`${styles.status} ${styles[`status_${route.status}`] || ''}`}>{route.status === 'completed' ? c.completedStatus : route.status === 'issue' ? c.issue : route.status}</span>
      </div>
      {message && <p className={styles.message} role="status">{message}</p>}

      <section>
        <h3>{t.overview}</h3>
        <div className={styles.grid}>
          <Detail icon={<UserRound size={14}/>} label={t.driver} value={details.name || details.email || t.notRecorded}/>
          <Detail icon={<Clock3 size={14}/>} label={t.started} value={prettyDate(route.route_started_at, locale, t.notRecorded)}/>
          <Detail icon={<CheckCircle2 size={14}/>} label={t.completedAt} value={prettyDate(route.route_completed_at || route.completed_at || route.finalized_at, locale, t.notRecorded)}/>
          {duration && <Detail icon={<Clock3 size={14}/>} label={t.duration} value={duration}/>}
          {route.completion_method && <Detail label={t.completionMethod} value={route.completion_method}/>}
        </div>
      </section>

      {(route.origin_name || route.origin_address || route.order_number || route.priority || route.notes || route.driver_note || route.destination_phone) && (
        <section>
          <h3>{t.workDetails}</h3>
          <div className={styles.grid}>
            {(route.origin_name || route.origin_address) && <Detail label={t.origin} value={route.origin_name || route.origin_address}/>}
            {route.destination_phone && <Detail label={t.phone} value={route.destination_phone}/>}
            {route.order_number && <Detail label={t.order} value={route.order_number}/>}
            {route.priority && <Detail label={t.priority} value={route.priority}/>}
            {route.notes && <Detail label={t.notes} value={route.notes} full/>}
            {route.driver_note && <Detail label={t.driverNotes} value={route.driver_note} full/>}
          </div>
        </section>
      )}

      {hasEvidence && (
        <section>
          <h3>{t.proof}</h3>
          <div className={styles.evidenceActions}>
            {route.completion_photo_path && <EvidenceButton icon={<Camera size={16}/>} label={evidenceLoading === `${route.id}:photo` ? t.loading : evidenceUrls[`${route.id}:photo`] ? t.hidePhoto : t.viewPhoto} onClick={() => void toggleEvidence('photo')}/>}
            {route.customer_signature_path && <EvidenceButton icon={<Signature size={16}/>} label={evidenceLoading === `${route.id}:signature` ? t.loading : evidenceUrls[`${route.id}:signature`] ? t.hideSignature : t.viewSignature} onClick={() => void toggleEvidence('signature')}/>}
            {route.finalization_photo_path && <EvidenceButton icon={<ImageIcon size={16}/>} label={evidenceLoading === `${route.id}:finalization` ? t.loading : t.finalizationPhoto} onClick={() => void toggleEvidence('finalization')}/>}
          </div>
          {evidenceUrls[`${route.id}:photo`] && <img className={styles.evidenceImage} src={evidenceUrls[`${route.id}:photo`]} alt={t.photo}/>}
          {evidenceUrls[`${route.id}:signature`] && <img className={styles.evidenceImage} src={evidenceUrls[`${route.id}:signature`]} alt={t.signature}/>}
          {evidenceUrls[`${route.id}:finalization`] && <img className={styles.evidenceImage} src={evidenceUrls[`${route.id}:finalization`]} alt={t.photo}/>}
        </section>
      )}

      {(hasIssue || route.finalization_note) && (
        <section className={styles.issueSection}>
          <h3><AlertTriangle size={16}/>{t.issues}</h3>
          {route.finalization_issue && <p><strong>{t.issueDetails}:</strong> {route.finalization_issue}</p>}
          {route.completion_warning && <p><strong>{t.warning}:</strong> {route.completion_warning}</p>}
          {route.finalization_note && <p><strong>{t.finalizationNote}:</strong> {route.finalization_note}</p>}
        </section>
      )}

      {(location || route.completion_accuracy != null || route.completion_distance_m != null || route.arrived_at) && (
        <section>
          <h3><MapPin size={16}/>{t.location}</h3>
          <div className={styles.grid}>
            {route.arrived_at && <Detail label={t.arrived} value={prettyDate(route.arrived_at, locale, t.notRecorded)}/>}
            {location && <div className={styles.full}><span>{t.location}</span><strong>{location}</strong><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noreferrer"><Navigation size={14}/>{t.openLocation}</a></div>}
            {route.completion_accuracy != null && <Detail label={t.accuracy} value={`±${Math.round(route.completion_accuracy)} m`}/>}
            {route.completion_distance_m != null && <Detail icon={<Ruler size={14}/>} label={t.distance} value={`${Math.round(route.completion_distance_m)} m`}/>}
          </div>
        </section>
      )}
    </div>
  )
}

function Detail({label, value, full, icon}: {label: string; value?: string | null; full?: boolean; icon?: React.ReactNode}) {
  return <div className={full ? styles.full : undefined}><span>{icon}{label}</span><strong>{value || ''}</strong></div>
}

function EvidenceButton({icon, label, onClick}: {icon: React.ReactNode; label: string; onClick: () => void}) {
  return <button type="button" className={styles.evidenceButton} onClick={onClick}>{icon}{label}</button>
}
