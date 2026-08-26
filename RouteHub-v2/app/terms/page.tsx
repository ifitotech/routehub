import Link from 'next/link'
import {ArrowLeft, ShieldCheck} from 'lucide-react'

export const metadata = {title: 'Terms of Use'}

const sections = [
  ['1. Service', 'RouteHub is a software tool for companies to plan routes, assign work, coordinate drivers and record stop status. RouteHub does not provide transportation, delivery, employment or emergency services.'],
  ['2. Company and account responsibility', 'Your company controls its workspace, team membership, assignments and operating policies. Keep account credentials private, use accurate information and notify your company administrator if access is lost or misused.'],
  ['3. Location sharing', 'When a driver starts a driving day and grants the device permission, RouteHub may collect periodic location updates during the configured work period. Location sharing is used for live operations and route history. The company is responsible for communicating its workplace policy and lawful purpose for this processing. Device-level permission can be withdrawn at any time.'],
  ['4. Route records and proof', 'Routes may contain addresses, contacts, phone numbers, instructions, photos, signatures, recipient names and issue notes. Only upload information needed for the assigned work and do not upload sensitive personal information unless your company has authorized it.'],
  ['5. Acceptable use', 'Do not use RouteHub to break the law, harass people, access another company’s data, bypass permissions, interfere with the service or submit misleading records. Managers must only assign work to authorized team members.'],
  ['6. Availability and beta features', 'RouteHub may be changed, interrupted or unavailable while features are tested and improved. Live location, maps, notifications and third-party links can be affected by device settings, network coverage or provider outages. Do not rely on RouteHub as the sole source for safety-critical decisions.'],
  ['7. Privacy and security', 'Access is limited by workspace permissions. We use reasonable safeguards, but no internet service can guarantee absolute security. The company and its administrators are responsible for managing retention, access and deletion according to their policies and applicable law.'],
  ['8. Changes and contact', 'We may update these terms as RouteHub evolves. A new version will be shown for acceptance. For questions about your company’s data, contact your company administrator. For product support, use the support contact provided in your workspace.'],
]

export default function TermsPage() {
  return <main style={{maxWidth:860,margin:'0 auto',padding:'32px 24px 120px'}}>
    <Link href="/" style={{display:'inline-flex',alignItems:'center',gap:8,color:'#2468df',fontWeight:800,textDecoration:'none'}}><ArrowLeft size={17}/> Back to RouteHub</Link>
    <div style={{display:'flex',alignItems:'center',gap:12,marginTop:34}}><div style={{display:'grid',placeItems:'center',width:48,height:48,borderRadius:15,background:'#eaf2ff',color:'#2468df'}}><ShieldCheck size={26}/></div><div><p style={{margin:0,color:'#2468df',fontSize:12,fontWeight:900,letterSpacing:'.14em'}}>ROUTEHUB</p><h1 style={{margin:'4px 0 0',fontSize:'clamp(34px,6vw,54px)',letterSpacing:'-.05em'}}>Terms of Use</h1></div></div>
    <p style={{maxWidth:700,color:'#607089',fontSize:18,lineHeight:1.55,margin:'22px 0 32px'}}>These terms explain the basic rules for using RouteHub at work. They are written for the current beta and may be updated as the product grows.</p>
    <section style={{display:'grid',gap:14}}>{sections.map(([title,body]) => <article key={title} style={{padding:'20px 22px',border:'1px solid #dce5f0',borderRadius:18,background:'#fff',boxShadow:'0 8px 24px rgba(20,35,59,.06)'}}><h2 style={{margin:'0 0 8px',fontSize:19}}>{title}</h2><p style={{margin:0,color:'#607089',lineHeight:1.55}}>{body}</p></article>)}</section>
    <p style={{marginTop:28,color:'#8a98aa',fontSize:13,lineHeight:1.5}}>Last updated: August 26, 2026 · This product template is not legal advice. Have your company’s counsel review the terms and privacy practices before production use.</p>
  </main>
}
