'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {getLocale, isLocale, translations, type Locale} from './i18n'

// Older dictionary entries were saved with a UTF-8/Latin-1 mismatch. Repair
// them at the presentation boundary so every screen (including cached PWAs)
// renders real accents without changing the stored language preference.
function repairMojibake(value: string): string {
  return value
    .replaceAll('ÃƒÂ', 'Ã')
    .replaceAll('Ãƒâ€°', 'É')
    .replaceAll('ÃƒÂ©', 'é')
    .replaceAll('ÃƒÂ¡', 'á')
    .replaceAll('ÃƒÂ­', 'í')
    .replaceAll('ÃƒÂ³', 'ó')
    .replaceAll('ÃƒÂº', 'ú')
    .replaceAll('ÃƒÂ±', 'ñ')
    .replaceAll('Ã¡', 'á').replaceAll('Ã©', 'é').replaceAll('Ã­', 'í')
    .replaceAll('Ã³', 'ó').replaceAll('Ãº', 'ú').replaceAll('Ã±', 'ñ')
    .replaceAll('Ã‰', 'É').replaceAll('Ãš', 'Ú').replaceAll('Ã‘', 'Ñ')
    .replaceAll('Â¿', '¿').replaceAll('Â¡', '¡').replaceAll('Â·', '·')
    .replaceAll('â€¦', '…').replaceAll('â€™', '’').replaceAll('â€“', '–')
    .replaceAll('âš ', '⚠').replaceAll('Â', '')
}

function decodeUtf8Garble(value: string): string {
  let repaired = value
  for (let pass = 0; pass < 3 && /[\u00c3\u00c2]/.test(repaired); pass += 1) {
    try {
      const decoded = decodeURIComponent(escape(repaired))
      if (decoded === repaired) break
      repaired = decoded
    } catch {
      break
    }
  }
  return repaired.replace(/\u00a0/g, ' ').replace(/\u00e2\u009a\u00a0/g, '\u26a0')
}

function repairedDictionary(locale: Locale) {
  return Object.fromEntries(Object.entries(translations[locale]).map(([key, value]) => [key, decodeUtf8Garble(repairMojibake(value))])) as typeof translations[Locale]
}

export type ThemePreference = 'light'

export const LANGUAGE_EVENT = 'routehub:language-change'
export const THEME_EVENT = 'routehub:theme-change'

export function setLocalePreference(locale: Locale) {
  window.localStorage.setItem('routehub_language', locale)
  window.localStorage.removeItem('rh2-language')
  document.documentElement.lang = locale
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {detail: {locale}}))
}

export function resolvedTheme(_preference: ThemePreference): 'light' {
  // RouteHub has one approved visual language. A system-level dark setting
  // must never change just part of a route workflow.
  return 'light'
}

export function applyThemePreference(_preference: ThemePreference = 'light') {
  window.localStorage.setItem('routehub_theme', 'light')
  window.localStorage.removeItem('rh2-theme')
  const resolved = resolvedTheme('light')
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  window.dispatchEvent(new CustomEvent(THEME_EVENT, {detail: {preference: 'light', resolved}}))
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const sync = () => {
      const next = getLocale()
      setLocale(next)
      document.documentElement.lang = next
    }
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'routehub_language' || event.key === 'rh2-language') sync()
    }
    sync()
    window.addEventListener(LANGUAGE_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const changeLocale = useCallback((value: string) => {
    if (isLocale(value)) setLocalePreference(value)
  }, [])

  // Keep translated labels referentially stable. Screens use the dictionary
  // in data-loading callback dependencies; recreating it on every render can
  // restart those effects indefinitely and leave a page stuck loading.
  const dictionary = useMemo(() => repairedDictionary(locale), [locale])
  return {locale, t: dictionary, setLocale: changeLocale}
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>('light')

  useEffect(() => {
    const sync = () => {
      setTheme('light')
      document.documentElement.dataset.theme = 'light'
      document.documentElement.style.colorScheme = 'light'
    }
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === 'routehub_theme') sync() }
    sync()
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const changeTheme = useCallback(() => applyThemePreference('light'), [])

  return {theme, setTheme: changeTheme}
}
