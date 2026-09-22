import type { z } from 'zod'
import type { setupPlanSchema } from './setup-plan-schema'
import {
  validateDefaultTargets,
  validateIdentifiers,
  validatePrerequisites,
  validateTargetReferences,
} from './setup-plan-validation-rules'

type SetupPlan = z.infer<typeof setupPlanSchema>

export function validateSetupPlan(plan: SetupPlan, context: z.RefinementCtx): void {
  validateIdentifiers(plan, context)
  validateTargetReferences(plan, context)
  validateDefaultTargets(plan, context)
  validatePrerequisites(plan, context)
  validateVerificationCoverage(plan, context)
}

function validateVerificationCoverage(plan: SetupPlan, context: z.RefinementCtx): void {
  const verifiedTargetIds = new Set(plan.verification.map((step) => step.targetId))
  for (const target of plan.targets) {
    if (!verifiedTargetIds.has(target.id)) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: `Target "${target.id}" has no verification step.`,
      })
    }
  }
  const verifiedCapabilities = new Set(plan.verification.flatMap((step) => step.capabilityId ?? []))
  for (const capability of plan.capabilities) {
    if (capability.disposition === 'recommended' && !verifiedCapabilities.has(capability.id)) {
      context.addIssue({
        code: 'custom',
        path: ['verification'],
        message: `Recommended capability "${capability.id}" has no verification step.`,
      })
    }
  }
}

export interface PlanValidationOutcome {
  valid: boolean
  issues: string[]
}

/** Proves stable IDs for unchanged items across a planning revision (#2381 revision rule). */
export function validatePlanRevision(
  previousPlan: SetupPlan,
  nextPlan: SetupPlan,
): PlanValidationOutcome {
  const issues =
    nextPlan.source.planRevision === previousPlan.source.planRevision
      ? ['A revised plan must advance its plan revision.']
      : []
  const previousKinds = entryKinds(previousPlan)
  const nextKinds = entryKinds(nextPlan)
  for (const [id, kind] of previousKinds) {
    const nextKind = nextKinds.get(id)
    if (nextKind && nextKind !== kind)
      issues.push(`Id "${id}" changed kind from "${kind}" to "${nextKind}" across revisions.`)
  }
  return { valid: issues.length === 0, issues }
}

function entryKinds(plan: SetupPlan): Map<string, string> {
  return new Map([
    ...plan.targets.map((item) => [item.id, 'target'] as const),
    ...plan.capabilities.map((item) => [item.id, 'capability'] as const),
    ...plan.toolRecommendations.map((item) => [item.id, 'toolRecommendation'] as const),
    ...[...plan.repositoryActions, ...plan.targetActions].map(
      (item) => [item.id, 'action'] as const,
    ),
    ...plan.verification.map((item) => [item.id, 'verification'] as const),
  ])
}
