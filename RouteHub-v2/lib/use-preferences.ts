'use client'

import {useCallback, useEffect, useState} from 'react'
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

export type ThemePreference = 'system' | 'light' | 'dark'

export const LANGUAGE_EVENT = 'routehub:language-change'
export const THEME_EVENT = 'routehub:theme-change'

export function setLocalePreference(locale: Locale) {
  window.localStorage.setItem('routehub_language', locale)
  window.localStorage.removeItem('rh2-language')
  document.documentElement.lang = locale
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {detail: {locale}}))
}

export function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyThemePreference(preference: ThemePreference) {
  window.localStorage.setItem('routehub_theme', preference)
  const resolved = resolvedTheme(preference)
  document.documentElement.dataset.theme = resolved
  window.dispatchEvent(new CustomEvent(THEME_EVENT, {detail: {preference, resolved}}))
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

  return {locale, t: repairedDictionary(locale), setLocale: changeLocale}
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>('system')

  useEffect(() => {
    const readPreference = (): ThemePreference => {
      const value = window.localStorage.getItem('routehub_theme')
      return value === 'light' || value === 'dark' ? value : 'system'
    }
    const sync = () => {
      const next = readPreference()
      setTheme(next)
      document.documentElement.dataset.theme = resolvedTheme(next)
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onMedia = () => { if (readPreference() === 'system') sync() }
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === 'routehub_theme') sync() }
    sync()
    media.addEventListener('change', onMedia)
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onMedia)
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const changeTheme = useCallback((value: string) => {
    if (value === 'system' || value === 'light' || value === 'dark') applyThemePreference(value)
  }, [])

  return {theme, setTheme: changeTheme}
}
