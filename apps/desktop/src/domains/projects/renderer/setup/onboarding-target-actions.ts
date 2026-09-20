import type { SetOnboardingState } from './onboarding-controller-types'
import type { OnboardingController, OnboardingState } from './onboarding-model'

export function onboardingTargetActions(
  setState: SetOnboardingState,
): Pick<
  OnboardingController['actions'],
  | 'addTarget'
  | 'removeTarget'
  | 'toggleTargetRecommendation'
  | 'updateTarget'
  | 'updateTargetRecommendation'
> {
  return {
    addTarget: () => setState(addTarget),
    removeTarget: (targetId) =>
      setState((current) => ({
        ...current,
        event: 'target-removed',
        targets: current.targets.filter(({ id }) => id !== targetId),
      })),
    toggleTargetRecommendation: (targetId, recommendationId) =>
      setState((current) => ({
        ...current,
        targets: current.targets.map((target) =>
          target.id === targetId
            ? {
                ...target,
                recommendations: target.recommendations.map((recommendation) =>
                  recommendation.id === recommendationId
                    ? { ...recommendation, accepted: !recommendation.accepted }
                    : recommendation,
                ),
              }
            : target,
        ),
      })),
    updateTarget: (targetId, patch) =>
      setState((current) => ({
        ...current,
        event: 'target-updated',
        targets: current.targets.map((target) =>
          target.id === targetId ? { ...target, ...patch } : target,
        ),
      })),
    updateTargetRecommendation: (targetId, recommendationId, effect) =>
      setState((current) => ({
        ...current,
        event: 'target-recommendation-customized',
        targets: current.targets.map((target) =>
          target.id === targetId
            ? {
                ...target,
                recommendations: target.recommendations.map((recommendation) =>
                  recommendation.id === recommendationId
                    ? { ...recommendation, effect }
                    : recommendation,
                ),
              }
            : target,
        ),
      })),
  }
}

function addTarget(current: OnboardingState): OnboardingState {
  return {
    ...current,
    event: 'target-added',
    targets: [
      ...current.targets,
      {
        buildCommand: 'bun run build',
        existingTools: [],
        framework: 'custom',
        id: `target-${current.targets.length + 1}`,
        name: `target-${current.targets.length + 1}`,
        packageManager: 'Bun',
        path: '.',
        recommendations: [],
        startCommand: 'bun run dev',
        testCommand: 'bun run test',
      },
    ],
  }
}
