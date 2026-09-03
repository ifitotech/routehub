'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import {getLocale, isLocale, translations, type Locale} from './i18n'

function repairMojibake(value: string): string {
  return value
    .replaceAll('ÃƒÂ', 'Ã')
    .replaceAll('Ãƒâ€‰', 'É')
    .replaceAll('ÃƒÂé', 'é')
    .replaceAll('ÃƒÂá', 'á')
    .replaceAll('ÃƒÂí', 'í')
    .replaceAll('ÃƒÂó', 'ó')
    .replaceAll('ÃƒÂú', 'ú')
    .replaceAll('ÃƒÂñ', 'ñ')
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

export type ThemePreference = 'light' | 'dark' | 'system'

export const LANGUAGE_EVENT = 'routehub:language-change'
export const THEME_EVENT = 'routehub:theme-change'

export function setLocalePreference(locale: Locale) {
  window.localStorage.setItem('routehub_language', locale)
  window.localStorage.removeItem('rh2-language')
  document.documentElement.lang = locale
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, {detail: {locale}}))
}

export function themePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem('routehub_theme')
  return saved === 'dark' || saved === 'system' || saved === 'light' ? saved : 'dark'
}

export function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference
}

export function applyThemePreference(preference: ThemePreference = 'dark') {
  window.localStorage.setItem('routehub_theme', preference)
  window.localStorage.removeItem('rh2-theme')
  const resolved = resolvedTheme(preference)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
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

  const dictionary = useMemo(() => repairedDictionary(locale), [locale])
  return {locale, t: dictionary, setLocale: changeLocale}
}

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>('dark')

  useEffect(() => {
    const sync = () => {
      const preference = themePreference()
      setTheme(preference)
      const resolved = resolvedTheme(preference)
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
    }
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === 'routehub_theme') sync() }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemTheme = () => { if (themePreference() === 'system') sync() }
    sync()
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', onStorage)
    media.addEventListener?.('change', onSystemTheme)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', onStorage)
      media.removeEventListener?.('change', onSystemTheme)
    }
  }, [])

  const changeTheme = useCallback((preference: ThemePreference) => applyThemePreference(preference), [])

  return {theme, setTheme: changeTheme}
}
