import {BarChart3, Building2, ChevronRight, FlaskConical, ScrollText, Settings, ShieldCheck, UserCheck} from 'lucide-react'
import Link from 'next/link'
import styles from './admin.module.css'

const tools = [
  {href: '/admin/companies', title: 'Companies', description: 'Review organizations and workspace status.', icon: Building2},
  {href: '/admin/approvals', title: 'Manager approvals', description: 'Authorize verified company Managers.', icon: UserCheck},
  {href: '/admin/audit', title: 'Audit activity', description: 'Review platform-level administrative changes.', icon: ScrollText},
  {href: '/reports', title: 'Reports', description: 'View privacy-safe operational summaries.', icon: BarChart3},
  {href: '/test', title: 'Role test center', description: 'Verify each workspace during beta testing.', icon: FlaskConical},
  {href: '/settings', title: 'Settings', description: 'Manage preferences and platform support.', icon: Settings},
]

export default function Admin() {
  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin</p><h1 className={styles.title}>Platform administration</h1><p className={styles.subtitle}>Monitor RouteHub while keeping each company&apos;s routes, customers and delivery details private.</p></div><div className={styles.avatar}>CEO</div></header>
      <section className={styles.hero}>
        <span className={styles.heroIcon}><ShieldCheck size={23}/></span>
        <h2>Private by design. Ready to scale.</h2>
        <p>Administrative access focuses on organizations, platform health and approvals. Customer route information remains inside each company workspace.</p>
        <span className={styles.health}>All platform systems operational</span>
      </section>
      <section className={styles.grid} aria-label="Administrative tools">
        {tools.map(({href, title, description, icon: Icon}) => <Link className={styles.actionCard} href={href} key={href}><span className={styles.actionIcon}><Icon size={20}/></span><h3>{title}</h3><p>{description}</p><ChevronRight className={styles.arrow} size={18}/></Link>)}
      </section>
      <nav className={styles.nav} aria-label="Admin navigation"><Link href="/admin">Home</Link><Link href="/admin/companies">Companies</Link><Link href="/settings">Settings</Link></nav>
    </div>
  </main>
}
