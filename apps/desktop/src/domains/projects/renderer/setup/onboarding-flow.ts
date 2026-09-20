import type { OnboardingMethod, OnboardingStage, OnboardingState } from './onboarding-model'

export const BACK_STAGE: Partial<Record<OnboardingStage, OnboardingStage>> = {
  method: 'folder',
  'no-default': 'method',
  harness: 'method',
  analyzing: 'method',
  recommendations: 'method',
  customize: 'recommendations',
  'project-setup': 'recommendations',
  manual: 'method',
  applying: 'project-setup',
  'apply-failed': 'project-setup',
  starting: 'project-setup',
  complete: 'project-setup',
}

export const ANALYSIS_TASKS = [
  { id: 'inspect-folder' },
  { id: 'identify-targets' },
  { id: 'resolve-commands' },
  { id: 'audit-setup' },
  { id: 'recommend-capabilities' },
  { id: 'define-verification' },
] as const

export function methodSelection(current: OnboardingState, method: OnboardingMethod) {
  if (method === 'manual') return { event: 'manual-selected', method, stage: 'manual' as const }
  if (!current.defaultHarness)
    return { event: 'default-harness-required', method: null, stage: 'method' as const }
  return { analysisStep: 0, event: 'analysis-started', method, stage: 'analyzing' as const }
}
