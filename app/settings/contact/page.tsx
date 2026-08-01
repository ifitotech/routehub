'use client'
import {FormEvent,useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,Truck,Briefcase,Shield,ChevronRight,Globe,Moon,Sun} from 'lucide-react'
import {getAccessProfile,AccessProfile} from '../../../lib/access'

export default function Settings(){
 const[sent,setSent]=useState(false),[access,setAccess]=useState<AccessProfile|null>(null),[language,setLanguage]=useState('English'),[theme,setTheme]=useState('auto')
 useEffect(()=>{getAccessProfile().then(setAccess).catch(()=>setAccess(null));setLanguage(localStorage.getItem('routehub-language')||'English');setTheme(localStorage.getItem('routehub-theme')||'auto')},[])
 const changeTheme=(value:string)=>{setTheme(value);localStorage.setItem('routehub-theme',value);const dark=value==='dark'||(value==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)}
 const submit=(e:FormEvent)=>{e.preventDefault();setSent(true)}
 return <main className="shell settings-page"><button className="back-button" onClick={()=>history.back()}><ArrowLeft/>Settings</button>
 {access?.isCeo?<><h1>Roles and administration</h1><p className="muted">Manage access and permissions for your company.</p><h2>Roles</h2><div className="role-list"><Link href="/driver"><span className="role-icon"><Truck/></span><span><b>Driver</b><small>Driver role</small></span><ChevronRight/></Link><Link href="/manager"><span className="role-icon"><Briefcase/></span><span><b>Manager</b><small>Management and supervision</small></span><ChevronRight/></Link><Link href="/admin"><span className="role-icon"><Shield/></span><span><b>CEO / Admin</b><small>Full administration</small></span><ChevronRight/></Link></div></>:<><h1>Settings</h1><p className="muted">Your preferences and support.</p></>}
 <section className="card settings-section"><h2><Globe size={20}/>Language</h2><p className="muted">Choose the language for your interface.</p><select value={language} onChange={e=>{setLanguage(e.target.value);localStorage.setItem('routehub-language',e.target.value)}}><option>English</option><option>Español</option><option>Français</option></select></section>
 <section className="card settings-section"><h2>{theme==='dark'?<Moon size={20}/>:<Sun size={20}/>}Theme</h2><p className="muted">Choose automatic, light, or dark mode.</p><select value={theme} onChange={e=>changeTheme(e.target.value)}><option value="auto">Automatic</option><option value="light">Light</option><option value="dark">Dark</option></select></section>
 <h2>Support</h2><section className="card contact-panel"><h2>Contact RouteHub</h2><p className="muted">Report an issue, missing feature, or idea.</p>{sent?<p className="label">Message sent. We will follow up.</p>:<form className="form" onSubmit={submit}><select><option>Problem or issue</option><option>Missing feature</option><option>Question</option><option>Suggestion</option></select><input required placeholder="Subject"/><textarea required placeholder="Describe what you need" rows={4}/><button className="primary">Send message</button></form>}</section></main>
}
