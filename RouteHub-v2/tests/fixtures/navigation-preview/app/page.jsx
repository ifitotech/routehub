'use client'
/* Deterministic UI/GPS fixture: no login, real location, backend writes or API keys. */
import {useEffect,useState} from 'react'
import RoutePlanMap from '../../../../app/driver-navigation-map'
import shell from '../../../../components/driver-v3/driver-v3.module.css'

const path=[{lat:25.95,lng:-80.3},{lat:25.95,lng:-80.295},{lat:25.955,lng:-80.295},{lat:25.96,lng:-80.295}]
const stops=[{id:'fixture',label:'Test destination',coordinate:path[3]}]
const svgNS='http://www.w3.org/2000/svg'
const diagnostics={maps:0,fits:0,cameras:0,options:{},error:''}
function installMapDouble(){
  class MapDouble {
    constructor(element,options){
      diagnostics.maps++;diagnostics.options=options
      this.listeners={};this.heading=0
      this.svg=document.createElementNS(svgNS,'svg');this.svg.setAttribute('viewBox','0 0 340 540');this.svg.setAttribute('width','100%');this.svg.setAttribute('height','100%')
      this.svg.style.background='#e8f0ec'
      const label=document.createElementNS(svgNS,'text');label.setAttribute('x','14');label.setAttribute('y','30');label.textContent='SIMULATED MAP · UI TEST';label.setAttribute('font-size','12');this.svg.append(label)
      element.append(this.svg)
      element.addEventListener('pointermove',event=>{if(event.buttons)this.listeners.dragstart?.()})
    }
    addListener(event,handler){this.listeners[event]=handler;return {remove:()=>delete this.listeners[event]}}
    fitBounds(){diagnostics.fits++}
    setCenter(){}
    setZoom(){}
    panTo(){}
    moveCamera(options){diagnostics.cameras++;this.heading=options.heading||0}
    getHeading(){return this.heading}
  }
  const xy=p=>[35+(p.lng+80.3)*40000,475-(p.lat-25.95)*40000]
  class Shape {
    constructor(options){
      this.element=document.createElementNS(svgNS,options.path?'polyline':'circle')
      this.element.setAttribute('fill',options.path?'none':options.icon?.fillColor||'#1667f2')
      this.element.setAttribute('stroke',options.strokeColor||'white');this.element.setAttribute('stroke-width',options.strokeWeight||3)
      this.element.setAttribute('r','12');this.setMap(options.map)
      if(options.position)this.setPosition(options.position)
      if(options.path)this.setPath(options.path)
    }
    setPosition(p){const [x,y]=xy(p);this.element.setAttribute('cx',x);this.element.setAttribute('cy',y)}
    setPath(path){this.element.setAttribute('points',path.map(p=>xy(p).join(',')).join(' '))}
    setIcon(){}
    setMap(map){if(map)map.svg.append(this.element);else this.element.remove()}
  }
  if(!window.location.search.includes('real=1'))window.google={maps:{Map:MapDouble,Marker:Shape,Polyline:Shape,TrafficLayer:class{setMap(){}},LatLngBounds:class{extend(){}},SymbolPath:{CIRCLE:'circle'},RenderingType:{VECTOR:'VECTOR'},event:{trigger(){}}}}
  const originalFetch=window.fetch.bind(window)
  window.fetch=async(input,options)=>String(input)==='/api/routing'?new Response(JSON.stringify({source:'google',coordinates:path,distanceMeters:1613,durationSeconds:600,nextStopDurationSeconds:600,maneuvers:[{instruction:'Head east',distanceMeters:500,coordinate:path[0],type:'DEPART'},{instruction:'Turn left onto Test Street',distanceMeters:1113,coordinate:path[1],type:'TURN_LEFT'}]}),{headers:{'content-type':'application/json'}}):originalFetch(input,options)
}
export default function Preview(){
  const [ready,setReady]=useState(false),[fix,setFix]=useState(null),[size,setSize]=useState([390,780]),[report,setReport]=useState(''),[locale,setLocale]=useState('en')
  useEffect(()=>{installMapDouble();setReady(true)},[])
  useEffect(()=>{
    const timer=setInterval(()=>{
      const root=document.querySelector('[aria-label="Driver Map"]'),map=document.querySelector('[aria-label="Navigation map"]')
      if(!root||!map)return
      const r=root.getBoundingClientRect(),m=map.getBoundingClientRect(),g=root.children[0].getBoundingClientRect(),f=root.lastElementChild.getBoundingClientRect()
      const separated=(m.top>=g.bottom-1&&m.bottom<=f.top+1)||(m.right<=g.left+1&&m.right<=f.left+1)
      setReport(`${m.height>=180&&separated&&root.scrollWidth<=r.width+1?'PASS':'FAIL'}: map ${Math.round(m.width)}×${Math.round(m.height)}; panels do not overlap; ${diagnostics.maps} map instance; ${diagnostics.fits} fits; ${diagnostics.cameras} camera updates; ${diagnostics.options.renderingType}; ${diagnostics.options.gestureHandling}`)
    },500)
    return()=>clearInterval(timer)
  },[])
  const fresh=()=>setFix({...path[0],accuracy:8,heading:90,at:new Date().toISOString()})
  return <div style={{padding:10,background:'#dce3ed',minHeight:'100vh',fontFamily:'Arial'}}>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
      <button onClick={fresh}>Fresh GPS</button>
      <button onClick={()=>setFix({lat:25.95,lng:-80.2975,accuracy:8,heading:90,at:new Date().toISOString()})}>Move halfway</button>
      <button onClick={()=>setFix({...path[0],accuracy:150,at:new Date(Date.now()+1).toISOString()})}>Poor GPS</button>
      <button onClick={()=>{setFix(null);setLocale('es')}}>Spanish</button>
      <button onClick={()=>setSize([360,720])}>Android 360</button>
      <button onClick={()=>setSize([390,780])}>iPhone 390</button>
      <button onClick={()=>setSize([740,360])}>Landscape</button>
    </div>
    <p style={{fontSize:12}}>{report}</p>
    <div style={{width:size[0],height:size[1],display:'grid',gridTemplateRows:'54px minmax(0,1fr) 64px',maxWidth:'100%',border:'1px solid #9facbf'}}>
      <header style={{background:'#0f1d35',color:'white',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 16px'}}><span>Map</span><strong>RouteHub</strong><span>Profile</span></header>
      <div className={`${shell.content} ${shell.contentFlush}`}><main className="driver-navigation-page">{ready&&<RoutePlanMap stops={stops} originCoordinate={path[0]} sharedLocation={fix} locale={locale} navigationOnly autoStartNavigation trackDevice={false}/>}</main></div>
      <nav style={{background:'white',display:'flex',justifyContent:'space-around',alignItems:'center',fontSize:13}}>Today · Routes · Truck · More</nav>
    </div>
  </div>
}
