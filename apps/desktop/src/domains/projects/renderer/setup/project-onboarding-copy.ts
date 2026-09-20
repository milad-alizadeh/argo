import { i18n } from '@/platform/renderer/i18n/i18n'
import type { OnboardingRecommendation } from './onboarding-model'

export function onboardingText(key: string, options?: Record<string, string | number>) {
  return i18n.t(`projects:onboarding.${key}`, { defaultValue: key, ...options })
}

export function recommendationText(
  recommendation: OnboardingRecommendation,
  field: 'label' | 'reason',
) {
  return onboardingText(`recommendation.${recommendation.copyKey}.${field}`)
}

export function targetCount(count: number) {
  return onboardingText('count.target', { count })
}

export function runnableTargetCount(count: number) {
  return onboardingText('count.runnableTarget', { count })
}
