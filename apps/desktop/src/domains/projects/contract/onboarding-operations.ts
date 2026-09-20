import { projectErrorSchema } from '@/domains/projects/contract/contract'
import {
  onboardingApplyStartRequestSchema,
  onboardingApplyStatusRequestSchema,
  onboardingApplyStatusSchema,
  onboardingPlanStartRequestSchema,
  onboardingPlanStatusRequestSchema,
  onboardingPlanStatusSchema,
  onboardingRunStartedSchema,
} from '@/domains/projects/contract/onboarding-contract'

// The onboarding IPC contract, kept beside PROJECT_OPERATIONS but named for its own domain: the
// #2381 planning/application agent, not the Project registry, owns these four operations.
export const ONBOARDING_OPERATIONS = {
  planStart: {
    name: 'onboarding.plan.start',
    channel: 'argo:onboarding:plan:start',
    request: onboardingPlanStartRequestSchema,
    reply: onboardingRunStartedSchema.or(projectErrorSchema),
  },
  planStatus: {
    name: 'onboarding.plan.status',
    channel: 'argo:onboarding:plan:status',
    request: onboardingPlanStatusRequestSchema,
    reply: onboardingPlanStatusSchema.or(projectErrorSchema),
  },
  applyStart: {
    name: 'onboarding.apply.start',
    channel: 'argo:onboarding:apply:start',
    request: onboardingApplyStartRequestSchema,
    reply: onboardingRunStartedSchema.or(projectErrorSchema),
  },
  applyStatus: {
    name: 'onboarding.apply.status',
    channel: 'argo:onboarding:apply:status',
    request: onboardingApplyStatusRequestSchema,
    reply: onboardingApplyStatusSchema.or(projectErrorSchema),
  },
} as const
