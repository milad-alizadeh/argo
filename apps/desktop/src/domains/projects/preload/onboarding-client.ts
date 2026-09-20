import { projectError } from '@/domains/projects/contract/contract'
import type {
  OnboardingApplyStatus,
  OnboardingHarness,
  OnboardingPlanStatus,
  OnboardingRunStarted,
} from '@/domains/projects/contract/onboarding-contract'
import { ONBOARDING_OPERATIONS } from '@/domains/projects/contract/onboarding-operations'
import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import { createDomainClient } from '@/shared/ipc/client'

export type ProjectError = ReturnType<typeof projectError>

export type OnboardingClient = {
  startOnboardingPlan(request: {
    projectId: string
    harness: OnboardingHarness
  }): Promise<OnboardingRunStarted | ProjectError>
  onboardingPlanStatus(request: { runId: string }): Promise<OnboardingPlanStatus | ProjectError>
  startOnboardingApply(request: {
    projectId: string
    harness: OnboardingHarness
    acceptedPlan: AcceptedSetupPlan
  }): Promise<OnboardingRunStarted | ProjectError>
  onboardingApplyStatus(request: { runId: string }): Promise<OnboardingApplyStatus | ProjectError>
}

export function createOnboardingClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): OnboardingClient {
  const client = createDomainClient(ONBOARDING_OPERATIONS, invoke, projectError)
  return {
    startOnboardingPlan: (request) => client.planStart(request),
    onboardingPlanStatus: (request) => client.planStatus(request),
    startOnboardingApply: (request) => client.applyStart(request),
    onboardingApplyStatus: (request) => client.applyStatus(request),
  }
}
