import { z } from 'zod'
import {
  projectSetupEffectSchema,
  projectSetupPendingApprovalSchema,
} from '@/domains/projects/contract/project-setup-approval'
import { projectSetupQuestionSchema } from '@/domains/projects/contract/project-setup-question'
import { projectSetupRecoveryCodeSchema } from '@/domains/projects/contract/project-setup-recovery'
import { acceptedSetupPlanSchema, setupPlanSchema } from '@/domains/projects/contract/setup-plan'
import { PROJECT_SETUP_MACHINE_VERSION } from '@/domains/projects/main/setup/project-setup-machine'
import type { ProjectSetupRecord } from './project-setup-registry'

const harnessSchema = z.enum(['claude', 'codex'])
const setupQuestionsSchema = z.array(projectSetupQuestionSchema)
const setupProgressSchema = z.array(
  z.strictObject({
    stepId: z.string(),
    status: z.enum(['pending', 'running', 'waiting-for-user', 'passed', 'failed']),
    message: z.string(),
  }),
)
const projectSetupRowSchema = z.strictObject({
  checkpoint_version: z.union([z.literal(0), z.literal(1)]),
  machine_version: z.literal(PROJECT_SETUP_MACHINE_VERSION),
  revision: z.number().int().nonnegative(),
  persisted_snapshot: z.string(),
  receipts: z.string(),
  saved_at: z.string().datetime(),
})

const projectSetupSnapshotSchema = z.strictObject({
  children: z.record(z.string(), z.unknown()),
  context: z.strictObject({
    manualSource: z.string(),
    selectedHarness: harnessSchema.nullable(),
    applicationHarness: harnessSchema.nullable(),
    attemptNumber: z.number().int().positive().nullable(),
    attemptEvidence: z
      .array(
        z.strictObject({
          number: z.number().int().positive(),
          planningHarness: harnessSchema,
          planningSessionId: z.string().nullable(),
          applicationSessionId: z.string().nullable(),
          acceptedPlanRevision: z.string().nullable(),
        }),
      )
      .default([]),
    planningSessionId: z.string().nullable(),
    applicationSessionId: z.string().nullable(),
    questions: setupQuestionsSchema,
    plan: setupPlanSchema.nullable(),
    acceptedPlan: acceptedSetupPlanSchema.nullable(),
    progress: setupProgressSchema,
    finalDiff: z.string().nullable(),
    activeEffect: projectSetupEffectSchema.nullable(),
    recoveryMessage: projectSetupRecoveryCodeSchema.nullable(),
    pendingFinalization: z.boolean().default(false),
    pendingApproval: z
      .strictObject({
        effect: z.enum(['planning', 'application']),
        permissionId: z.string(),
        description: z.string(),
      })
      .nullable()
      .default(null),
  }),
  historyValue: z.record(z.string(), z.unknown()),
  status: z.literal('active'),
  value: z.enum([
    'Choosing setup method',
    'Manual setup',
    'Planning',
    'Questions',
    'Reviewing plan',
    'Customizing Project setup',
    'Applying',
    'Reviewing changes',
    'Cancelling',
    'Cancel failed',
    'Finalizing',
    'Review required',
    'Interrupted',
    'Deferred',
    'Ready',
  ]),
})

const projectSetupReceiptSchema = z.record(
  z.string(),
  z.strictObject({
    projectId: z.string(),
    revision: z.number().int().nonnegative(),
    screen: z.enum([
      'choosing-method',
      'manual',
      'planning',
      'questions',
      'reviewing-plan',
      'customizing-project-setup',
      'applying',
      'reviewing-diff',
      'finalizing',
      'cancel-failed',
      'awaiting-approval',
      'review-required',
      'interrupted',
      'deferred',
      'ready',
    ]),
    manualSource: z.string(),
    attempt: z
      .strictObject({
        number: z.number().int().positive(),
        planningHarness: harnessSchema,
        applicationHarness: harnessSchema.nullable(),
        planningSessionId: z.string().nullable(),
        applicationSessionId: z.string().nullable(),
      })
      .nullable(),
    questions: setupQuestionsSchema,
    plan: setupPlanSchema.nullable(),
    acceptedPlan: acceptedSetupPlanSchema.nullable(),
    progress: setupProgressSchema,
    finalDiff: z.string().nullable(),
    activeEffect: z.enum(['planning', 'application']).nullable(),
    recoveryMessage: projectSetupRecoveryCodeSchema.nullable(),
    pendingApproval: projectSetupPendingApprovalSchema,
  }),
)

export const persistedSetupContext = (value: unknown) =>
  projectSetupSnapshotSchema.parse(value).context

export function projectSetupRecordFromDatabase(projectId: string, value: unknown) {
  const row = projectSetupRowSchema.parse(value)
  const persistedSnapshot = projectSetupSnapshotSchema.parse(JSON.parse(row.persisted_snapshot))
  const receipts = projectSetupReceiptSchema.parse(JSON.parse(row.receipts))
  return {
    migrated: row.checkpoint_version === 0,
    record: {
      checkpointVersion: 1 as const,
      machineVersion: row.machine_version,
      projectId,
      revision: row.revision,
      savedAt: row.saved_at,
      persistedSnapshot: persistedSnapshot as unknown as ProjectSetupRecord['persistedSnapshot'],
      receipts,
    },
  }
}
