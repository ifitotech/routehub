'use client'

import Link from 'next/link'
import {ChevronRight, FileText, Send, Settings, Users} from 'lucide-react'
import {useLocale} from '../../../lib/use-preferences'
import styles from './more.module.css'
import ManagerShell from '../manager-shell'

const copy = {
  en: {eyebrow: 'WORKSPACE', title: 'More', subtitle: 'Team, branch tools and account settings.', team: 'Team', teamHelp: 'Invite members and manage roles.', branches: 'Branches', branchesHelp: 'Manage branch locations and details.', invitations: 'Invitations', invitationsHelp: 'Review sent invitations.', reports: 'Reports', reportsHelp: 'Review route activity and delivery history.', settings: 'Settings', settingsHelp: 'Profile, language, theme and support.'},
  es: {eyebrow: 'ESPACIO DE TRABAJO', title: 'Más', subtitle: 'Equipo, herramientas de sucursal y configuración.', team: 'Equipo', teamHelp: 'Invita miembros y administra roles.', branches: 'Sucursales', branchesHelp: 'Gestiona ubicaciones y detalles de sucursales.', invitations: 'Invitaciones', invitationsHelp: 'Revisa las invitaciones enviadas.', reports: 'Reportes', reportsHelp: 'Revisa la actividad de rutas e historial de entregas.', settings: 'Configuración', settingsHelp: 'Perfil, idioma, tema y soporte.'},
  fr: {eyebrow: 'ESPACE DE TRAVAIL', title: 'Plus', subtitle: 'Équipe, outils de succursale et paramètres.', team: 'Équipe', teamHelp: 'Invitez des membres et gérez les rôles.', branches: 'Succursales', branchesHelp: 'Gérez les emplacements et informations des succursales.', invitations: 'Invitations', invitationsHelp: 'Consultez les invitations envoyées.', reports: 'Rapports', reportsHelp: 'Consultez l’activité des itinéraires et les livraisons.', settings: 'Paramètres', settingsHelp: 'Profil, langue, thème et assistance.'},
}

export default function ManagerMorePage() {
  const {locale} = useLocale()
  const c = copy[locale]
  const links = [
    {href: '/manager/team', label: c.team, help: c.teamHelp, Icon: Users},
    {href: '/manager/invitations', label: c.invitations, help: c.invitationsHelp, Icon: Send},
    {href: '/reports', label: c.reports, help: c.reportsHelp, Icon: FileText},
    {href: '/settings', label: c.settings, help: c.settingsHelp, Icon: Settings},
  ]
  return <ManagerShell active="settings"><div className={styles.page}>
    <header className={styles.header}>
      <p>{c.eyebrow}</p>
      <h1>{c.title}</h1>
      <span>{c.subtitle}</span>
    </header>
    <section className={styles.list} aria-label={c.title}>
      {links.map(({href, label, help, Icon}) => <Link key={href} href={href} className={styles.item}>
        <span className={styles.icon}><Icon size={21} aria-hidden="true" /></span>
        <span className={styles.copy}><strong>{label}</strong><small>{help}</small></span>
        <ChevronRight size={21} aria-hidden="true" />
      </Link>)}
    </section>
  </div></ManagerShell>
}
