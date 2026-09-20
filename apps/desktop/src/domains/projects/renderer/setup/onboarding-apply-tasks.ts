import type {
  OnboardingApplyTask,
  OnboardingRecommendation,
  OnboardingState,
  OnboardingTarget,
} from './onboarding-model'
import { onboardingText, recommendationText } from './project-onboarding-copy'

export function applyTasksFor(state: OnboardingState): OnboardingApplyTask[] {
  if (state.method === 'manual') return []
  return [
    {
      detail: onboardingText('onboarding.applyTask.write.detail'),
      id: 'write-setup',
      kind: 'prepare',
      label: onboardingText('onboarding.applyTask.write.label'),
    },
    ...repositoryTasks(state.repositoryRecommendations),
    {
      detail: onboardingText('onboarding.applyTask.verifyProject.detail'),
      id: 'verify-repository-setup',
      kind: 'verify',
      label: onboardingText('onboarding.applyTask.verifyProject.label'),
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
        label: onboardingText('onboarding.applyTask.installForTarget', {
          target: target.name,
          tool: recommendationText(recommendation, 'label'),
        }),
        recommendationId: recommendation.id,
        targetId: target.id,
      })),
    {
      detail: onboardingText('onboarding.applyTask.runCommand', {
        command: target.buildCommand || onboardingText('onboarding.applyTask.buildCommand'),
      }),
      id: `build-${target.id}`,
      kind: 'verify' as const,
      label: onboardingText('onboarding.applyTask.buildTarget', { target: target.name }),
      targetId: target.id,
    },
    {
      detail: onboardingText('onboarding.applyTask.runCommand', {
        command: target.testCommand || onboardingText('onboarding.applyTask.testCommand'),
      }),
      id: `test-${target.id}`,
      kind: 'verify' as const,
      label: onboardingText('onboarding.applyTask.testTarget', { target: target.name }),
      targetId: target.id,
    },
  ]
}
