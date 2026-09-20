import type { SetOnboardingState } from './onboarding-controller-types'
import { targetsFromManualSource } from './onboarding-manual-targets'
import type { OnboardingController } from './onboarding-model'

export function onboardingSettingsActions(
  setState: SetOnboardingState,
): Pick<
  OnboardingController['actions'],
  | 'setDefaultHarness'
  | 'setFailureTarget'
  | 'setHarness'
  | 'setManualSource'
  | 'setPlanOutcome'
  | 'validateManualSource'
> {
  return {
    setDefaultHarness: (defaultHarness) =>
      setState((current) => ({
        ...current,
        defaultHarness,
        event: defaultHarness ? 'default-harness-set' : 'default-harness-cleared',
      })),
    setFailureTarget: (failureTargetId) =>
      setState((current) => ({
        ...current,
        event: failureTargetId ? 'failure-target-set' : 'failure-target-cleared',
        failureTargetId,
      })),
    setHarness: (harness) => setState((current) => ({ ...current, harness })),
    setManualSource: (manualSource) =>
      setState((current) => ({ ...current, manualSource, manualValidated: false })),
    setPlanOutcome: (planOutcome) =>
      setState((current) => ({ ...current, event: `plan-outcome-${planOutcome}`, planOutcome })),
    validateManualSource: () =>
      setState((current) => {
        const targets = targetsFromManualSource(current.manualSource)
        return targets
          ? { ...current, event: 'manual-source-valid', manualValidated: true, targets }
          : current
      }),
  }
}
