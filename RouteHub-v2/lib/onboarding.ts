export const ONBOARDING_VERSION = 'v1'
export const ONBOARDING_REPLAY_EVENT = 'routehub:show-onboarding'

export type OnboardingAudience = 'driver' | 'manager'

export function onboardingStorageKey(userId: string, audience: OnboardingAudience) {
  return `routehub_onboarding_${ONBOARDING_VERSION}:${audience}:${userId}`
}

export function requestOnboardingReplay() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT))
}
