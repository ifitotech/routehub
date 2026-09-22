import Link from 'next/link'
import {ArrowLeft, ShieldCheck} from 'lucide-react'

export const metadata = {title: 'Terms of Use · RouteHub'}

const sections = [
  ['1. Scope of the service',
    'RouteHub is workplace software that helps a company plan stops, assign work, coordinate drivers, view operational progress and keep records of pickup, delivery and return stops. It is not a carrier, courier, employer, insurer, emergency service or substitute for a driver’s judgment. Using RouteHub does not create an employment, transportation or agency relationship with RouteHub.'],
  ['2. Company authority and accounts',
    'The company that creates or administers a workspace controls its users, branches, route assignments and records. Administrators must invite and assign only authorized people. Every user must protect their login, keep profile information accurate and promptly report suspected misuse. Test accounts ending in @routehub.local are controlled by the company administrator and are not personal production accounts.'],
  ['3. Safe and lawful operation',
    'Drivers must obey traffic laws, use a mounted or hands-free device where required, and never interact with RouteHub in a way that distracts from driving. The driver remains responsible for confirming the destination, conditions at the stop, traffic rules and safe parking. RouteHub maps, ETAs, voice prompts and notifications are operational aids, not safety instructions.'],
  ['4. Routes, completion and evidence',
    'A route can contain pickup, delivery and return-to-branch stops. A pickup may contain a PO or order reference; a delivery may require recipient details, a photo or a signature; and a return may require its own confirmation. Users must record information truthfully. If a stop cannot be completed, use the Issue workflow rather than inventing a recipient, proof or result. Photos, signatures, notes and issue reports become part of the company’s operational record.'],
  ['5. Operational location',
    'Location sharing requires both Driving Day to be On and device-level location permission. While those are enabled, RouteHub uses location to show operational route progress and help the company coordinate work. The Android app may send an approximate location about every 8 minutes while its configured driving session is active. Turning Driving Day Off or revoking device permission stops new sharing. The web/PWA build cannot keep reading GPS after the driver leaves the app. The company must give any required notices, obtain any required consents and use location data lawfully.'],
  ['6. Maps, navigation and third parties',
    'Addresses and route coordinates may be sent to mapping, geocoding and routing providers to place stops and calculate routes. External navigation is opened by the device’s map application and is governed by that provider’s terms. Map data, traffic, street conditions, ETAs and search results may be delayed, incomplete or wrong; verify them before relying on them.'],
  ['7. Notifications and device controls',
    'When enabled by the user and permitted by the device, notifications may be used for new or changed routes and operational reminders. Notifications, location and navigation may be limited by operating-system settings, battery controls, connectivity, browser support or a third-party provider. A user can turn notifications off; full silencing may also require device Settings.'],
  ['8. Acceptable use and prohibited conduct',
    'Use RouteHub only for authorized company work and in compliance with applicable law. Do not access another workspace, bypass role controls, probe the service, upload content you do not have the right to use, use the product to harass or discriminate, introduce malware, falsify records or interfere with another user’s work. We may restrict access to protect users, workspaces or the service.'],
  ['9. Company data, privacy and retention',
    'Route records, contact details, proof, support messages and diagnostics are associated with the company workspace. The company is responsible for its retention, export, deletion and disclosure decisions, subject to applicable law and its own policies. RouteHub processes this information to provide and secure the product as described in the Privacy Policy. Do not submit passwords, payment-card details or other unnecessary sensitive information in notes or support requests.'],
  ['10. Availability, changes and suspension',
    'RouteHub is provided as a live service and may change, be maintained or be interrupted. Availability depends on the device, connectivity, hosting and third-party map or notification services. We may change or suspend features to maintain security, comply with law or improve the product. We may suspend an account or workspace for misuse, a security risk, non-payment where applicable, or a legal requirement.'],
  ['11. Disclaimers and limits',
    'To the extent permitted by law, RouteHub is provided “as is” and “as available.” RouteHub does not guarantee uninterrupted service, a particular ETA, map accuracy, delivery outcome or that evidence will satisfy a customer, carrier, insurer or regulator. The company remains responsible for its people, vehicles, operations, records and legal obligations. Nothing in these terms excludes rights that cannot legally be excluded.'],
  ['12. Updates, contact and legal review',
    'We may update these terms when the product or applicable requirements change. A material update may require a new in-app acknowledgement. Product questions can be sent through Settings > Contact support. These product terms should be reviewed and completed by qualified counsel with the company’s legal entity, business address, governing law, dispute process and any required regional notices before use as a commercial customer agreement.'],
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
        Operational rules for using Manager and Driver at work. This version explains RouteHub’s current route, location, maps and proof workflows. It is not legal advice; have qualified counsel complete the commercial and jurisdiction-specific terms before customer rollout.
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
        Version 2 · Last updated: September 21, 2026 · <Link href="/privacy">Privacy Policy</Link> · <Link href="/guide.html">User guide</Link>
      </p>
    </main>
  )
}
