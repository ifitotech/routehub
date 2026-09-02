'use client'
import {useEffect} from 'react'
import {resolvedTheme, themePreference} from '../lib/use-preferences'

export default function ThemeBoot(){
  useEffect(()=>{
    const sync=()=>{
      const resolved=resolvedTheme(themePreference())
      document.documentElement.dataset.theme=resolved
      document.documentElement.style.colorScheme=resolved
    }
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemTheme=()=>{if(themePreference()==='system')sync()}
    sync()
    window.addEventListener('routehub:theme-change',sync)
    media.addEventListener?.('change',onSystemTheme)
    return()=>{
      window.removeEventListener('routehub:theme-change',sync)
      media.removeEventListener?.('change',onSystemTheme)
    }
  },[])
  return null
}
