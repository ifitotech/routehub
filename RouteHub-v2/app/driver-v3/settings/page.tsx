'use client'
import Link from 'next/link'
import {useState} from 'react'
import {getSupabase} from '../../../lib/supabase'
import DriverV3Shell from '../../../components/driver-v3/DriverV3Shell'
export default function DriverV3Settings(){const [busy,setBusy]=useState(false);const [error,setError]=useState('');const signOut=async()=>{if(busy)return;setBusy(true);setError('');const {error}=await getSupabase().auth.signOut();if(error){setError('Unable to sign out. Please try again.');setBusy(false);return}window.location.assign('/login')};return <DriverV3Shell active="more"><Link href="/driver/more" className="muted">‹ More</Link><p className="eyebrow">ACCOUNT</p><h1 className="title">Settings</h1><section className="card"><p className="muted">Your RouteHub account and workspace access are managed securely.</p><button className="secondary" disabled={busy} onClick={()=>void signOut()}>{busy?'Signing out…':'SIGN OUT'}</button>{error&&<p role="alert" className="muted">{error}</p>}</section></DriverV3Shell>}
