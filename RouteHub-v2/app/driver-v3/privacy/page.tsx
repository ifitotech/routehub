'use client'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
import {useLocale} from '../../../lib/use-preferences'
import styles from '../driver-preferences.module.css'

const SECTIONS = [
  ['Who controls the workspace', 'Your company owns the RouteHub workspace. Administrators decide who can sign in and which routes are assigned. RouteHub provides the software.'],
  ['Account data', 'We store the name, email and phone on your profile, plus the role and branch your company assigned.'],
  ['Location', 'Location is collected after Driving Day starts and the device grants permission. Ending Driving Day stops sharing. The web app cannot collect GPS while it is closed.'],
  ['Routes and proof', 'Stops may include addresses, contacts, notes, photos, signatures and issue reports.'],
  ['Notifications', 'If you enable device notifications, this browser stores a push subscription for route alerts. You can leave them off.'],
  ['Maps', 'Addresses may be sent to geocoding providers so the map can place stops. They receive the address, not your login.'],
]

export default function DriverPrivacyPage() {
  const {t} = useLocale()
  return (
    <DriverV3Shell active="more" mode="stack" title="Privacy" backHref="/driver/settings" backLabel={t.drvBack}>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <p>ROUTEHUB</p>
          <h1>Privacy Policy</h1>
        </header>
        {SECTIONS.map(([title, body]) => (
          <section key={title} className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}
        <p className={styles.footer}>September 2, 2026</p>
      </div>
    </DriverV3Shell>
  )
}
