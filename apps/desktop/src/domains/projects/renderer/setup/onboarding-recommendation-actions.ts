import type { SetOnboardingState } from './onboarding-controller-types'
import type { OnboardingController } from './onboarding-model'

export function onboardingRecommendationActions(
  setState: SetOnboardingState,
): Pick<
  OnboardingController['actions'],
  'toggleRepositoryRecommendation' | 'updateRepositoryRecommendation'
> {
  return {
    toggleRepositoryRecommendation: (recommendationId) =>
      setState((current) => ({
        ...current,
        repositoryRecommendations: current.repositoryRecommendations.map((recommendation) =>
          recommendation.id === recommendationId
            ? { ...recommendation, accepted: !recommendation.accepted }
            : recommendation,
        ),
      })),
    updateRepositoryRecommendation: (recommendationId, effect) =>
      setState((current) => ({
        ...current,
        event: 'repository-recommendation-customized',
        repositoryRecommendations: current.repositoryRecommendations.map((recommendation) =>
          recommendation.id === recommendationId ? { ...recommendation, effect } : recommendation,
        ),
      })),
  }
}
