import Link from 'next/link'
import {ArrowLeft, Shield} from 'lucide-react'

export const metadata = {title: 'Privacy Policy'}

const sections = [
  ['1. Who controls the workspace', 'Your company owns the RouteHub workspace. Administrators decide who can sign in, which routes are assigned and how long records are kept. RouteHub provides the software; the company is responsible for its workplace policy.'],
  ['2. Account data', 'We store the name, email and phone you save on your profile, plus the role and branch your company assigned. Sign-in is handled by the authentication provider configured for this workspace.'],
  ['3. Location', 'Location is collected only after a driver starts Driving Day and the device grants permission. Updates are used so the branch can see the live route during that work period. Ending Driving Day stops sharing. RouteHub cannot collect GPS while the browser tab is closed (web PWA). Device permission can be withdrawn in system settings.'],
  ['4. Routes and proof', 'Assigned stops may include addresses, contact names, phone numbers, notes, photos, signatures and issue reports. Upload only what the stop requires.'],
  ['5. Notifications', 'If you enable device notifications, this browser stores a push subscription so RouteHub can send new-route and route-change alerts. You can leave notifications off. Disabling them fully may also require the device Settings app.'],
  ['6. Maps', 'Addresses may be sent to geocoding and routing providers (Google, then public fallbacks) so the map can place stops. Those providers receive the address string, not your login.'],
  ['7. Access and retention', 'Access follows workspace roles. The company administrator handles retention and deletion requests for company records. For product questions use Help in Settings.'],
  ['8. Changes', 'This policy matches the current beta (August–September 2026). A new version will be published on this page when processing changes.'],
]

export default function PrivacyPage() {
  return (
    <main style={{maxWidth: 860, margin: '0 auto', padding: '32px 24px 120px'}}>
      <Link href="/driver/settings" style={{display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2468df', fontWeight: 800, textDecoration: 'none'}}>
        <ArrowLeft size={17} /> Back
      </Link>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 34}}>
        <div style={{display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 15, background: '#eaf2ff', color: '#2468df'}}>
          <Shield size={26} />
        </div>
        <div>
          <p style={{margin: 0, color: '#2468df', fontSize: 12, fontWeight: 900, letterSpacing: '.14em'}}>ROUTEHUB</p>
          <h1 style={{margin: '4px 0 0', fontSize: 'clamp(34px,6vw,54px)', letterSpacing: '-.05em'}}>Privacy Policy</h1>
        </div>
      </div>
      <p style={{maxWidth: 700, color: '#607089', fontSize: 18, lineHeight: 1.55, margin: '22px 0 32px'}}>
        How RouteHub uses account, location, route and notification data in this beta. This page is a product description, not legal advice.
      </p>
      <section style={{display: 'grid', gap: 14}}>
        {sections.map(([title, body]) => (
          <article key={title} style={{padding: '20px 22px', border: '1px solid #dce5f0', borderRadius: 18, background: '#fff', boxShadow: '0 8px 24px rgba(20,35,59,.06)'}}>
            <h2 style={{margin: '0 0 8px', fontSize: 19}}>{title}</h2>
            <p style={{margin: 0, color: '#607089', lineHeight: 1.55}}>{body}</p>
          </article>
        ))}
      </section>
      <p style={{marginTop: 28, color: '#8a98aa', fontSize: 13, lineHeight: 1.55}}>
        Last updated: September 2, 2026 · Terms of Use: <Link href="/terms">/terms</Link>
      </p>
    </main>
  )
}
