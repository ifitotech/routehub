// The Driver tour now uses current product captures rather than the old
// illustrated previews, so completed v2 tours should refresh once.
export const ONBOARDING_VERSION = 'v3'
export const ONBOARDING_REPLAY_EVENT = 'routehub:show-onboarding'

export type OnboardingAudience = 'driver' | 'manager'

export function onboardingStorageKey(userId: string, audience: OnboardingAudience) {
  return `routehub_onboarding_${ONBOARDING_VERSION}:${audience}:${userId}`
}

export function driverDeviceSetupKey(userId: string) {
  return `routehub_driver_device_setup:v1:${userId}`
}

export function requestOnboardingReplay() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT))
}
