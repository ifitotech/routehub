'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {loadGoogleMaps} from '../lib/maps/google-maps'
import {clusterCoordinates, sanitizeCoordinate} from '../lib/maps/coordinates'
import type {MapCoordinate} from '../lib/maps/types'

type MapObject={setMap:(map:GoogleMap|null)=>void;setPosition?:(position:MapCoordinate)=>void;setIcon?:(icon:Record<string,unknown>)=>void}
type Listener={remove?:()=>void}
type GoogleMap={
  fitBounds:(bounds:unknown,padding?:number)=>void
  panTo:(point:MapCoordinate)=>void
  setCenter:(point:MapCoordinate)=>void
  setZoom:(zoom:number)=>void
}
type MapsApi={
  Map:new(element:HTMLElement,options:Record<string,unknown>)=>GoogleMap
  Marker:new(options:Record<string,unknown>)=>MapObject&{addListener?:(event:string,handler:(event:unknown)=>void)=>Listener}
  Polyline:new(options:Record<string,unknown>)=>MapObject
  TrafficLayer:new()=>MapObject
  LatLngBounds:new()=>{extend:(point:MapCoordinate)=>void}
  SymbolPath:{CIRCLE:unknown;FORWARD_CLOSED_ARROW:unknown}
}

function driverTruckIcon(color:string){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50"><path d="M21 1C11.1 1 3 9.1 3 19c0 13.6 18 30 18 30s18-16.4 18-30C39 9.1 30.9 1 21 1Z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="21" cy="19" r="12" fill="white"/><path fill="${color}" d="M12 13h15v11h3l3 3v4h-2a3 3 0 0 1-6 0h-7a3 3 0 0 1-6 0h-1V16c0-1.7.6-3 1-3Zm3 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm13 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm1-3h2l-2-2h-1v2Z"/></svg>`
  return {url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`}
}

export type GoogleRouteMarker={
  id:string
  position:MapCoordinate|null|undefined
  label?:string
  title?:string
  tone?:string
  driver?:boolean
  heading?:number|null
  draggable?:boolean
}

type Props={
  className?:string
  ariaLabel:string
  path?:MapCoordinate[]
  markers?:GoogleRouteMarker[]
  fitPoints?:MapCoordinate[]
  followPosition?:MapCoordinate|null
  followToken?:number
  followDevice?:boolean
  interactive?:boolean
  showTraffic?:boolean
  onMapClick?:(coordinate:MapCoordinate)=>void
  onMarkerDrag?:(id:string,coordinate:MapCoordinate)=>void
}

const defaultCenter={lat:25.7617,lng:-80.1918}

function coordinateFromEvent(event:unknown):MapCoordinate|null{
  const latLng=(event as {latLng?:{lat?:()=>number;lng?:()=>number}}|null)?.latLng
  const lat=latLng?.lat?.(),lng=latLng?.lng?.()
  return sanitizeCoordinate({lat,lng})
}

/** Shared Google Maps canvas. RouteHub keeps routing data in its own services;
 * this component only renders the real coordinates it receives. */
export default function GoogleRouteCanvas({className,ariaLabel,path=[],markers=[],fitPoints=[],followPosition=null,followToken=0,followDevice=false,interactive=true,showTraffic=false,onMapClick,onMarkerDrag}:Props){
  const containerRef=useRef<HTMLDivElement>(null)
  const mapRef=useRef<GoogleMap|null>(null)
  const objectsRef=useRef<MapObject[]>([])
  const driverMarkerRef=useRef<MapObject|null>(null)
  const listenersRef=useRef<Listener[]>([])
  const [error,setError]=useState('')
  const safePath=useMemo(()=>clusterCoordinates(path),[path])
  const safeMarkers=useMemo(()=>markers.flatMap(marker=>{
    const position=sanitizeCoordinate(marker.position)
    return position?[{...marker,position}]:[]
  }),[markers])
  const safeFit=useMemo(()=>clusterCoordinates(fitPoints),[fitPoints])
  const fixedMarkers=useMemo(()=>safeMarkers.filter(marker=>!marker.driver),[safeMarkers])
  const driverMarker=useMemo(()=>safeMarkers.find(marker=>marker.driver)||null,[safeMarkers])
  const renderDataRef=useRef({safePath,safeFit,fixedMarkers,driverMarker})
  renderDataRef.current={safePath,safeFit,fixedMarkers,driverMarker}
  const renderKey=[
    safePath.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|'),
    fixedMarkers.map(marker=>`${marker.id}:${marker.position.lat.toFixed(5)},${marker.position.lng.toFixed(5)}:${marker.label||''}:${marker.tone||''}`).join('|'),
    driverMarker?`${driverMarker.id}:${driverMarker.title||''}:${driverMarker.tone||''}`:'',
    safeFit.map(point=>`${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|'),
  ].join('::')

  useEffect(()=>{
    let cancelled=false
    void loadGoogleMaps().then(raw=>{
      if(cancelled||!containerRef.current)return
      const maps=raw as unknown as MapsApi
      const current=renderDataRef.current
      const map=mapRef.current||(mapRef.current=new maps.Map(containerRef.current,{
        center:current.safeFit[0]||current.safePath[0]||current.fixedMarkers[0]?.position||current.driverMarker?.position||defaultCenter,
        zoom:14,
        disableDefaultUI:false,
        mapTypeControl:false,
        streetViewControl:false,
        fullscreenControl:false,
        gestureHandling:interactive?'auto':'none',
      }))
      objectsRef.current.forEach(object=>object.setMap(null))
      objectsRef.current=[]
      driverMarkerRef.current=null
      listenersRef.current.forEach(listener=>listener.remove?.())
      listenersRef.current=[]
      if(showTraffic){
        const traffic=new maps.TrafficLayer()
        traffic.setMap(map)
        objectsRef.current.push(traffic)
      }
      if(current.safePath.length>1){
        objectsRef.current.push(new maps.Polyline({map,path:current.safePath,strokeColor:'#fff',strokeOpacity:.92,strokeWeight:10,zIndex:1}))
        objectsRef.current.push(new maps.Polyline({map,path:current.safePath,strokeColor:'#1667F2',strokeOpacity:.98,strokeWeight:6,zIndex:2}))
      }
      for(const marker of current.fixedMarkers){
        const item=new maps.Marker({
          map,
          position:marker.position,
          title:marker.title,
          draggable:Boolean(marker.draggable&&onMarkerDrag),
          label:marker.label?{text:marker.label,color:'#fff',fontWeight:'800'}:undefined,
          icon:marker.driver?{
            ...driverTruckIcon(marker.tone||'#0F1D35'),
          }:{
            path:maps.SymbolPath.CIRCLE,
            scale:marker.label?16:12,
            fillColor:marker.tone||'#1667F2',
            fillOpacity:1,
            strokeColor:'#fff',
            strokeWeight:3,
          },
          zIndex:marker.driver?1000:200,
        })
        objectsRef.current.push(item)
        if(marker.draggable&&onMarkerDrag&&item.addListener){
          const listener=item.addListener('dragend',event=>{
            const coordinate=coordinateFromEvent(event)
            if(coordinate)onMarkerDrag(marker.id,coordinate)
          })
          listenersRef.current.push(listener)
        }
      }
      if(current.driverMarker){
        const item=new maps.Marker({
          map,
          position:current.driverMarker.position,
          title:current.driverMarker.title,
          icon:{
            ...driverTruckIcon(current.driverMarker.tone||'#0F1D35'),
          },
          zIndex:1000,
        })
        objectsRef.current.push(item)
        driverMarkerRef.current=item
      }
      if(onMapClick){
        const listener=(map as unknown as {addListener?:(event:string,handler:(event:unknown)=>void)=>Listener}).addListener?.('click',event=>{
          const coordinate=coordinateFromEvent(event)
          if(coordinate)onMapClick(coordinate)
        })
        if(listener)listenersRef.current.push(listener)
      }
      const boundsPoints=current.safeFit.length?current.safeFit:clusterCoordinates([...current.safePath,...current.fixedMarkers.map(marker=>marker.position)])
      if(boundsPoints.length>1){
        const bounds=new maps.LatLngBounds()
        boundsPoints.forEach(point=>bounds.extend(point))
        map.fitBounds(bounds,38)
      }else if(boundsPoints.length===1){
        map.setCenter(boundsPoints[0])
        map.setZoom(15)
      }
      setError('')
    }).catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:'Google Maps is unavailable.')})
    return()=>{cancelled=true}
  },[renderKey,interactive,showTraffic,onMapClick,onMarkerDrag])

  useEffect(()=>{
    const position=driverMarker?.position||sanitizeCoordinate(followPosition)
    if(!position)return
    driverMarkerRef.current?.setPosition?.(position)
    if(driverMarker){
      driverMarkerRef.current?.setIcon?.({
        ...driverTruckIcon(driverMarker.tone||'#0F1D35'),
      })
    }
    if(followDevice||followToken){
      mapRef.current?.panTo(position)
      mapRef.current?.setZoom(followDevice?17:16)
    }
  },[followDevice,followToken,followPosition,driverMarker?.position])

  return <div ref={containerRef} className={className} aria-label={ariaLabel}>{error&&<div className="live-route-loading" role="alert">{error}</div>}</div>
}
