import type {
  OnboardingApplyTask,
  OnboardingRecommendation,
  OnboardingState,
  OnboardingTarget,
} from './onboarding-model'
import { i18n } from '@/platform/renderer/i18n/i18n'

export function applyTasksFor(state: OnboardingState): OnboardingApplyTask[] {
  if (state.method === 'manual') return []
  return [
    {
      detail: 'Write the approved Project and Target configuration.',
      id: 'write-setup',
      kind: 'prepare',
      label: 'Write .argo/settings.json',
    },
    ...repositoryTasks(state.repositoryRecommendations),
    {
      detail: 'Make sure that each accepted Project change works.',
      id: 'verify-repository-setup',
      kind: 'verify',
      label: 'Verify Project changes',
    },
    ...state.targets.flatMap(targetTasks),
  ]
}

function repositoryTasks(recommendations: OnboardingRecommendation[]): OnboardingApplyTask[] {
  return recommendations
    .filter(({ accepted }) => accepted)
    .map((recommendation) => ({
      detail: recommendationText(recommendation, 'reason'),
      id: `repository-${recommendation.id}`,
      kind: 'action',
      label: recommendationText(recommendation, 'label'),
      recommendationId: recommendation.id,
      waitsForUser: recommendation.waitsForUser,
    }))
}

function targetTasks(target: OnboardingTarget): OnboardingApplyTask[] {
  return [
    ...target.recommendations
      .filter(({ accepted }) => accepted)
      .map((recommendation) => ({
        detail: recommendationText(recommendation, 'reason'),
        id: `install-${target.id}-${recommendation.id}`,
        kind: 'install' as const,
        label: `${recommendationText(recommendation, 'label')} for ${target.name}`,
        recommendationId: recommendation.id,
        targetId: target.id,
      })),
    {
      detail: `Run ${target.buildCommand || 'the build command'}.`,
      id: `build-${target.id}`,
      kind: 'verify' as const,
      label: `Build ${target.name}`,
      targetId: target.id,
    },
    {
      detail: `Run ${target.testCommand || 'the test command'}.`,
      id: `test-${target.id}`,
      kind: 'verify' as const,
      label: `Test ${target.name}`,
      targetId: target.id,
    },
  ]
}

function recommendationText(
  recommendation: OnboardingRecommendation,
  field: 'label' | 'reason',
): string {
  const key = `projects:onboarding.recommendation.${recommendation.copyKey}.${field}`
  return i18n.t(key, { defaultValue: recommendation.copyKey })
}
