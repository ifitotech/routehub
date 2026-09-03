'use client'
import Link from 'next/link'
import {CircleHelp, Mail, MessageCircle} from 'lucide-react'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'
import styles from '../driver-preferences.module.css'

export default function DriverHelpPage() {
  const {locale, t} = useLocale()
  const copy = locale === 'es'
    ? {
        title: 'Ayuda',
        intro: 'Si una ruta, el GPS o una entrega no coinciden con lo asignado, reporta la parada con Issue. Para acceso a la cuenta escribe a tu sucursal.',
        issue: 'En Today o en la parada, usa Issue para dejar foto y nota. Eso llega a la sucursal.',
        account: 'Usuario, camión y sucursal los administra tu empresa. RouteHub no cambia roles desde esta pantalla.',
        mail: 'Soporte de producto',
      }
    : locale === 'fr'
      ? {
          title: 'Aide',
          intro: 'Si une route, le GPS ou une livraison ne correspond pas, signalez l’arrêt avec Incident. Pour le compte, contactez votre succursale.',
          issue: 'Dans Today ou l’arrêt, utilisez Incident pour photo et note. La succursale le reçoit.',
          account: 'Le compte, le camion et la succursale sont gérés par votre entreprise.',
          mail: 'Support produit',
        }
      : {
          title: 'Help',
          intro: 'If a route, GPS or delivery does not match the assignment, report the stop with Issue. Account access is handled by your branch.',
          issue: 'On Today or the stop, use Issue to leave a photo and note. Your branch sees it.',
          account: 'User, truck and branch are managed by your company. RouteHub does not change roles from this screen.',
          mail: 'Product support',
        }

  return (
    <DriverV3Shell active="more" mode="stack" title={copy.title} backHref="/driver/settings" backLabel={t.drvBack}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>ROUTEHUB</p>
          <h1>{copy.title}</h1>
        </header>
        <section className={styles.section}>
          <div className={styles.row}>
            <span className={styles.rowIcon}><CircleHelp size={18} /></span>
            <span className={styles.rowCopy}><strong>{copy.title}</strong><small>{copy.intro}</small></span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowIcon}><MessageCircle size={18} /></span>
            <span className={styles.rowCopy}><strong>Issue</strong><small>{copy.issue}</small></span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowIcon}><Mail size={18} /></span>
            <span className={styles.rowCopy}><strong>{copy.mail}</strong><small>{copy.account}</small></span>
          </div>
        </section>
        <p className={styles.footer}>
          <Link href="/driver/privacy">{locale === 'es' ? 'Privacidad' : locale === 'fr' ? 'Confidentialité' : 'Privacy'}</Link>
          {' · '}
          <Link href="/terms">Terms</Link>
        </p>
      </div>
    </DriverV3Shell>
  )
}
