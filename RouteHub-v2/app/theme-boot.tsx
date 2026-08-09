'use client'
import {useEffect} from 'react'

function applyThemePreference(){
  const value=localStorage.getItem('routehub_theme')||localStorage.getItem('rh2-theme')||'system'
  const resolved=value==='dark'||value==='light' ? value : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme=resolved
  document.documentElement.style.colorScheme=resolved
}

export default function ThemeBoot(){
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const sync=()=>applyThemePreference()
    sync()
    media.addEventListener('change',sync)
    window.addEventListener('routehub:theme-change',sync)
    return()=>{media.removeEventListener('change',sync);window.removeEventListener('routehub:theme-change',sync)}
  },[])
  return null
}
