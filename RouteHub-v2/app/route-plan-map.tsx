'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import type {CSSProperties,PointerEvent as ReactPointerEvent} from 'react'
import L from 'leaflet'
import {MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap} from 'react-leaflet'
import {ArrowUp,CornerUpLeft,CornerUpRight,Crosshair,Flag,LocateFixed,RotateCcw,Route as RouteIcon,Satellite,WifiOff} from 'lucide-react'
import {mapTileConfig} from '../lib/maps/map-config'
import {geocodeAddress} from '../lib/maps/geocoding'
import {calculateRoute,distanceMeters,nextRouteManeuver,remainingRouteDistance} from '../lib/maps/routing'
import type {ActiveRouteManeuver} from '../lib/maps/types'

type Coordinate={lat:number;lng:number}
type GpsFix=Coordinate&{accuracy:number;updatedAt:number;heading:number|null}
export type PlannedStop={id:string;address?:string|null;label?:string|null;kind?:'pickup'|'delivery'|'branch';orderNumber?:string|null;notes?:string|null;position?:number;pastDue?:boolean;pending?:boolean;coordinate?:Coordinate|null}

type Props={originAddress?:string|null;originCoordinate?:Coordinate|null;stops:PlannedStop[];locale?:string;navigationOnly?:boolean;autoStartNavigation?:boolean;onReturnToday?:()=>void;onExitNavigation?:()=>void;onArrive?:()=>void|Promise<void>;transitioningOut?:boolean;trackDevice?:boolean;sharedLocation?:Coordinate|null}
