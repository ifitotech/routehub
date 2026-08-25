'use client'
import {useEffect} from 'react'

function applyThemePreference(){
  // RouteHub's approved product UI is light-only.  Older betas may have a
  // saved dark/system preference; normalize it here before any workspace is
  // painted so route, manager and driver screens never switch independently.
  localStorage.setItem('routehub_theme','light')
  localStorage.removeItem('rh2-theme')
  document.documentElement.dataset.theme='light'
  document.documentElement.style.colorScheme='light'
}

export default function ThemeBoot(){
  useEffect(()=>{
    const sync=()=>applyThemePreference()
    sync()
    window.addEventListener('routehub:theme-change',sync)
    return()=>window.removeEventListener('routehub:theme-change',sync)
  },[])
  return null
}
