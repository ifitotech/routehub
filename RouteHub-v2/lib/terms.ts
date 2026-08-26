/**
 * Terms acceptance is intentionally versioned. A new version can request a
 * fresh acknowledgement without touching the user's account or route data.
 * The value is stored locally because acceptance is device/browser specific.
 */
export const TERMS_VERSION = 'v1'

export function termsStorageKey(userId: string) {
  return `routehub_terms_${TERMS_VERSION}:${userId}`
}

export function hasAcceptedTerms(userId: string) {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(termsStorageKey(userId)) === 'accepted'
}

export function acceptTerms(userId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(termsStorageKey(userId), 'accepted')
}
