'use client'
import {useEffect,useState} from 'react';import {useRouter} from 'next/navigation';import {getSupabase} from '../../lib/supabase'
export default function ManagerLayout({children}:{children:React.ReactNode}){const router=useRouter(),[ready,setReady]=useState(false);useEffect(()=>{getSupabase().auth.getSession().then(({data})=>{if(!data.session)router.replace('/login');else setReady(true)})},[router]);return ready?<>{children}</>:<main className="app"><div className="card"><p className="muted">Loading secure workspace...</p></div></main>}
