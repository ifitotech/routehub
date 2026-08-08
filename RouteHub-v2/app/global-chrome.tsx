'use client'
import {usePathname,useRouter} from 'next/navigation'
import {ArrowLeft} from 'lucide-react'

export default function GlobalChrome(){
  const pathname=usePathname(),router=useRouter()
  if(pathname==='/'||pathname==='/login')return null
  return <div className="global-chrome"><button className="global-back" aria-label="Go back" onClick={()=>window.history.length>1?router.back():router.push('/')}><ArrowLeft size={18}/></button><img src="/routehub-logo-clean.png" alt="RouteHub"/></div>
}
