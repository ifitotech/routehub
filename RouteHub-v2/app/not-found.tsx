import Link from 'next/link'
export default function NotFound(){return <main className="app"><section className="card" style={{maxWidth:620,margin:'80px auto'}}><div className="brand">ROUTEHUB</div><h1>Page not found</h1><p className="muted">This RouteHub page does not exist or is no longer available.</p><Link className="primary" href="/">Back to home</Link></section></main>}
