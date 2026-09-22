import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import type { ProjectError } from './project-error'
import {
  projectSetupEffectSchema,
  projectSetupPendingApprovalSchema,
} from './setup/project-setup-approval'
import {
  projectSetupAnswerSchema,
  projectSetupQuestionSchema,
} from './setup/project-setup-question'
import { projectSetupRecoveryCodeSchema } from './setup/project-setup-recovery'
import { projectSetupScreenSchema } from './setup/project-setup-screen'
import { acceptedSetupPlanSchema, setupPlanSchema } from './setup/setup-plan'
import { setupStepStatusSchema } from './setup/setup-progress'

export {
  PROJECT_ERROR_CODES,
  type ProjectError,
  type ProjectErrorCode,
  projectError,
  projectErrorSchema,
} from './project-error'

export const projectOpenRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.open'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectOpenRequest = z.infer<typeof projectOpenRequestSchema>

const projectLabelSchema = z.strictObject({ id: identifierSchema, name: z.string().min(1) })

export const projectOpenedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.opened'),
  requestId: identifierSchema,
  project: projectLabelSchema,
})
export type ProjectOpened = z.infer<typeof projectOpenedSchema>

export const projectSetupRequiredSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup-required'),
  requestId: identifierSchema,
  project: projectLabelSchema,
})
export type ProjectSetupRequired = z.infer<typeof projectSetupRequiredSchema>

const onboardingHarnessSchema = z.enum(['claude', 'codex'])
const onboardingHarnessAvailabilitySchema = z.strictObject({
  harness: onboardingHarnessSchema,
  unavailableReason: z.string().min(1).nullable(),
})
const projectSetupCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('choose-manual') }),
  z.strictObject({ type: z.literal('choose-agent'), harness: onboardingHarnessSchema }),
  z.strictObject({
    type: z.literal('answer-questions'),
    answers: z.array(projectSetupAnswerSchema).min(1),
  }),
  z.strictObject({ type: z.literal('request-plan-change'), feedback: z.string().min(1) }),
  z.strictObject({ type: z.literal('continue-plan-review') }),
  z.strictObject({ type: z.literal('accept-plan'), acceptedPlan: acceptedSetupPlanSchema }),
  z.strictObject({
    type: z.literal('choose-application-harness'),
    harness: onboardingHarnessSchema,
  }),
  z.strictObject({ type: z.literal('approve-final-diff') }),
  z.strictObject({
    type: z.literal('request-application-change'),
    feedback: z.string().min(1),
  }),
  z.strictObject({ type: z.literal('cancel-setup') }),
  z.strictObject({ type: z.literal('retry-cancel') }),
  z.strictObject({ type: z.literal('approve-effect') }),
  z.strictObject({ type: z.literal('reject-effect') }),
  z.strictObject({ type: z.literal('resume-planning') }),
  z.strictObject({ type: z.literal('resume-application') }),
  z.strictObject({ type: z.literal('restart-attempt') }),
  z.strictObject({ type: z.literal('defer') }),
  z.strictObject({ type: z.literal('back') }),
  z.strictObject({ type: z.literal('save-manual'), source: z.string().min(1).max(100_000) }),
  z.strictObject({ type: z.literal('resume-setup') }),
  z.strictObject({ type: z.literal('edit-setup') }),
])
export type ProjectSetupCommand = z.infer<typeof projectSetupCommandSchema>

export const projectSetupCommandRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.command'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  commandId: identifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  command: projectSetupCommandSchema,
})
export type ProjectSetupCommandRequest = z.infer<typeof projectSetupCommandRequestSchema>

export const projectSetupSnapshotRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.snapshot'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectSetupSnapshotRequest = z.infer<typeof projectSetupSnapshotRequestSchema>

export const projectSetupSnapshotSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.snapshot'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  revision: z.number().int().nonnegative(),
  harnesses: z.array(onboardingHarnessAvailabilitySchema).length(2).optional(),
  screen: projectSetupScreenSchema,
  manualSource: z.string(),
  attempt: z
    .strictObject({
      number: z.number().int().positive(),
      planningHarness: onboardingHarnessSchema,
      applicationHarness: onboardingHarnessSchema.nullable(),
      planningSessionId: identifierSchema.nullable(),
      applicationSessionId: identifierSchema.nullable(),
    })
    .nullable(),
  questions: z.array(projectSetupQuestionSchema),
  plan: setupPlanSchema.nullable(),
  acceptedPlan: acceptedSetupPlanSchema.nullable(),
  progress: z.array(
    z.strictObject({
      stepId: identifierSchema,
      status: setupStepStatusSchema,
      message: z.string().min(1),
    }),
  ),
  finalDiff: z.string().nullable(),
  activeEffect: projectSetupEffectSchema.nullable(),
  recoveryMessage: projectSetupRecoveryCodeSchema.nullable(),
  pendingApproval: projectSetupPendingApprovalSchema,
})
export type ProjectSetupSnapshot = z.infer<typeof projectSetupSnapshotSchema>

export type ProjectOpenReply = ProjectOpened | ProjectSetupRequired | ProjectError
export type ProjectSetupReply = ProjectSetupSnapshot | ProjectError
