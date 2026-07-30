'use client'
import {useState} from 'react'
import {getSupabase} from '../../lib/supabase'
export default function Login(){const [message,setMessage]=useState('');const signIn=async()=>{try{setMessage('Abriendo Google…');const {error}=await getSupabase().auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/auth/callback'}});if(error)setMessage(error.message)}catch(e){setMessage('Configura las variables de Supabase para continuar.')}};return <main className="shell login"><div className="eyebrow">ROUTEHUB</div><h1>Iniciar sesión</h1><p className="muted">Solo pueden entrar usuarios invitados por un Manager autorizado.</p><button className="primary" onClick={signIn}>Continuar con Google</button>{message&&<p className="muted">{message}</p>}</main>}
