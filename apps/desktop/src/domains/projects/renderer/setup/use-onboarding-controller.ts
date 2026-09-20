import { useMemo, useState } from 'react'
import { onboardingFlowActions } from './onboarding-flow-actions'
import { initialState } from './onboarding-initial-state'
import type { OnboardingController, OnboardingState } from './onboarding-model'
import { useOnboardingProgress } from './onboarding-progress'
import { onboardingRecommendationActions } from './onboarding-recommendation-actions'
import { onboardingSettingsActions } from './onboarding-settings-actions'
import { onboardingTargetActions } from './onboarding-target-actions'

export function useOnboardingController({
  initialState: stateOverride,
  pauseProgress = false,
}: {
  initialState?: Partial<OnboardingState>
  pauseProgress?: boolean
} = {}): OnboardingController {
  const [state, setState] = useState<OnboardingState>(() => ({
    ...initialState(),
    ...stateOverride,
  }))
  useOnboardingProgress(state, setState, pauseProgress)
  const actions = useMemo(
    () => ({
      ...onboardingFlowActions(setState),
      ...onboardingRecommendationActions(setState),
      ...onboardingSettingsActions(setState),
      ...onboardingTargetActions(setState),
    }),
    [],
  )
  return { actions, state }
}
