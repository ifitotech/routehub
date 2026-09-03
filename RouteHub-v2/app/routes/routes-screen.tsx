'use client'

export const dynamic = 'force-dynamic'

import ManagerShell from '../manager/manager-shell'
import {useLocale} from '../../lib/use-preferences'
import {routeCopy} from './routes-copy'

export default function Routes() {
  const {locale} = useLocale()
  const c = routeCopy[locale] || routeCopy.en
  return (
    <ManagerShell active="routes">
      <section style={{padding: '28px 24px', maxWidth: 720}}>
        <p style={{margin: 0, color: '#64748b', fontSize: 12, fontWeight: 700, letterSpacing: '.08em'}}>{c.operations.toUpperCase()}</p>
        <h1 style={{margin: '8px 0 0', fontSize: 32}}>{c.title}</h1>
        <p style={{color: '#64748b'}}>{c.subtitle}</p>
        <p style={{marginTop: 18, padding: 14, borderRadius: 12, background: '#FFF7ED', color: '#9A3412', fontSize: 14}}>
          Add Route se está restaurando. Esta pantalla ya no te saca a Manager. Recarga en un minuto; el formulario completo vuelve en el siguiente deploy.
        </p>
      </section>
    </ManagerShell>
  )
}
