import {ScrollText} from 'lucide-react'
import styles from '../admin.module.css'

export default function Audit() {
  return <main className="app">
    <div className={styles.page}>
      <header className={styles.header}><div><p className={styles.eyebrow}>CEO / Admin · Security</p><h1 className={styles.title}>Audit activity</h1><p className={styles.subtitle}>Platform-level administrative changes only. Company routes, customers and delivery evidence remain private.</p></div></header>
      <section className={styles.empty}>
        <span><ScrollText size={24}/></span>
        <h2>No audit events</h2>
        <p>Administrative changes will appear here with the date, actor and action.</p>
      </section>
    </div>
  </main>
}
