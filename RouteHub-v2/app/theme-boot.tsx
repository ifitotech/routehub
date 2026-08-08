'use client'
import {useEffect} from 'react'
export default function ThemeBoot(){useEffect(()=>{const value=localStorage.getItem('routehub_theme')||localStorage.getItem('rh2-theme')||'system';if(value==='dark'||value==='light')document.documentElement.dataset.theme=value;else document.documentElement.removeAttribute('data-theme')},[]);return null}
