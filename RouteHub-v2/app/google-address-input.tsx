'use client'

import {useEffect, useId, useRef, useState} from 'react'
import type {InputHTMLAttributes} from 'react'

type PlaceResult = {formatted_address?: string; name?: string}
type FreeSuggestion = {label: string; primary: string; secondary: string}
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
  // The beta intentionally defaults to the free address provider. Google
  // Places is opt-in later by setting NEXT_PUBLIC_ADDRESS_SEARCH_PROVIDER=google.
  if (process.env.NEXT_PUBLIC_ADDRESS_SEARCH_PROVIDER !== 'google') return Promise.resolve(false)
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
    window.setTimeout(() => finish(false), 8_000)
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
  const listId = useId().replace(/:/g, '')
  const [googleReady, setGoogleReady] = useState(false)
  const [freeSuggestions, setFreeSuggestions] = useState<FreeSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])

  useEffect(() => {
    let listener: MapsListener | undefined
    let disposed = false
    void loadGooglePlaces().then(ready => {
      if (disposed) return
      setGoogleReady(ready)
      if (!ready || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return
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

  useEffect(() => {
    if (googleReady || value.trim().length < 3) {
      setFreeSuggestions([])
      setSuggestionsOpen(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const query = encodeURIComponent(value.trim())
      // Nominatim is sufficient for a small, manually tested beta. Requests
      // are debounced, only start after three characters and are aborted on
      // new input so we do not use it as a type-ahead service at scale.
      void fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=${query}`, {signal: controller.signal})
        .then(response => response.ok ? response.json() : [])
        .then((rows: Array<{display_name?: string}>) => {
          const suggestions = rows.flatMap(row => {
            const label = row.display_name?.trim()
            if (!label) return []
            const [primary, ...rest] = label.split(',')
            return [{label, primary: primary.trim(), secondary: rest.join(',').trim()}]
          })
          setFreeSuggestions(suggestions)
          setSuggestionsOpen(suggestions.length > 0)
        })
        .catch(error => { if (error.name !== 'AbortError') { setFreeSuggestions([]); setSuggestionsOpen(false) } })
    }, 450)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [googleReady, value])

  const selectSuggestion = (suggestion: FreeSuggestion) => {
    onValueChange(suggestion.label)
    setFreeSuggestions([])
    setSuggestionsOpen(false)
    inputRef.current?.focus()
  }

  return <div className="routehub-address-input"><input ref={inputRef} {...props} value={value} onFocus={() => { if (freeSuggestions.length) setSuggestionsOpen(true) }} onChange={event => onValueChange(event.target.value)} role="combobox" aria-autocomplete="list" aria-expanded={!googleReady && suggestionsOpen} aria-controls={listId}/>{!googleReady && suggestionsOpen && freeSuggestions.length > 0 && <div className="routehub-address-suggestions" id={listId} role="listbox" aria-label="Address suggestions">{freeSuggestions.map(suggestion => <button key={suggestion.label} type="button" role="option" aria-selected="false" className="routehub-address-suggestion" onMouseDown={event => event.preventDefault()} onClick={() => selectSuggestion(suggestion)}><span className="routehub-address-pin" aria-hidden="true">⌖</span><span><strong>{suggestion.primary}</strong>{suggestion.secondary && <small>{suggestion.secondary}</small>}</span></button>)}</div>}</div>
}
