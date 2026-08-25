'use client'
import {useEffect} from 'react'

function applyThemePreference(){
  const value=localStorage.getItem('routehub_theme')||localStorage.getItem('rh2-theme')||'light'
  // RouteHub is designed around the approved light operational workspace.
  // "System" used to inherit a computer's dark mode and make only some
  // screens appear to change theme while navigating. Dark remains available
  // when it is selected intentionally in settings.
  const resolved=value==='dark' ? 'dark' : 'light'
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
