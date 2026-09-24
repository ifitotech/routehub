'use client'

import Link from 'next/link'
import {BookOpen, CircleHelp} from 'lucide-react'
import ManagerShell from '../manager-shell'
import {useLocale} from '../../../lib/use-preferences'
import {USER_GUIDE_URL} from '../../../lib/user-guide'

function topics(locale: string) {
  if (locale === 'es') {
    return [
      ['Hoy', 'Resumen del día: conteos, estado de los conductores e incidencias. El mapa de operaciones vive en Rutas, no aquí.'],
      ['Rutas', 'Lista del día + mapa de las paradas de hoy. Mañana aparece en la lista, no se dibuja en el mapa. Manejar rutas (mismo página) deja subir, bajar o cancelar solo lo que aún no está activo o cerrado.'],
      ['Añadir ruta', 'Tipo, conductor, origen, destino. PO solo en Pickup. Delivery no muestra PO de recogida. Return usa el flujo de sucursal. Publicar respeta las validaciones actuales.'],
      ['Contactos y equipo', 'Contactos de la sucursal. Equipo e invitaciones están en la misma pantalla de Equipo. La sucursal sin dirección se completa en Ajustes antes de crear rutas.'],
      ['Historial', 'Reportes e historial juntos: conteos y paradas ya cerradas, con evidencia.'],
      ['Legal y soporte', 'Términos, privacidad y la guía larga están en Ajustes. Soporte envía un pedido real al workspace, no un mensaje falso.'],
    ]
  }
  if (locale === 'fr') {
    return [
      ['Aujourd’hui', 'Résumé du jour. La carte opérations est dans Itinéraires.'],
      ['Itinéraires', 'Liste + carte du jour. Demain dans la liste seulement. Gérer : monter, descendre, annuler les arrêts encore ouverts.'],
      ['Nouvelle route', 'Type, conducteur, origine, destination. PO uniquement à la collecte.'],
      ['Contacts et équipe', 'Contacts de la succursale. Équipe et invitations sur la même page.'],
      ['Historique', 'Rapports et historique réunis.'],
      ['Mentions', 'Conditions, confidentialité et guide dans Réglages.'],
    ]
  }
  return [
    ['Today', 'Day summary: counts, driver status and issues. The operations map lives on Routes, not here.'],
    ['Routes', 'Today’s list plus the map of today’s stops. Tomorrow stays in the list and is not drawn. Manage (same page) lets you move or cancel only stops that are not active or completed.'],
    ['Add route', 'Type, driver, origin, destination. PO only on Pickup. Delivery does not show a pickup PO. Return uses the branch flow. Publish keeps the current validation.'],
    ['Contacts and team', 'Branch contacts. Team and invitations share one screen. A branch without an address is completed in Settings before you can create routes.'],
    ['History', 'Reports and history together: counts and closed stops with proof.'],
    ['Legal and support', 'Terms, privacy and the long guide live in Settings. Support submits a real workspace request, not a fake toast.'],
  ]
}

export default function ManagerHelpPage() {
  const {locale} = useLocale()
  const title = locale === 'es' ? 'Ayuda' : locale === 'fr' ? 'Aide' : 'Help'
  return (
    <ManagerShell active="settings">
      <div style={{maxWidth: 720, padding: '8px 4px 80px'}}>
        <p style={{margin: 0, color: 'var(--rh-blue)', fontSize: 12, fontWeight: 800, letterSpacing: '.12em'}}>ROUTEHUB MANAGER</p>
        <h1 style={{margin: '8px 0 16px', fontSize: 32, letterSpacing: '-.04em'}}>{title}</h1>
        <p style={{color: 'var(--rh-ink-soft)', lineHeight: 1.5, marginTop: 0}}>
          {locale === 'es'
            ? 'Cómo está armado Manager hoy. La lógica de rutas no cambia aquí.'
            : locale === 'fr'
              ? 'Comment Manager est organisé aujourd’hui.'
              : 'How Manager is organized today. This page does not change route logic.'}
        </p>
        <div style={{display: 'grid', gap: 12}}>
          {topics(locale).map(([heading, body]) => (
            <article key={heading} style={{padding: '16px 18px', border: '1px solid var(--rh-line)', borderRadius: 16, background: 'var(--rh-card)', boxShadow: 'var(--rh-shadow-sm)'}}>
              <h2 style={{margin: '0 0 6px', fontSize: 17}}>{heading}</h2>
              <p style={{margin: 0, color: 'var(--rh-ink-soft)', lineHeight: 1.5}}>{body}</p>
            </article>
          ))}
        </div>
        <p style={{marginTop: 22, color: 'var(--rh-muted)', fontSize: 13}}>
          <Link href="/terms">Terms</Link>
          {' · '}
          <Link href="/privacy">Privacy</Link>
          {' · '}
          <a href={USER_GUIDE_URL} target="_blank" rel="noreferrer" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <BookOpen size={14} /> Guide
          </a>
          {' · '}
          <Link href="/settings" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <CircleHelp size={14} /> Settings
          </Link>
        </p>
      </div>
    </ManagerShell>
  )
}
