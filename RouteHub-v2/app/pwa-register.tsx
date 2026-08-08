'use client'
import {useEffect} from 'react'
export default function PwaRegister(){useEffect(()=>{if(!('serviceWorker' in navigator))return;let refreshing=false;navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing){refreshing=true;window.location.reload()}})},[]);return null}
