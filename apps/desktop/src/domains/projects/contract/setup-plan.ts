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
  for (const [name, acceptedItems, sourceItems] of boundedCollections(sourcePlan, acceptedPlan)) {
    const sourceById = new Map(sourceItems.map((item) => [item.id, item]))
    for (const acceptedItem of acceptedItems) {
      const sourceItem = sourceById.get(acceptedItem.id)
      if (!sourceItem) {
        issues.push(
          `Accepted ${name} entry "${acceptedItem.id}" is not present in the reviewed source plan.`,
        )
      } else if (!sameContent(sourceItem, acceptedItem)) {
        issues.push(
          `Accepted ${name} entry "${acceptedItem.id}" does not match the reviewed source plan.`,
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
  if (!sameContent(sourcePlan.source.fingerprints, acceptedPlan.fingerprints)) {
    issues.push('Fingerprint set does not retain the complete source fingerprint set.')
  }
  return issues
}

function boundedCollections(sourcePlan: SetupPlan, acceptedPlan: AcceptedSetupPlan) {
  return [
    ['targets', acceptedPlan.targets, sourcePlan.targets],
    [
      'capabilities',
      acceptedPlan.capabilities,
      sourcePlan.capabilities.map(({ disposition: _disposition, ...capability }) => capability),
    ],
    ['toolRecommendations', acceptedPlan.toolRecommendations, sourcePlan.toolRecommendations],
    ['repositoryActions', acceptedPlan.repositoryActions, sourcePlan.repositoryActions],
    ['targetActions', acceptedPlan.targetActions, sourcePlan.targetActions],
    ['verification', acceptedPlan.verification, sourcePlan.verification],
  ] as const
}

function sameContent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
