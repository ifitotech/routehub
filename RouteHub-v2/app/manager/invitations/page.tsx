'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import {getLocale} from '../../../lib/i18n'
import {roleLabelOptions} from '../../../lib/role-labels'

type Invite={id:string;email:string;role:string;status:string;created_at?:string}

export default function Invitations(){
  const [items,setItems]=useState<Invite[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState('driver'),[message,setMessage]=useState('Loading invitations…'),[busy,setBusy]=useState(false)
  const choices=roleLabelOptions(getLocale())
  const load=async()=>{try{const s=getSupabase(),{data:u}=await s.auth.getUser();if(!u.user)throw Error('Sign in to manage invitations.');const{data:m}=await s.from('company_users').select('company_id').eq('user_id',u.user.id).limit(1).maybeSingle();if(!m)throw Error('No company membership.');const{data,error}=await s.from('invitations').select('id,email,role,status,created_at').eq('company_id',m.company_id).order('created_at',{ascending:false});if(error)throw error;setItems(data||[]);setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'Unable to load invitations.')}}
  useEffect(()=>{load()},[])
  const send=async()=>{if(!email.trim()||busy)return;setBusy(true);try{const s=getSupabase(),{data:u}=await s.auth.getUser();if(!u.user)throw Error('Sign in first.');const{data:m}=await s.from('company_users').select('company_id,branch_id').eq('user_id',u.user.id).limit(1).maybeSingle();if(!m)throw Error('No company membership.');const{error}=await s.from('invitations').insert({email:email.trim().toLowerCase(),role,company_id:m.company_id,branch_id:m.branch_id,created_by:u.user.id,status:'pending'});if(error)throw error;setEmail('');setMessage('Invitation created.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Unable to create invitation.')}finally{setBusy(false)}}
  const revoke=async(id:string)=>{const{error}=await getSupabase().from('invitations').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('id',id);setMessage(error?error.message:'Invitation revoked.');if(!error)load()}
  return <main className="app"><header className="topbar"><Link className="brand" href="/manager">ROUTEHUB</Link></header><p className="muted">Manager · Invitations</p><h1>Team invitations</h1><p className="muted">Invite people using a role label that fits your company.</p><section className="card" style={{marginTop:22}}><h2>Invite a team member</h2><label>Email address<input type="email" placeholder="name@company.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}>{choices.map(x=><option key={x.role} value={x.role}>{x.label}</option>)}</select></label><button className="primary" disabled={busy||!email.trim()} onClick={send}>{busy?'Sending…':'Send invitation'}</button></section>{message&&<p className="muted" role="status">{message}</p>}<section style={{display:'grid',gap:12,marginTop:20}}>{items.map(i=><article className="card" key={i.id}><h2>{i.email}</h2><p className="muted">{choices.find(x=>x.role===i.role)?.label||i.role} · {i.status}</p>{i.status==='pending'&&<button className="secondary" onClick={()=>revoke(i.id)}>Revoke invitation</button>}</article>)}</section></main>
}
