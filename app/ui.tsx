'use client'
import {CheckCircle2,Loader2,Inbox} from 'lucide-react'
export function StatusBadge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'info'}){return <span className={`status-badge status-${tone}`}>{children}</span>}
export function LoadingSkeleton({lines=3}:{lines?:number}){return <div className="loading-skeleton" aria-label="Cargando" aria-busy="true">{Array.from({length:lines},(_,i)=><span key={i}/>)}</div>}
export function EmptyState({title,description,action}:{title:string;description?:string;action?:React.ReactNode}){return <section className="empty-state"><Inbox size={30}/><h3>{title}</h3>{description&&<p>{description}</p>}{action}</section>}
export function ActionFeedback({message,type='success'}:{message:string;type?:'success'|'error'|'info'}){return <p className={`action-feedback feedback-${type}`} role="status" aria-live="polite">{type==='success'&&<CheckCircle2 size={17}/>} {message}</p>}
export function LoadingButton({loading,children,...props}:{loading?:boolean;children:React.ReactNode}&React.ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} disabled={loading||props.disabled} className={`primary ${props.className||''}`}>{loading&&<Loader2 className="spin" size={17}/>} {loading?'Guardando…':children}</button>}
