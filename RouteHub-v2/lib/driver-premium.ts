'use client'

import type {DriverMode} from './driver-mode-preference'
import type {NavigationPreference} from './navigation-preference'

/**
 * Product rules for the Driver experience.
 *
 * Keep the preview on while the feature is being tested. When billing is
 * ready, set NEXT_PUBLIC_DRIVER_PREMIUM_ENFORCEMENT=true in the deployed
 * environment. The UI will then enforce the company plan consistently
 * instead of relying on a setting saved on an individual phone.
 */
export const DRIVER_PREMIUM_ENFORCEMENT = process.env.NEXT_PUBLIC_DRIVER_PREMIUM_ENFORCEMENT === 'true'

const PREMIUM_PLANS = new Set(['premium', 'pro', 'enterprise', 'trial'])

export function hasDriverPremium(plan?: string | null) {
  return PREMIUM_PLANS.has(String(plan || '').trim().toLowerCase())
}

export function driverPremiumFeaturesAvailable(plan?: string | null) {
  return !DRIVER_PREMIUM_ENFORCEMENT || hasDriverPremium(plan)
}

export function resolveDriverExperience(
  requestedMode: DriverMode,
  requestedNavigation: NavigationPreference,
  companyPlan?: string | null,
) {
  if (!driverPremiumFeaturesAvailable(companyPlan)) {
    return {mode: 'simple' as const, navigation: 'external' as const, premium: false}
  }

  return {
    mode: requestedMode,
    // Simple is deliberately the one-tap, external-navigation experience.
    navigation: requestedMode === 'simple' ? 'external' as const : requestedNavigation,
    premium: hasDriverPremium(companyPlan),
  }
}
