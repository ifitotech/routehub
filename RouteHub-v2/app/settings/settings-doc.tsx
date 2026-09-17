'use client'

import Link from 'next/link'
import {ArrowLeft} from 'lucide-react'
import ManagerShell from '../manager/manager-shell'
import {useLocale} from '../../lib/use-preferences'
import styles from './settings.module.css'

export function SettingsDoc({
  title,
  intro,
  sections,
}: {
  title: string
  intro: string
  sections: [string, string][]
}) {
  const {locale} = useLocale()
  const back = locale === 'es' ? 'Ajustes' : locale === 'fr' ? 'Réglages' : 'Settings'
  return (
    <ManagerShell active="settings">
      <div className={styles.page}>
        <Link href="/settings" className={styles.row} style={{border: '1px solid var(--rh-line)', borderRadius: 12, marginBottom: 16, width: 'fit-content', minHeight: 40, padding: '8px 12px'}}>
          <ArrowLeft size={16} />
          <span className={styles.copy}><strong>{back}</strong></span>
        </Link>
        <p className={styles.eyebrow}>ROUTEHUB MANAGER</p>
        <h1>{title}</h1>
        <p className={styles.hint} style={{margin: '0 0 18px', maxWidth: 640}}>{intro}</p>
        <div style={{display: 'grid', gap: 10}}>
          {sections.map(([heading, body]) => (
            <article key={heading} className={styles.card} style={{padding: '14px 16px'}}>
              <strong style={{display: 'block', marginBottom: 6, fontSize: 15}}>{heading}</strong>
              <p className={styles.hint} style={{margin: 0}}>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </ManagerShell>
  )
}
