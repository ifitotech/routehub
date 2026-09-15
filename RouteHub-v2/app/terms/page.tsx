import Link from 'next/link'
import {ArrowLeft, ShieldCheck} from 'lucide-react'

export const metadata = {title: 'Terms of Use · RouteHub'}

const sections = [
  ['1. The service',
    'RouteHub is workplace software for a company to plan stops, assign drivers, follow a day of work and keep a record of each stop. RouteHub is not a carrier, courier, employer, insurer or emergency service. Using the product does not create an employment or transportation contract with RouteHub.'],
  ['2. Accounts and workspaces',
    'Each company owns its workspace. Administrators invite people, set roles (manager, driver and any other role the company enables) and decide which branch a person belongs to. You must keep your login private, use accurate profile data and tell an administrator if the account is lost or misused. Test logins that end in @routehub.local are controlled by the company administrator; those accounts cannot change their own password from Settings.'],
  ['3. Acceptable use',
    'Use RouteHub only for authorized company work. Do not break the law, harass anyone, invent stop records, upload content you have no right to share, probe another workspace, bypass permissions or interfere with the service. Managers may assign work only to people on their team.'],
  ['4. Routes, proof and issues',
    'A route is one of pickup, delivery or return to branch. Pickup may include a PO / order number. Delivery may require the recipient name and a photo. Return to branch does not use a PO. If a stop cannot be completed, the driver marks Issue instead of inventing a recipient. Photos, notes and issue text become part of the company record.'],
  ['5. Location',
    'Driving Day is a workplace toggle. It is separate from the phone or browser location permission. When Driving Day is On and the device has granted location, RouteHub may send position updates while the Driver app is open so the branch can see the live route. Ending Driving Day stops sharing. The web / PWA build cannot keep GPS running after the driver leaves the app. Native wrappers may keep a session only while the product is configured to do so. The company is responsible for telling drivers why location is requested and for using it lawfully.'],
  ['6. Maps and notifications',
    'Addresses may be sent to map and geocoding providers so a stop can be placed on the map. Device notifications, when enabled, are used for new or changed routes. The driver or manager can leave notifications off; silencing them completely may also require the phone Settings app.'],
  ['7. Availability',
    'RouteHub is offered as a live product that still changes. Features can be interrupted by device settings, coverage, map providers or hosting. Do not treat the map, an ETA or a push alert as the only source for a safety-critical decision.'],
  ['8. Company data and billing',
    'Route records, contacts, photos, support messages and error reports belong to the company workspace. Plan and trial status are stored for that company. The company administrator handles retention, export and deletion under its own policy and applicable law.'],
  ['9. Liability',
    'The software is provided as available. To the fullest extent allowed by law, RouteHub is not liable for lost stops, late deliveries, device failure, third-party map outages or decisions a team makes from the screen. The company remains responsible for its operations.'],
  ['10. Changes',
    'We may update these terms when the product changes. The date below is the version in force. Continued use after a posted update means the new version applies. Questions about company data go to the company administrator. Product support is the Support form inside Settings.'],
]

export default function TermsPage() {
  return (
    <main style={{maxWidth: 860, margin: '0 auto', padding: '32px 24px 120px'}}>
      <Link href="/" style={{display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2468df', fontWeight: 800, textDecoration: 'none'}}>
        <ArrowLeft size={17} /> Back to RouteHub
      </Link>
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 34}}>
        <div style={{display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 15, background: '#eaf2ff', color: '#2468df'}}>
          <ShieldCheck size={26} />
        </div>
        <div>
          <p style={{margin: 0, color: '#2468df', fontSize: 12, fontWeight: 900, letterSpacing: '.14em'}}>ROUTEHUB</p>
          <h1 style={{margin: '4px 0 0', fontSize: 'clamp(34px,6vw,54px)', letterSpacing: '-.05em'}}>Terms of Use</h1>
        </div>
      </div>
      <p style={{maxWidth: 700, color: '#607089', fontSize: 18, lineHeight: 1.55, margin: '22px 0 32px'}}>
        Rules for using Manager and Driver at work. This page describes the current product. It is not legal advice. Have company counsel review it before you treat it as a customer contract.
      </p>
      <section style={{display: 'grid', gap: 14}}>
        {sections.map(([title, body]) => (
          <article key={title} style={{padding: '20px 22px', border: '1px solid #dce5f0', borderRadius: 18, background: '#fff', boxShadow: '0 8px 24px rgba(20,35,59,.06)'}}>
            <h2 style={{margin: '0 0 8px', fontSize: 19}}>{title}</h2>
            <p style={{margin: 0, color: '#607089', lineHeight: 1.55}}>{body}</p>
          </article>
        ))}
      </section>
      <p style={{marginTop: 28, color: '#8a98aa', fontSize: 13, lineHeight: 1.5}}>
        Last updated: September 15, 2026 · <Link href="/privacy">Privacy Policy</Link> · <Link href="/guide.html">User guide</Link>
      </p>
    </main>
  )
}
