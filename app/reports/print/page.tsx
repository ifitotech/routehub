'use client'
import {useSearchParams} from 'next/navigation'
import {Suspense} from 'react'
function ReportContent(){const q=useSearchParams();const company=q.get('company')||'Current company';const from=q.get('from')||'Todas';const to=q.get('to')||'Todas';const driver=q.get('driver')||'All';return <main className="shell print-report"><div className="eyebrow">ROUTEHUB</div><h1>Activity report</h1><p>Company: {company}</p><p>Date range: {from} - {to}</p><p>Driver: {driver}</p><hr/><h2>Activity, rutas y problemas</h2><p className="muted">Este reporte estÃ¡ preparado para imprimir o guardar como PDF desde el navegador.</p><button className="primary" onClick={()=>window.print()}>Export PDF</button></main>}
export default function PrintReport(){return <Suspense fallback={<main className="shell"><p>Cargando reporteâ€¦</p></main>}><ReportContent/></Suspense>}
