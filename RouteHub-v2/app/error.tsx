'use client'
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="app"><section className="card" style={{maxWidth:620,margin:'80px auto'}}><h1>Something went wrong</h1><p className="muted">The page could not load. Your data has not been deleted.</p><button className="primary" onClick={()=>reset()}>Try again</button></section></main>}
