'use client'

import {useEffect, useRef} from 'react'
import type {InputHTMLAttributes} from 'react'

type PlaceResult = {formatted_address?: string; name?: string}
type MapsListener = {remove: () => void}
type AutocompleteInstance = {
  addListener: (event: 'place_changed', callback: () => void) => MapsListener
  getPlace: () => PlaceResult
}
type GoogleMapsApi = {
  maps?: {places?: {Autocomplete: new (input: HTMLInputElement, options?: {fields?: string[]; types?: string[]; componentRestrictions?: {country: string | string[]}}) => AutocompleteInstance}}
}

declare global {
  interface Window {
    google?: GoogleMapsApi
    __routeHubGooglePlaces?: Promise<boolean>
  }
}

function loadGooglePlaces() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve(true)
  if (window.__routeHubGooglePlaces) return window.__routeHubGooglePlaces
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.resolve(false)

  window.__routeHubGooglePlaces = new Promise<boolean>(resolve => {
    let settled = false
    const finish = (ready: boolean) => {
      if (settled) return
      settled = true
      resolve(ready)
    }
    const ready = () => {
      // `loading=async` makes the script's load event fire before the Places
      // library has completed initialization. Wait for the documented callback
      // so Autocomplete is available before this component creates it.
      finish(Boolean(window.google?.maps?.places?.Autocomplete))
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-routehub-google-places]')
    if (existing) {
      existing.addEventListener('load', ready, {once: true})
      existing.addEventListener('error', () => finish(false), {once: true})
      return
    }
    const script = document.createElement('script')
    const callback = `__routeHubGooglePlacesReady_${Math.random().toString(36).slice(2)}`
    const callbackWindow = window as unknown as Record<string, unknown>
    callbackWindow[callback] = () => {
      ready()
      delete callbackWindow[callback]
    }
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async&callback=${callback}`
    script.async = true
    script.defer = true
    script.dataset.routehubGooglePlaces = 'true'
    script.addEventListener('error', () => finish(false), {once: true})
    document.head.appendChild(script)
  })
  return window.__routeHubGooglePlaces
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

export default function GoogleAddressInput({value, onValueChange, ...props}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onValueChangeRef = useRef(onValueChange)

  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])

  useEffect(() => {
    let listener: MapsListener | undefined
    let disposed = false
    void loadGooglePlaces().then(ready => {
      if (!ready || disposed || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'name'],
        types: ['address'],
        componentRestrictions: {country: 'us'},
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const next = place.formatted_address || place.name || inputRef.current?.value || ''
        onValueChangeRef.current(next)
      })
    })
    return () => { disposed = true; listener?.remove() }
  }, [])

  return <input ref={inputRef} {...props} value={value} onChange={event => onValueChange(event.target.value)} aria-autocomplete="both"/>
}
