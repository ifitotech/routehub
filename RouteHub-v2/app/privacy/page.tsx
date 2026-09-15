import Link from 'next/link'
import {ArrowLeft, Shield} from 'lucide-react'

export const metadata = {title: 'Privacy Policy · RouteHub'}

const sections = [
  ['1. Who is responsible',
    'The company that invited you owns the RouteHub workspace. That company decides who can sign in, which routes exist and how long records stay. RouteHub operates the software. This page explains what the software stores so drivers and managers can use the product with clear expectations. It is a product description, not legal advice.'],
  ['2. Account',
    'We store the name, email and phone saved on the profile, the avatar if one is uploaded, plus the role and branch the company assigned. Sign-in is handled by the authentication provider configured for the workspace. Accounts ending in @routehub.local are test logins managed by the company.'],
  ['3. Location',
    'Location is collected only after Driving Day is On and the device has granted permission. Updates are used so the branch can see the live route during that work period. Turning Driving Day Off stops sharing. The web / PWA build cannot read GPS after the Driver app is closed. Device permission can be withdrawn in system Settings. Driving Day and the system permission are two different switches.'],
  ['4. Routes, contacts and proof',
    'Stops may include addresses, contact names, phone numbers, PO / order number, notes, recipient name, photos, signatures and Issue reports. Upload only what that stop needs. Contacts and branch addresses belong to the company workspace.'],
  ['5. Notifications',
    'If alerts are enabled, the browser or native wrapper stores a push subscription so RouteHub can send new-route and route-change messages. Alerts can stay Off. Silencing them fully may also require the phone Settings app.'],
  ['6. Maps',
    'Addresses may be sent to geocoding and routing providers (Google first; public fallbacks such as Census or Nominatim if Google returns empty) so the map can place a stop. Those providers receive the address string, not the password.'],
  ['7. Support and diagnostics',
    'The Support form in Settings writes a support request for the company workspace. The app may also record crash or error reports so the platform team can fix faults. Do not put passwords or card numbers in those messages.'],
  ['8. Hosting and subprocessors',
    'The product is hosted on Vercel. Workspace data is stored in Supabase. Maps and geocoding may use Google and the public fallbacks named above. Push uses the browser or the native wrapper configured for the install.'],
  ['9. Access, retention and requests',
    'Access follows workspace roles. Retention, export and deletion of company records are handled by the company administrator. For your own login, use Settings or ask that administrator. RouteHub Support does not reset another company’s workspace from a driver screen.'],
  ['10. Children',
    'RouteHub is a workplace tool. It is not directed at children under 16.'],
  ['11. Changes',
    'When processing changes, this page is updated and the date below changes. Related pages: Terms of Use and the in-app User guide.'],
]

export default function PrivacyPage() {
  return (
    <main style={{maxWidth: 860, margin: '0 auto', padding: '32px 24px 120px'}}>
      <Link href="/" style={{display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2468df', fontWeight: 800, textDecoration: 'none'}}>
        <ArrowLeft size={17} /> Back to RouteHub
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
        How RouteHub uses account, location, route, notification and support data. Written for the product as it ships today.
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
        Last updated: September 15, 2026 · <Link href="/terms">Terms of Use</Link> · <Link href="/guide.html">User guide</Link>
      </p>
    </main>
  )
}
