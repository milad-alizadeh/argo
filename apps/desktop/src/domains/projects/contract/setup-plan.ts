// The #2381 canonical onboarding agent contract. A planning agent produces a result that Argo
// validates before render; schemas live apart so each concern stays small.

import { z } from 'zod'
import { identifierSchema } from '../../../shared/validation'
import { acceptedSetupPlanSchema, setupPlanSchema } from './setup-plan-schema'
import type { AcceptedSetupPlan, SetupPlan } from './setup-plan-types'

export type { AcceptedSetupPlan, SetupPlan }
export { acceptedSetupPlanSchema, setupPlanSchema }

const questionSchema = z.object({
  id: identifierSchema,
  prompt: z.string().min(1),
  context: z.string().optional(),
})

export const setupPlanningResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('needs-user-input'),
    revision: z.string().min(1),
    questions: z.array(questionSchema).min(1),
  }),
  z.object({
    status: z.literal('ready-for-review'),
    revision: z.string().min(1),
    plan: setupPlanSchema,
  }),
  z.object({
    status: z.literal('cannot-plan'),
    revision: z.string().min(1),
    reason: z.enum([
      'inaccessible-project',
      'ambiguous-boundary',
      'unsupported-workspace',
      'skill-unavailable',
    ]),
    evidence: z.string().min(1),
    recoveryAction: z.string().min(1),
  }),
])

export type SetupPlanningResult = z.infer<typeof setupPlanningResultSchema>

export function parseSetupPlanningResult(value: unknown): SetupPlanningResult {
  return setupPlanningResultSchema.parse(value)
}

export function parseAcceptedSetupPlan(value: unknown): AcceptedSetupPlan {
  return acceptedSetupPlanSchema.parse(value)
}

export interface AcceptedPlanValidationOutcome {
  valid: boolean
  issues: string[]
}

/** Proves an accepted plan derives from the reviewed source plan (#2381 acceptance rule). */
export function validateAcceptedSetupPlan(
  sourcePlan: SetupPlan,
  acceptedPlan: AcceptedSetupPlan,
): AcceptedPlanValidationOutcome {
  const issues = validationIssues(sourcePlan, acceptedPlan)
  return { valid: issues.length === 0, issues }
}

function validationIssues(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan): string[] {
  const issues = revisionIssues(sourcePlan, acceptedPlan)
  const sourceIds = collectionIds(sourcePlan)
  for (const [name, items, allowed] of boundedCollections(acceptedPlan, sourceIds)) {
    for (const item of items) {
      if (!allowed.has(item.id)) {
        issues.push(
          `Accepted ${name} entry "${item.id}" is not present in the reviewed source plan.`,
        )
      }
    }
  }
  return issues
}

function revisionIssues(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan): string[] {
  const issues: string[] = []
  if (acceptedPlan.sourceRevision !== sourcePlan.source.planRevision) {
    issues.push(
      `Accepted plan revision "${acceptedPlan.sourceRevision}" does not match source revision "${sourcePlan.source.planRevision}".`,
    )
  }
  if (acceptedPlan.projectRoot !== sourcePlan.source.projectRoot) {
    issues.push('Accepted plan project root does not match the source plan.')
  }
  for (const [path, hash] of Object.entries(acceptedPlan.fingerprints)) {
    if (sourcePlan.source.fingerprints[path] !== hash)
      issues.push(`Fingerprint for "${path}" does not match the source plan.`)
  }
  return issues
}

type PlanCollection =
  | 'targets'
  | 'capabilities'
  | 'toolRecommendations'
  | 'repositoryActions'
  | 'targetActions'
  | 'verification'

function collectionIds(plan: SetupPlan): Record<PlanCollection, Set<string>> {
  return {
    targets: new Set(plan.targets.map((item) => item.id)),
    capabilities: new Set(plan.capabilities.map((item) => item.id)),
    toolRecommendations: new Set(plan.toolRecommendations.map((item) => item.id)),
    repositoryActions: new Set(plan.repositoryActions.map((item) => item.id)),
    targetActions: new Set(plan.targetActions.map((item) => item.id)),
    verification: new Set(plan.verification.map((item) => item.id)),
  }
}

function boundedCollections(
  acceptedPlan: AcceptedSetupPlan,
  sourceIds: Record<PlanCollection, Set<string>>,
) {
  return [
    ['targets', acceptedPlan.targets, sourceIds.targets],
    ['capabilities', acceptedPlan.capabilities, sourceIds.capabilities],
    ['toolRecommendations', acceptedPlan.toolRecommendations, sourceIds.toolRecommendations],
    ['repositoryActions', acceptedPlan.repositoryActions, sourceIds.repositoryActions],
    ['targetActions', acceptedPlan.targetActions, sourceIds.targetActions],
    ['verification', acceptedPlan.verification, sourceIds.verification],
  ] as const
}
