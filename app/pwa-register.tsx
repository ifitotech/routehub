'use client'
import {useEffect} from 'react'
import {flushQueue} from '../lib/offline-queue'
import {getSupabase} from '../lib/supabase'
export default function PwaRegister(){useEffect(()=>{if(!('serviceWorker' in navigator))return;const sync=()=>flushQueue(async action=>{if(action.kind!=='complete_stop')return true;const p=action.payload as {id:string;input:Record<string,unknown>};const{error}=await getSupabase().from('route_stops').update({...p.input,completed_at:new Date().toISOString()}).eq('id',p.id);return !error});navigator.serviceWorker.register('/sw.js').then(()=>sync()).catch(()=>{});window.addEventListener('online',sync);return()=>window.removeEventListener('online',sync)},[]);return null}
