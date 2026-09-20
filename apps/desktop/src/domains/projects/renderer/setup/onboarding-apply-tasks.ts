import type {
  OnboardingApplyTask,
  OnboardingRecommendation,
  OnboardingState,
  OnboardingTarget,
} from './onboarding-model'

export function applyTasksFor(state: OnboardingState): OnboardingApplyTask[] {
  if (state.method === 'manual') return []
  return [
    { id: 'write-setup', kind: 'prepare' },
    ...repositoryTasks(state.repositoryRecommendations),
    { id: 'verify-repository-setup', kind: 'verify' },
    ...state.targets.flatMap(targetTasks),
  ]
}

function repositoryTasks(recommendations: OnboardingRecommendation[]): OnboardingApplyTask[] {
  return recommendations
    .filter(({ accepted }) => accepted)
    .map((recommendation) => ({
      id: `repository-${recommendation.id}`,
      kind: 'action',
      recommendationId: recommendation.id,
      waitsForUser: recommendation.waitsForUser,
    }))
}

function targetTasks(target: OnboardingTarget): OnboardingApplyTask[] {
  return [
    ...target.recommendations
      .filter(({ accepted }) => accepted)
      .map((recommendation) => ({
        id: `install-${target.id}-${recommendation.id}`,
        kind: 'install' as const,
        recommendationId: recommendation.id,
        targetId: target.id,
      })),
    { id: `build-${target.id}`, kind: 'verify', targetId: target.id },
    { id: `test-${target.id}`, kind: 'verify', targetId: target.id },
  ]
}
