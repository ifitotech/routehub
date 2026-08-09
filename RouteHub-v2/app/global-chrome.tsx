'use client'
import {usePathname,useRouter} from 'next/navigation'
import {ArrowLeft} from 'lucide-react'
import Image from 'next/image'

export default function GlobalChrome(){
  const pathname=usePathname(),router=useRouter()
  if(pathname==='/'||pathname==='/login')return null
  const workspaceHomes=['/driver','/manager','/operations','/sales','/counter','/admin']
  const showBack=!workspaceHomes.includes(pathname)
  return <div className="global-chrome">
    {showBack&&<button className="global-back" aria-label="Go back" onClick={()=>window.history.length>1?router.back():router.push('/')}><ArrowLeft size={20}/></button>}
    <button className="global-logo" aria-label="Open my dashboard" onClick={()=>router.push('/')}><Image src="/routehub-logo-alpha.png" alt="RouteHub" width={92} height={70} priority/></button>
  </div>
}
