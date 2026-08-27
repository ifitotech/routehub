'use client'
import {usePathname,useRouter} from 'next/navigation'
import {useEffect,useState} from 'react'
import {ArrowLeft} from 'lucide-react'
import Image from 'next/image'
import NotificationBell from './notification-bell'

export default function GlobalChrome(){
  const pathname=usePathname(),router=useRouter()
  const isDriverWorkspace=pathname.startsWith('/driver')
  const dashboardHref = isDriverWorkspace
    ? '/driver'
    : pathname.startsWith('/admin')
      ? '/admin'
      : '/manager'
  const [scrolled,setScrolled]=useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, {passive:true})
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Workspace home screens render their own compact header. Keeping the
  // floating chrome off the manager dashboard prevents the logo from
  // competing with the greeting and KPI grid.
  // Driver pages already render their own compact branded header. Do not add
  // the shared floating chrome there: it creates a second logo above the
  // Driver workspace (especially noticeable in the installed PWA).
  // Driver and the Manager home have purpose-built workspace headers. Every
  // other authenticated screen uses this exact shared header so moving from
  // Routes, History, Settings or a utility screen never falls back to an old
  // logo/navigation treatment.
  if(isDriverWorkspace||pathname==='/'||pathname==='/login'||pathname==='/activate-invitation'||pathname==='/manager'||pathname==='/product'||pathname==='/how-it-works'||pathname==='/for-drivers'||pathname==='/terms')return null
  const workspaceHomes=['/driver','/manager','/operations','/sales','/counter','/admin']
  const showBack=!workspaceHomes.includes(pathname)
  return <div className={`global-chrome${scrolled ? ' is-scrolled' : ''}`}>
    {showBack&&<button className="global-back" aria-label="Go back" onClick={()=>window.history.length>1?router.back():router.push('/')}><ArrowLeft size={20}/></button>}
    <button className="global-logo" aria-label="Open my dashboard" onClick={()=>router.push(dashboardHref)}><Image src="/routehub-regular-new.jpg" alt="" width={774} height={774} priority/><span>Route<em>Hub</em></span></button>
    <NotificationBell />
  </div>
}
