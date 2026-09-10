'use client'

import Link from 'next/link'
import {Building2, ChevronRight, ClipboardList, History, Send, Settings, Truck, Users} from 'lucide-react'
import {useLocale} from '../../../lib/use-preferences'
import ManagerShell from '../manager-shell'
import styles from './more.module.css'

const copy = {
  en: {eyebrow: 'WORKSPACE', title: 'More', subtitle: 'Daily extras stay here. Routes stay on Routes.', ops: 'Operations', company: 'Company', account: 'Account', team: 'Team', teamHelp: 'Invite members and manage roles.', branches: 'Branches', branchesHelp: 'Manage branch locations.', invitations: 'Invitations', invitationsHelp: 'Review sent invitations.', reports: 'Reports', reportsHelp: 'Counts and activity summaries.', settings: 'Settings', settingsHelp: 'Profile, language, theme and support.', truck: 'Truck', truckHelp: 'Vehicle records for the branch.', history: 'History', historyHelp: 'Completed stops and past days.', contacts: 'Contacts', contactsHelp: 'Saved destinations and people.'},
  es: {eyebrow: 'ESPACIO DE TRABAJO', title: 'Más', subtitle: 'Lo extra del día queda aquí. Las rutas siguen en Rutas.', ops: 'Operación', company: 'Empresa', account: 'Cuenta', team: 'Equipo', teamHelp: 'Invita miembros y administra roles.', branches: 'Sucursales', branchesHelp: 'Gestiona ubicaciones de sucursal.', invitations: 'Invitaciones', invitationsHelp: 'Revisa las invitaciones enviadas.', reports: 'Reportes', reportsHelp: 'Conteos y resumen de actividad.', settings: 'Configuración', settingsHelp: 'Perfil, idioma, tema y soporte.', truck: 'Camión', truckHelp: 'Registro del vehículo de la sucursal.', history: 'Historial', historyHelp: 'Paradas completadas y días anteriores.', contacts: 'Contactos', contactsHelp: 'Destinos y personas guardadas.'},
  fr: {eyebrow: 'ESPACE DE TRAVAIL', title: 'Plus', subtitle: 'Le reste du jour est ici. Les itinéraires restent dans Routes.', ops: 'Opérations', company: 'Entreprise', account: 'Compte', team: 'Équipe', teamHelp: 'Invitez des membres et gérez les rôles.', branches: 'Succursales', branchesHelp: 'Gérez les emplacements.', invitations: 'Invitations', invitationsHelp: 'Consultez les invitations envoyées.', reports: 'Rapports', reportsHelp: 'Totaux et activité.', settings: 'Paramètres', settingsHelp: 'Profil, langue, thème et assistance.', truck: 'Camion', truckHelp: 'Fiche véhicule de la succursale.', history: 'Historique', historyHelp: 'Arrêts terminés et jours passés.', contacts: 'Contacts', contactsHelp: 'Destinations et personnes enregistrées.'},
}

export default function ManagerMorePage() {
  const {locale} = useLocale()
  const c = copy[locale]
  const groups = [
    {title: c.ops, items: [
      {href: '/manager/truck', label: c.truck, help: c.truckHelp, Icon: Truck},
      {href: '/manager/history', label: c.history, help: c.historyHelp, Icon: History},
      {href: '/reports', label: c.reports, help: c.reportsHelp, Icon: ClipboardList},
    ]},
    {title: c.company, items: [
      {href: '/manager/team', label: c.team, help: c.teamHelp, Icon: Users},
      {href: '/manager/invitations', label: c.invitations, help: c.invitationsHelp, Icon: Send},
      {href: '/manager/branches', label: c.branches, help: c.branchesHelp, Icon: Building2},
      {href: '/contacts', label: c.contacts, help: c.contactsHelp, Icon: Users},
    ]},
    {title: c.account, items: [
      {href: '/settings', label: c.settings, help: c.settingsHelp, Icon: Settings},
    ]},
  ]
  return (
    <ManagerShell active="settings" roleLabel={c.title}>
      <div className={styles.page}>
        <header className={styles.header}>
          <p>{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <span>{c.subtitle}</span>
        </header>
        {groups.map(group => (
          <section className={styles.list} aria-label={group.title} key={group.title}>
            <p className={styles.group}>{group.title}</p>
            {group.items.map(({href, label, help, Icon}) => (
              <Link key={href} href={href} className={styles.item}>
                <span className={styles.icon}><Icon size={21} aria-hidden="true" /></span>
                <span className={styles.copy}><strong>{label}</strong><small>{help}</small></span>
                <ChevronRight size={21} aria-hidden="true" />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </ManagerShell>
  )
}
