'use client'
import {useEffect} from 'react'
export function Toast({message,type='info',onClose}:{message:string;type?:'info'|'success'|'error';onClose:()=>void}){useEffect(()=>{const timer=setTimeout(onClose,3500);return()=>clearTimeout(timer)},[onClose]);return <div role="status" aria-live="polite" style={{position:'fixed',right:18,bottom:90,zIndex:10,maxWidth:360,padding:'14px 16px',borderRadius:14,background:type==='error'?'#d93c35':type==='success'?'#1a9a52':'#2468df',color:'#fff',boxShadow:'0 12px 30px #14233b33'}}>{message}</div>}
