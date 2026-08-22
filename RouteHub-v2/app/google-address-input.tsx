'use client'

import {useEffect, useId, useRef, useState} from 'react'
import type {InputHTMLAttributes} from 'react'

type PlaceResult = {formatted_address?: string; name?: string}
type FreeSuggestion = {label: string; primary: string; secondary: string}
export type LocalAddressSuggestion = {id: string; primary: string; secondary?: string; value: string}
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
  // Google Places remains an opt-in production provider. The beta uses the
  // RouteHub server endpoint so mobile browsers do not have CORS failures.
  if (process.env.NEXT_PUBLIC_ADDRESS_SEARCH_PROVIDER !== 'google') return Promise.resolve(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.resolve(false)

  window.__routeHubGooglePlaces = new Promise<boolean>(resolve => {
    let settled = false
    const finish = (ready: boolean) => {
      if (!settled) { settled = true; resolve(ready) }
    }
    const ready = () => finish(Boolean(window.google?.maps?.places?.Autocomplete))
    const existing = document.querySelector<HTMLScriptElement>('script[data-routehub-google-places]')
    if (existing) {
      existing.addEventListener('load', ready, {once: true})
      existing.addEventListener('error', () => finish(false), {once: true})
      return
    }
    const script = document.createElement('script')
    const callback = `__routeHubGooglePlacesReady_${Math.random().toString(36).slice(2)}`
    const callbackWindow = window as unknown as Record<string, unknown>
    callbackWindow[callback] = () => { ready(); delete callbackWindow[callback] }
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
  localSuggestions?: LocalAddressSuggestion[]
  onSelectLocalSuggestion?: (suggestion: LocalAddressSuggestion) => void
}

export default function GoogleAddressInput({value, onValueChange, localSuggestions = [], onSelectLocalSuggestion, ...props}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onValueChangeRef = useRef(onValueChange)
  const selectedValueRef = useRef('')
  const listId = useId().replace(/:/g, '')
  const [googleReady, setGoogleReady] = useState(false)
  const [freeSuggestions, setFreeSuggestions] = useState<FreeSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const normalizedQuery = value.trim().toLocaleLowerCase()
  const localQueryTerms = normalizedQuery.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(term => term.length > 1)
  const matchingLocalSuggestions = localQueryTerms.length === 0 ? [] : localSuggestions.filter(item => {
    const searchable = `${item.primary} ${item.secondary || ''} ${item.value}`.toLocaleLowerCase()
    return localQueryTerms.every(term => searchable.includes(term))
  }).slice(0, 4)

  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])

  useEffect(() => {
    let listener: MapsListener | undefined
    let disposed = false
    void loadGooglePlaces().then(ready => {
      if (disposed) return
      setGoogleReady(ready)
      if (!ready || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'name'], types: ['address'], componentRestrictions: {country: 'us'},
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        onValueChangeRef.current(place.formatted_address || place.name || inputRef.current?.value || '')
      })
    })
    return () => { disposed = true; listener?.remove() }
  }, [])

  useEffect(() => {
    if (value === selectedValueRef.current) {
      setFreeSuggestions([])
      setSuggestionsOpen(false)
      setLookupState('idle')
      return
    }
    if (googleReady || value.trim().length < 3) {
      setFreeSuggestions([])
      setSuggestionsOpen(false)
      setLookupState('idle')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLookupState('loading')
      setSuggestionsOpen(true)
      void fetch(`/api/address-suggestions?q=${encodeURIComponent(value.trim())}`, {signal: controller.signal, cache: 'no-store'})
        .then(async response => {
          if (!response.ok) throw new Error('Address lookup unavailable')
          return await response.json() as {suggestions?: FreeSuggestion[]}
        })
        .then(payload => {
          const suggestions = payload.suggestions || []
          setFreeSuggestions(suggestions)
          setLookupState(suggestions.length ? 'idle' : 'empty')
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            setFreeSuggestions([])
            setLookupState('error')
            setSuggestionsOpen(true)
          }
        })
    }, 450)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [googleReady, value])

  const selectSuggestion = (suggestion: FreeSuggestion) => {
    selectedValueRef.current = suggestion.label
    onValueChange(suggestion.label)
    setFreeSuggestions([])
    setSuggestionsOpen(false)
    setLookupState('idle')
    inputRef.current?.focus()
  }

  const selectLocalSuggestion = (suggestion: LocalAddressSuggestion) => {
    selectedValueRef.current = suggestion.value
    onValueChange(suggestion.value)
    onSelectLocalSuggestion?.(suggestion)
    setFreeSuggestions([])
    setSuggestionsOpen(false)
    setLookupState('idle')
    inputRef.current?.focus()
  }

  // Touch browsers can blur the search input before a click is delivered,
  // making a suggestion feel as if it needs a second tap. Select on pointer
  // down and keep click only for keyboard activation.
  const selectOnPointerDown = (event: React.PointerEvent<HTMLButtonElement>, select: () => void) => {
    event.preventDefault()
    select()
  }
  const selectOnClick = (event: React.MouseEvent<HTMLButtonElement>, select: () => void) => {
    if (event.detail === 0) select()
  }

  // `street-address` asks iOS to inject old contact data above its keyboard.
  // This search owns suggestions, so native address autofill stays disabled.
  const shouldShowSuggestions = suggestionsOpen && (matchingLocalSuggestions.length > 0 || !googleReady)
  return <div className="routehub-address-input">
    <input ref={inputRef} {...props} value={value} name="routehub-address-search" type="search" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} onFocus={() => { if (value !== selectedValueRef.current && (matchingLocalSuggestions.length || freeSuggestions.length || lookupState === 'empty' || lookupState === 'error')) setSuggestionsOpen(true) }} onChange={event => { selectedValueRef.current=''; onValueChange(event.target.value); setSuggestionsOpen(true) }} role="combobox" aria-autocomplete="list" aria-expanded={shouldShowSuggestions} aria-controls={listId}/>
    {shouldShowSuggestions && <div className="routehub-address-suggestions" id={listId} role="listbox" aria-label="Address and contact suggestions">
      {matchingLocalSuggestions.map(suggestion => <button key={`contact-${suggestion.id}`} type="button" role="option" aria-selected="false" className="routehub-address-suggestion" onPointerDown={event => selectOnPointerDown(event, () => selectLocalSuggestion(suggestion))} onClick={event => selectOnClick(event, () => selectLocalSuggestion(suggestion))}><span className="routehub-address-pin" aria-hidden="true">●</span><span><strong>{suggestion.primary}</strong><small>{suggestion.secondary || suggestion.value}</small></span></button>)}
      {!matchingLocalSuggestions.length&&<>{lookupState === 'loading' && <p className="routehub-address-status">Searching US addresses...</p>}{lookupState === 'empty' && <p className="routehub-address-status">No exact address found. Add a city or ZIP code to narrow the search.</p>}{lookupState === 'error' && <p className="routehub-address-status">Address search is temporarily unavailable. You can still enter the address manually.</p>}{freeSuggestions.map(suggestion => <button key={suggestion.label} type="button" role="option" aria-selected="false" className="routehub-address-suggestion" onPointerDown={event => selectOnPointerDown(event, () => selectSuggestion(suggestion))} onClick={event => selectOnClick(event, () => selectSuggestion(suggestion))}><span className="routehub-address-pin" aria-hidden="true">o</span><span><strong>{suggestion.primary}</strong>{suggestion.secondary && <small>{suggestion.secondary}</small>}</span></button>)}</>}
    </div>}
  </div>
}
