'use client'
import {useSearchParams} from 'next/navigation'
import {Suspense} from 'react'
function ReportContent(){const q=useSearchParams();const company=q.get('company')||'Empresa actual';const from=q.get('from')||'Todas';const to=q.get('to')||'Todas';const driver=q.get('driver')||'Todos';return <main className="shell print-report"><div className="eyebrow">ROUTEHUB</div><h1>Reporte de actividad</h1><p>Empresa: {company}</p><p>Rango de fechas: {from} - {to}</p><p>Driver: {driver}</p><hr/><h2>Actividad, rutas y problemas</h2><p className="muted">Este reporte está preparado para imprimir o guardar como PDF desde el navegador.</p><button className="primary" onClick={()=>window.print()}>Exportar PDF</button></main>}
export default function PrintReport(){return <Suspense fallback={<main className="shell"><p>Cargando reporte…</p></main>}><ReportContent/></Suspense>}
