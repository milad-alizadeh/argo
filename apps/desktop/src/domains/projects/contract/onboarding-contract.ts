// IPC messages for the #2381 planning/application agent contract. Requests name a harness so the
// wire shape stays harness-neutral even though #2393 only implements the `claude` case; a later
// harness (#2394) is a new main-process handler, not a new schema.
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { acceptedSetupPlanSchema, setupPlanningResultSchema } from './setup-plan'
import {
  setupApplicationProgressEventSchema,
  setupPlanningProgressEventSchema,
} from './setup-progress'

export const ONBOARDING_HARNESSES = ['claude', 'codex'] as const
export type OnboardingHarness = (typeof ONBOARDING_HARNESSES)[number]

export const onboardingPlanStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.plan.start'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  harness: z.enum(ONBOARDING_HARNESSES),
})
export type OnboardingPlanStartRequest = z.infer<typeof onboardingPlanStartRequestSchema>

export const onboardingRunStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.run.started'),
  requestId: identifierSchema,
  runId: identifierSchema,
})
export type OnboardingRunStarted = z.infer<typeof onboardingRunStartedSchema>

export const onboardingPlanStatusRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.plan.status'),
  requestId: identifierSchema,
  runId: identifierSchema,
})
export type OnboardingPlanStatusRequest = z.infer<typeof onboardingPlanStatusRequestSchema>

export const ONBOARDING_PLAN_OUTCOMES = ['running', 'ready', 'invalid-output', 'timed-out'] as const

export const onboardingPlanStatusSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.plan.status-report'),
  requestId: identifierSchema,
  runId: identifierSchema,
  outcome: z.enum(ONBOARDING_PLAN_OUTCOMES),
  events: z.array(setupPlanningProgressEventSchema),
  result: setupPlanningResultSchema.nullable(),
  issues: z.array(z.string()),
})
export type OnboardingPlanStatus = z.infer<typeof onboardingPlanStatusSchema>

export const onboardingApplyStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.apply.start'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  harness: z.enum(ONBOARDING_HARNESSES),
  acceptedPlan: acceptedSetupPlanSchema,
})
export type OnboardingApplyStartRequest = z.infer<typeof onboardingApplyStartRequestSchema>

export const onboardingApplyStatusRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.apply.status'),
  requestId: identifierSchema,
  runId: identifierSchema,
})
export type OnboardingApplyStatusRequest = z.infer<typeof onboardingApplyStatusRequestSchema>

export const ONBOARDING_APPLY_OUTCOMES = [
  'running',
  'completed',
  'needs-review',
  'failed',
  'invalid-output',
  'timed-out',
] as const

const applicationStepReportSchema = z.strictObject({
  stepId: identifierSchema,
  status: z.enum(['passed', 'failed']),
  message: z.string(),
})

export const onboardingApplyStatusSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('onboarding.apply.status-report'),
  requestId: identifierSchema,
  runId: identifierSchema,
  outcome: z.enum(ONBOARDING_APPLY_OUTCOMES),
  events: z.array(setupApplicationProgressEventSchema),
  steps: z.array(applicationStepReportSchema),
  drift: z.string().nullable(),
  issues: z.array(z.string()),
})
export type OnboardingApplyStatus = z.infer<typeof onboardingApplyStatusSchema>
