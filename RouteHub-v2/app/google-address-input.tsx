'use client'

import {useCallback, useEffect, useId, useRef, useState} from 'react'
import type {InputHTMLAttributes} from 'react'
import type {GeocodedLocation} from '../lib/maps/types'
import {loadGoogleMaps} from '../lib/maps/google-maps'

type PlaceResult = {formatted_address?: string; name?: string; geometry?:{location?:{lat:()=>number;lng:()=>number}}}
export type AddressSearchSuggestion = {
  label: string
  primary: string
  secondary: string
  coordinate?: GeocodedLocation['coordinate']
  source: Extract<GeocodedLocation['source'], 'google'>
  externalId?: string
  name?: string
}
export type LocalAddressSuggestion = {id: string; primary: string; secondary?: string; value: string; location?: GeocodedLocation}
type MapsListener = {remove: () => void}
type AutocompleteInstance = {
  addListener: (event: 'place_changed', callback: () => void) => MapsListener
  getPlace: () => PlaceResult
}
type GoogleMapsApi={places?:{Autocomplete:new(input:HTMLInputElement,options?:{fields?:string[];types?:string[];componentRestrictions?:{country:string|string[]};bounds?:{south:number;west:number;north:number;east:number};strictBounds?:boolean})=>AutocompleteInstance}}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  localSuggestions?: LocalAddressSuggestion[]
  onSelectLocalSuggestion?: (suggestion: LocalAddressSuggestion) => void
  onSelectSearchSuggestion?: (suggestion: AddressSearchSuggestion) => void
  searchContext?: string
  searchLabel?: string
}

export default function GoogleAddressInput({
  value,
  onValueChange,
  localSuggestions = [],
  onSelectLocalSuggestion,
  onSelectSearchSuggestion,
  searchContext = '',
  searchLabel = 'Search',
  onKeyDown,
  ...props
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const onValueChangeRef = useRef(onValueChange)
  const onSelectSearchSuggestionRef = useRef(onSelectSearchSuggestion)
  const selectedValueRef = useRef('')
  const searchController = useRef<AbortController | null>(null)
  const listId = useId().replace(/:/g, '')
  const [googleReady, setGoogleReady] = useState(false)
  const [freeSuggestions, setFreeSuggestions] = useState<AddressSearchSuggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const normalizedQuery = value.trim().toLocaleLowerCase()
  const localQueryTerms = normalizedQuery.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(term => term.length > 1)
  const matchingLocalSuggestions = localQueryTerms.length === 0 ? [] : localSuggestions.filter(item => {
    const searchable = `${item.primary} ${item.secondary || ''} ${item.value}`.toLocaleLowerCase()
    return localQueryTerms.every(term => searchable.includes(term))
  }).slice(0, 5)

  useEffect(() => { onValueChangeRef.current = onValueChange }, [onValueChange])
  useEffect(() => { onSelectSearchSuggestionRef.current = onSelectSearchSuggestion }, [onSelectSearchSuggestion])
  useEffect(() => () => searchController.current?.abort(), [])

  useEffect(() => {
    let listener: MapsListener | undefined
    let disposed = false
    void loadGoogleMaps().then(raw => {
      const maps=raw as unknown as GoogleMapsApi
      const ready=Boolean(maps.places?.Autocomplete)
      if (disposed) return
      setGoogleReady(ready)
      if (!ready || !inputRef.current || !maps.places?.Autocomplete) return
      const autocomplete = new maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'name', 'geometry'], types: ['address'], componentRestrictions: {country: 'us'},
        bounds: {south: 24.396308, west: -87.634938, north: 31.000888, east: -79.974306},
        strictBounds: true,
      })
      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const result = place.formatted_address || place.name || inputRef.current?.value || ''
        selectedValueRef.current = result
        onValueChangeRef.current(result)
        const location=place.geometry?.location
        if(location)onSelectSearchSuggestionRef.current?.({label:result,primary:place.name||result,secondary:place.formatted_address||'',coordinate:{lat:location.lat(),lng:location.lng()},source:'google',name:place.name})
        // Google renders its own suggestion popup outside React. Blur the
        // input after a selection so the popup closes and never blocks the
        // route/contact form on touch devices.
        window.setTimeout(() => inputRef.current?.blur(), 0)
      })
    }).catch(()=>setGoogleReady(false))
    return () => { disposed = true; listener?.remove() }
  }, [])

  const runSearch = useCallback(async () => {
    const query = value.trim()
    if (googleReady || query.length < 3 || query.length > 180) return
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setLookupState('loading')
    setSuggestionsOpen(true)
    try {
      const params = new URLSearchParams({q: query})
      if (searchContext.trim()) params.set('near', searchContext.trim())
      const response = await fetch(`/api/address-suggestions?${params.toString()}`, {signal: controller.signal, cache: 'no-store'})
      if (!response.ok) throw new Error('Address lookup unavailable')
      const payload = await response.json() as {suggestions?: AddressSearchSuggestion[]}
      const suggestions = payload.suggestions || []
      setFreeSuggestions(suggestions)
      setLookupState(suggestions.length ? 'idle' : 'empty')
    } catch (error) {
      if ((error as {name?: string}).name === 'AbortError') return
      setFreeSuggestions([])
      setLookupState('error')
    }
  }, [googleReady, searchContext, value])

  const selectSuggestion = (suggestion: AddressSearchSuggestion) => {
    selectedValueRef.current = suggestion.label
    onValueChange(suggestion.label)
    onSelectSearchSuggestion?.(suggestion)
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

  // Touch browsers can blur the field before a click arrives. Pointer down
  // selects the result in one tap while click retains keyboard support.
  const selectOnPointerDown = (event: React.PointerEvent<HTMLButtonElement>, select: () => void) => { event.preventDefault(); select() }
  const selectOnClick = (event: React.MouseEvent<HTMLButtonElement>, select: () => void) => { if (event.detail === 0) select() }
  const hasResults = matchingLocalSuggestions.length > 0 || freeSuggestions.length > 0 || lookupState === 'loading' || lookupState === 'empty' || lookupState === 'error'
  const shouldShowSuggestions = suggestionsOpen && !googleReady && hasResults

  return <div className="routehub-address-input">
    <div className="routehub-address-control">
      <input ref={inputRef} {...props} value={value} name="routehub-address-search" type="search" autoComplete="off" autoCorrect="off" autoCapitalize="words" spellCheck={false} onFocus={() => { if (matchingLocalSuggestions.length || freeSuggestions.length) setSuggestionsOpen(true) }} onChange={event => { selectedValueRef.current = ''; onValueChange(event.target.value); setFreeSuggestions([]); setLookupState('idle'); setSuggestionsOpen(Boolean(matchingLocalSuggestions.length)) }} onKeyDown={event => { onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'Enter' && !googleReady) { event.preventDefault(); void runSearch() } }} role="combobox" aria-autocomplete="list" aria-expanded={shouldShowSuggestions} aria-controls={listId}/>
      {!googleReady && <button type="button" className="routehub-address-search-button" disabled={value.trim().length < 3 || lookupState === 'loading'} onClick={() => void runSearch()}>{lookupState === 'loading' ? '…' : searchLabel}</button>}
    </div>
    {shouldShowSuggestions && <div className="routehub-address-suggestions" id={listId} role="listbox" aria-label="Address and contact suggestions">
      {matchingLocalSuggestions.map(suggestion => <button key={`local-${suggestion.id}`} type="button" role="option" aria-selected="false" className="routehub-address-suggestion" onPointerDown={event => selectOnPointerDown(event, () => selectLocalSuggestion(suggestion))} onClick={event => selectOnClick(event, () => selectLocalSuggestion(suggestion))}><span className="routehub-address-pin" aria-hidden="true">●</span><span><strong>{suggestion.primary}</strong><small>{suggestion.secondary || suggestion.value}</small></span></button>)}
      {lookupState === 'loading' && <p className="routehub-address-status">Searching locations…</p>}
      {lookupState === 'empty' && <p className="routehub-address-status">We couldn’t find that location. Try a fuller address, city or ZIP code.</p>}
      {lookupState === 'error' && <p className="routehub-address-status">Location search is temporarily unavailable. You can still enter the address manually.</p>}
      {freeSuggestions.map(suggestion => <button key={`${suggestion.label}-${suggestion.externalId || ''}`} type="button" role="option" aria-selected="false" className="routehub-address-suggestion" onPointerDown={event => selectOnPointerDown(event, () => selectSuggestion(suggestion))} onClick={event => selectOnClick(event, () => selectSuggestion(suggestion))}><span className="routehub-address-pin" aria-hidden="true">○</span><span><strong>{suggestion.name || suggestion.primary}</strong><small>{suggestion.secondary || suggestion.label}</small></span></button>)}
    </div>}
  </div>
}
