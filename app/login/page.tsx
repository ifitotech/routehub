'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {getSupabase} from '../../lib/supabase'

export default function Login(){
 const router=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const signInWithPassword=async()=>{if(!email||!password)return;setBusy(true);setMessage('Signing in…');const supabase=getSupabase();await supabase.auth.signOut();const{error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});if(error)setMessage(error.message);else router.replace('/');setBusy(false)}
 const signInWithGoogle=async()=>{setMessage('Opening Google…');const{error}=await getSupabase().auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback'}});if(error)setMessage(error.message)}
 return <main className="shell login"><div className="eyebrow">ROUTEHUB</div><h1>Sign in</h1><p className="muted">Use an invited account to access your company workspace.</p><section className="card form login-form"><h2>Test or email login</h2><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="manager.test@example.com"/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="primary" disabled={busy||!email||!password} onClick={signInWithPassword}>{busy?'Signing in…':'Sign in with email'}</button><div className="login-divider"><span>or</span></div><button className="secondary" disabled={busy} onClick={signInWithGoogle}>Continue with Google</button></section>{message&&<p className="action-feedback feedback-info" role="status" aria-live="polite">{message}</p>}</main>
}
