import Image from 'next/image'
import Link from 'next/link'
import {ArrowRight, CheckCircle2, MapPin, Navigation, ShieldCheck, Users} from 'lucide-react'
import styles from './marketing-info.module.css'

type MarketingPage = 'product' | 'how' | 'drivers'

const content = {
  product: {
    eyebrow: 'ROUTEHUB PRODUCT',
    title: 'One clear place for your daily routes.',
    description: 'Create pickup and delivery routes, assign the right person and keep the whole branch aligned without a complex dispatch system.',
    features: [['Create routes quickly', 'Pickups, deliveries and return-to-branch work stay in one simple workflow.'], ['Assign with confidence', 'Your Primary Driver is the default, while a team member can cover an individual route when needed.'], ['See progress clearly', 'Manager, Driver and route history views show what is happening now and what was completed.']],
    Icon: MapPin,
  },
  how: {
    eyebrow: 'HOW ROUTEHUB WORKS',
    title: 'Create. Assign. Deliver. Done.',
    description: 'RouteHub keeps the operational flow short so your team can focus on the work, not the software.',
    features: [['1. Create the route', 'Enter the destination, route type and the details your driver needs.'], ['2. Assign the route', 'Assign the Primary Driver by default or choose a team member for temporary coverage.'], ['3. Complete with proof', 'Drivers confirm the stop with a note, location and photo evidence when applicable.']],
    Icon: Navigation,
  },
  drivers: {
    eyebrow: 'FOR DRIVERS',
    title: 'Everything the driver needs. Nothing extra.',
    description: 'The Driver workspace answers what to do now, where to go and what comes next — designed for a quick, focused workday.',
    features: [['Clear next stop', 'See the current pickup or delivery, destination and instructions at a glance.'], ['External navigation', 'Start the route and open the device navigation app when it is time to drive.'], ['Simple completion', 'Add a photo or note, complete the stop and move naturally to the next assignment.']],
    Icon: Users,
  },
} as const

export default function MarketingInfo({page}: {page: MarketingPage}) {
  const item = content[page]
  const Icon = item.Icon
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><Image src="/routehub-regular-new.jpg" alt="RouteHub" width={48} height={48}/><b>Route<span>Hub</span></b></Link><nav><Link href="/product">Product</Link><Link href="/how-it-works">How it works</Link><Link href="/for-drivers">For Drivers</Link></nav><Link className={styles.signIn} href="/login">Sign in</Link></header>
    <section className={styles.hero}><div><p>{item.eyebrow}</p><h1>{item.title}</h1><h2>{item.description}</h2><Link className={styles.cta} href="/login">Get Started <ArrowRight size={18}/></Link></div><div className={styles.visual}><Icon size={92}/><span>RouteHub</span><small>Simple route operations for your team.</small></div></section>
    <section className={styles.features}>{item.features.map(([title, copy], index) => <article key={title}><i>{index === 0 ? <MapPin/> : index === 1 ? <Navigation/> : <ShieldCheck/>}</i><div><b>{title}</b><p>{copy}</p></div><CheckCircle2 size={19}/></article>)}</section>
  </main>
}
