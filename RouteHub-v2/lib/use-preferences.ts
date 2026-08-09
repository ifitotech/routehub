'use client'

import {useCallback, useEffect, useState} from 'react'
import {getLocale, isLocale, translations, type Locale} from './i18n'

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

  return {locale, t: translations[locale], setLocale: changeLocale}
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
